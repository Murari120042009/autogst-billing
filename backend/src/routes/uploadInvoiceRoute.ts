import { Router } from 'express';
import multer from 'multer';
import { uploadInvoiceController } from '../controllers/uploadInvoiceController';

const router = Router();

// Multer config for file size/type validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/pdf',
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  },
});

router.post(
  '/upload-invoice',
  upload.single('file'),
  uploadInvoiceController
);

export default router;
