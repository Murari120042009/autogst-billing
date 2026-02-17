import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const BUCKET = 'invoices';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Uploads a file buffer to Supabase Storage.
 * @param buffer File buffer
 * @param storagePath Path in bucket
 * @param mimetype File mimetype
 */
export async function uploadToSupabase(buffer: Buffer, storagePath: string, mimetype: string) {
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimetype,
    upsert: false,
  });
  if (error) throw new Error('Supabase upload failed: ' + error.message);
}

/**
 * Example usage:
 * await uploadToSupabase(buffer, 'originals/uuid.jpg', 'image/jpeg')
 */
