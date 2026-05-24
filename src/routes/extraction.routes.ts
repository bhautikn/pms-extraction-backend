import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { uploadLimiter } from '../middleware/rateLimit';
import {
  uploadPdf,
  listExtractions,
  getExtraction,
  retryExtraction,
} from '../controllers/extraction.controller';

const router = Router();

router.use(authMiddleware);

router.post('/upload', uploadLimiter, uploadMiddleware.single('pdf'), uploadPdf);
router.get('/', listExtractions);
router.get('/:id', getExtraction);
router.post('/:id/retry', retryExtraction);

export default router;
