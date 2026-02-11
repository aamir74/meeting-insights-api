import dotenv from 'dotenv';

// Load environment variables FIRST before anything else
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  geminiApiKey: process.env.GEMINI_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
