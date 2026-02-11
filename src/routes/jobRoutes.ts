import express, { Request, Response } from 'express';
import jobQueue from '../services/jobQueue';
import Transcript from '../models/Transcript';
import Task, { ITask } from '../models/Task';

const router = express.Router();

/**
 * GET /api/jobs/:jobId
 * Get job status and results
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "jobId": "job_xyz123",
 *     "status": "completed",
 *     "transcript": {...},
 *     "tasks": [...],
 *     "metadata": {...}
 *   }
 * }
 */
router.get('/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    // Get transcript by job ID
    const transcript = await Transcript.findOne({ jobId });

    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: { message: 'Job not found' },
      });
    }

    // Get job status from queue (if still in queue)
    const jobStatus = jobQueue.getJobStatus(jobId);

    // Get tasks if job is completed
    let tasks: ITask[] = [];
    if (transcript.status === 'completed') {
      tasks = await Task.find({ transcriptId: transcript._id });
    }

    res.json({
      success: true,
      data: {
        jobId,
        status: transcript.status,
        transcript: {
          id: transcript._id,
          content: transcript.content,
          createdAt: transcript.createdAt,
          updatedAt: transcript.updatedAt,
        },
        tasks,
        metadata: transcript.metadata,
        errorMessage: transcript.errorMessage,
        queueStatus: jobStatus,
      },
    });
  } catch (error: any) {
    console.error('Error fetching job:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch job status' },
    });
  }
});

/**
 * GET /api/jobs
 * Get queue statistics (for debugging)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const stats = jobQueue.getQueueStats();

    res.json({
      success: true,
      data: {
        queueStats: stats,
      },
    });
  } catch (error: any) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch queue statistics' },
    });
  }
});

export default router;
