import mongoose, { Schema, Document } from 'mongoose';

export interface ITranscript extends Document {
  jobId: string;
  content: string;
  contentHash: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  metadata?: {
    taskCount?: number;
    cyclesDetected?: boolean;
    processingTime?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TranscriptSchema: Schema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    errorMessage: {
      type: String,
    },
    metadata: {
      taskCount: Number,
      cyclesDetected: Boolean,
      processingTime: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Index for idempotency checks
TranscriptSchema.index({ contentHash: 1 });

export default mongoose.model<ITranscript>('Transcript', TranscriptSchema);
