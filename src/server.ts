import { env } from './config/env';
import { connectDB } from './config/db';
import app from './app';

async function bootstrap() {
  await connectDB();
  app.listen(env.PORT, () => {
    console.log(`🚀 PMSExtractMate backend running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
