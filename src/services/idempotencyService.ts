import Transcript from '../models/Transcript';
import { generateContentHash } from '../utils/hash';

export interface IdempotencyCheckResult {
  isDuplicate: boolean;
  existingJobId?: string;
  existingTranscript?: any;
}

/**
 * Idempotency Service
 *
 * Prevents duplicate processing of the same transcript by:
 * 1. Hashing transcript content (SHA-256)
 * 2. Checking if a transcript with the same hash already exists
 * 3. Returning existing job ID if found, preventing duplicate LLM calls
 *
 * This saves costs and ensures consistency across duplicate submissions
 */
export class IdempotencyService {
  /**
   * Checks if a transcript has already been processed
   *
   * @param content - The transcript content to check
   * @returns Result indicating if duplicate exists and the existing job ID
   */
  async checkDuplicate(content: string): Promise<IdempotencyCheckResult> {
    try {
      // Generate hash of the transcript content
      const contentHash = generateContentHash(content);

      // Query database for existing transcript with same hash
      const existingTranscript = await Transcript.findOne({ contentHash });

      if (existingTranscript) {
        console.log(
          `🔄 Duplicate transcript detected. Returning existing job: ${existingTranscript.jobId}`
        );

        return {
          isDuplicate: true,
          existingJobId: existingTranscript.jobId,
          existingTranscript,
        };
      }

      return {
        isDuplicate: false,
      };
    } catch (error) {
      console.error('Error checking for duplicate transcript:', error);
      throw error;
    }
  }

  /**
   * Creates a new transcript record with hash for future idempotency checks
   *
   * @param jobId - Unique job identifier
   * @param content - Transcript content
   * @returns Created transcript document
   */
  async createTranscript(jobId: string, content: string) {
    const contentHash = generateContentHash(content);

    const transcript = new Transcript({
      jobId,
      content,
      contentHash,
      status: 'pending',
    });

    await transcript.save();

    console.log(`📝 New transcript created with job ID: ${jobId}`);

    return transcript;
  }

  /**
   * Gets transcript by job ID
   */
  async getTranscriptByJobId(jobId: string) {
    return await Transcript.findOne({ jobId });
  }

  /**
   * Updates transcript status
   */
  async updateTranscriptStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ) {
    const update: any = { status };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }

    return await Transcript.findOneAndUpdate({ jobId }, update, { new: true });
  }
}

export default new IdempotencyService();
