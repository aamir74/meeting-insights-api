import Transcript from '../models/Transcript';
import Task from '../models/Task';
import llmService from './llmService';
import validationService from './validationService';
import cycleDetectionService from './cycleDetectionService';

interface Job {
  jobId: string;
  transcriptId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

/**
 * In-memory job queue for async LLM processing
 * For production, consider using Bull/BullMQ with Redis
 */
export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private processingQueue: string[] = [];
  private isProcessing: boolean = false;

  /**
   * Adds a job to the queue
   */
  async enqueueJob(jobId: string, transcriptId: string): Promise<void> {
    const job: Job = {
      jobId,
      transcriptId,
      status: 'pending',
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);

    console.log(`📝 Job ${jobId} enqueued`);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Gets the current status of a job
   */
  getJobStatus(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Processes jobs in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const jobId = this.processingQueue.shift();
      if (!jobId) continue;

      const job = this.jobs.get(jobId);
      if (!job) continue;

      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Processes a single job
   */
  private async processJob(job: Job): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`⚙️  Processing job ${job.jobId}...`);

      // Update job and transcript status
      job.status = 'processing';
      job.startTime = startTime;

      await Transcript.findOneAndUpdate(
        { jobId: job.jobId },
        { status: 'processing' }
      );

      // Get transcript content
      const transcript = await Transcript.findOne({ jobId: job.jobId });
      if (!transcript) {
        throw new Error('Transcript not found');
      }

      // Step 1: Extract tasks using LLM
      console.log(`🤖 Calling Gemini API for job ${job.jobId}...`);
      const llmResponse = await llmService.extractTasksFromTranscript(
        transcript.content
      );

      // Step 2: Validate and sanitize dependencies
      console.log(`✅ Validating ${llmResponse.tasks.length} tasks...`);
      let validatedTasks = validationService.validateAndSanitizeTasks(
        llmResponse.tasks
      );

      // Step 3: Detect cycles
      console.log(`🔍 Detecting cycles...`);
      const cycleResult = cycleDetectionService.detectCycles(validatedTasks);
      validatedTasks = cycleResult.tasks;

      // Step 4: Save tasks to database
      console.log(`💾 Saving tasks to database...`);
      const savedTasks = await Task.insertMany(
        validatedTasks.map(task => ({
          taskId: task.id,
          description: task.description,
          priority: task.priority,
          dependencies: task.dependencies,
          status: task.status,
          errorMessage: task.errorMessage,
          transcriptId: transcript._id,
        }))
      );

      // Step 5: Update transcript with metadata
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await Transcript.findOneAndUpdate(
        { jobId: job.jobId },
        {
          status: 'completed',
          metadata: {
            taskCount: savedTasks.length,
            cyclesDetected: cycleResult.hasCycles,
            processingTime,
          },
        }
      );

      // Update job status
      job.status = 'completed';
      job.endTime = endTime;

      console.log(
        `✅ Job ${job.jobId} completed in ${processingTime}ms (${savedTasks.length} tasks, cycles: ${cycleResult.hasCycles})`
      );
    } catch (error: any) {
      console.error(`❌ Job ${job.jobId} failed:`, error);

      // Update job and transcript with error
      job.status = 'failed';
      job.endTime = Date.now();

      await Transcript.findOneAndUpdate(
        { jobId: job.jobId },
        {
          status: 'failed',
          errorMessage: error.message || 'Unknown error occurred',
        }
      );
    }
  }

  /**
   * Gets queue statistics
   */
  getQueueStats(): {
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const stats = {
      totalJobs: this.jobs.size,
      pendingJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
    };

    this.jobs.forEach(job => {
      switch (job.status) {
        case 'pending':
          stats.pendingJobs++;
          break;
        case 'processing':
          stats.processingJobs++;
          break;
        case 'completed':
          stats.completedJobs++;
          break;
        case 'failed':
          stats.failedJobs++;
          break;
      }
    });

    return stats;
  }
}

export default new JobQueue();
