import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  taskId: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  dependencies: string[];
  status: 'ready' | 'blocked' | 'completed' | 'error';
  errorMessage?: string;
  transcriptId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema: Schema = new Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    dependencies: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['ready', 'blocked', 'completed', 'error'],
      default: 'ready',
    },
    errorMessage: {
      type: String,
    },
    transcriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Transcript',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
TaskSchema.index({ transcriptId: 1 });
TaskSchema.index({ taskId: 1 });

export default mongoose.model<ITask>('Task', TaskSchema);
