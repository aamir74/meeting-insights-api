import mongoose from 'mongoose';

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri || mongoUri.includes('yourPasswordHere') || mongoUri.includes('dummy')) {
      console.error('❌ MONGODB_URI is not configured properly!');
      console.error('');
      console.error('Please update backend/.env file with your actual MongoDB connection string:');
      console.error('1. Go to https://www.mongodb.com/cloud/atlas');
      console.error('2. Create a free cluster');
      console.error('3. Get your connection string');
      console.error('4. Replace the dummy value in backend/.env');
      console.error('   MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/insightboard');
      console.error('');
      throw new Error('MONGODB_URI is not configured. Please update backend/.env file.');
    }

    await mongoose.connect(mongoUri);

    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed due to app termination');
  process.exit(0);
});
