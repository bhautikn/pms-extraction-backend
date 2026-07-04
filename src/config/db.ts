import mongoose from 'mongoose';
import { env } from './env';
import { preWarmSystemPrompt } from '../services/claude.service';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s exponential backoff

export async function connectDB(): Promise<void> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
      });
      console.log('✅ MongoDB connected');

      // Pre-warm the system prompt so the first extraction doesn't pay cold-start latency
      try {
        await preWarmSystemPrompt();
        console.log('✅ System prompt pre-warmed');
      } catch (promptErr) {
        console.warn('⚠️ Failed to pre-warm system prompt (will retry on first use):', promptErr);
      }

      return;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`, err);
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw new Error('MongoDB connection failed after all retry attempts');
      }
    }
  }
}
