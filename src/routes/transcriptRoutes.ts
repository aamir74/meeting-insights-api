import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import idempotencyService from '../services/idempotencyService';
import jobQueue from '../services/jobQueue';
import Transcript from '../models/Transcript';
import Task from '../models/Task';
import { generateJobId } from '../utils/hash';

const router = express.Router();

/**
 * POST /api/transcripts
 * Submit a transcript for processing
 *
 * Request body:
 * {
 *   "transcript": "Meeting transcript content..."
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "jobId": "job_xyz123",
 *   "message": "Transcript submitted successfully",
 *   "isDuplicate": false
 * }
 */
router.post(
  '/',
  [
    body('transcript')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Transcript content is required')
      .isLength({ min: 50 })
      .withMessage('Transcript must be at least 50 characters long'),
  ],
  async (req: Request, res: Response) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { transcript } = req.body;

      // Check for duplicate (idempotency)
      const duplicateCheck = await idempotencyService.checkDuplicate(transcript);

      if (duplicateCheck.isDuplicate && duplicateCheck.existingJobId) {
        return res.status(200).json({
          success: true,
          jobId: duplicateCheck.existingJobId,
          message: 'Duplicate transcript detected. Returning existing job.',
          isDuplicate: true,
        });
      }

      // Generate new job ID
      const jobId = generateJobId();

      // Create transcript record
      const transcriptDoc = await idempotencyService.createTranscript(
        jobId,
        transcript
      );

      // Enqueue job for async processing
      await jobQueue.enqueueJob(jobId, transcriptDoc._id.toString());

      // Return job ID immediately
      res.status(202).json({
        success: true,
        jobId,
        message: 'Transcript submitted successfully. Processing started.',
        isDuplicate: false,
      });
    } catch (error: any) {
      console.error('Error submitting transcript:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error.message || 'Failed to submit transcript',
        },
      });
    }
  }
);

/**
 * GET /api/transcripts/:id
 * Get transcript details with all tasks
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transcript = await Transcript.findById(id);
    if (!transcript) {
      return res.status(404).json({
        success: false,
        error: { message: 'Transcript not found' },
      });
    }

    const tasks = await Task.find({ transcriptId: id });

    res.json({
      success: true,
      data: {
        transcript,
        tasks,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch transcript' },
    });
  }
});

export default router;
