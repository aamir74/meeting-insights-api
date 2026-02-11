import crypto from 'crypto';

/**
 * Generates a SHA-256 hash for transcript content
 * Used for idempotency checks to prevent duplicate processing
 */
export const generateContentHash = (content: string): string => {
  return crypto
    .createHash('sha256')
    .update(content.trim().toLowerCase())
    .digest('hex');
};

/**
 * Generates a unique job ID using timestamp and random bytes
 */
export const generateJobId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(8).toString('hex');
  return `job_${timestamp}_${randomBytes}`;
};
