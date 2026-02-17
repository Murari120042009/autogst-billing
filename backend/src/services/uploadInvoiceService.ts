import { v4 as uuidv4 } from 'uuid';
import { uploadToSupabase } from '../utils/supabaseClient';
import path from 'path';

/**
 * Handles invoice file upload: validates, generates ID, uploads to Supabase.
 * @param file Multer file object
 * @returns { invoice_id, file_type, storage_path }
 */
export async function handleInvoiceUpload(file: Express.Multer.File) {
  // Validate file type and size
  const ext = getExtension(file.originalname, file.mimetype);
  if (!ext) throw new Error('Unsupported file type');

  if (['jpg', 'jpeg', 'png'].includes(ext) && file.size > 5 * 1024 * 1024) {
    throw new Error('Image file too large (max 5MB)');
  }
  if (ext === 'pdf' && file.size > 10 * 1024 * 1024) {
    throw new Error('PDF file too large (max 10MB)');
  }

  const invoice_id = uuidv4();
  const storage_path = `originals/${invoice_id}.${ext}`;

  await uploadToSupabase(file.buffer, storage_path, file.mimetype);

  return {
    invoice_id,
    file_type: ext,
    storage_path,
  };
}

/**
 * Get file extension from name or mimetype.
 */
function getExtension(filename: string, mimetype: string): string | null {
  const ext = path.extname(filename).replace('.', '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'pdf'].includes(ext)) return ext;
  if (mimetype === 'image/jpeg') return 'jpg';
  if (mimetype === 'image/png') return 'png';
  if (mimetype === 'application/pdf') return 'pdf';
  return null;
}

/**
 * Example usage:
 * await handleInvoiceUpload(file)
 */
