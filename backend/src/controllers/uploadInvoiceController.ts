import { Request, Response } from 'express';
import { handleInvoiceUpload } from '../services/uploadInvoiceService';

/**
 * Controller for POST /upload-invoice
 * Accepts multipart/form-data, validates, and stores file.
 */
export async function uploadInvoiceController(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const result = await handleInvoiceUpload(req.file);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Upload failed' });
  }
}

/**
 * Example usage (in route):
 * router.post('/upload-invoice', upload.single('file'), uploadInvoiceController)
 */
