import React, { useState } from 'react';

/**
 * Production-Ready Direct Upload Component (Native Fetch)
 * 
 * Zero dependencies - uses native fetch API
 * Works on Vercel without any package.json changes
 */

interface UploadResponse {
    data: {
        invoiceId: string;
        jobId: string;
        status: string;
    };
}

const DirectUpload: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<string>('');
    const [progress, setProgress] = useState<number>(0);
    const [uploading, setUploading] = useState<boolean>(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            // Client-side validation
            const maxSize = 50 * 1024 * 1024; // 50MB
            if (selectedFile.size > maxSize) {
                setStatus('❌ File too large. Maximum size is 50MB.');
                return;
            }

            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
            if (!allowedTypes.includes(selectedFile.type)) {
                setStatus('❌ Invalid file type. Only PDF, JPEG, and PNG are allowed.');
                return;
            }

            setFile(selectedFile);
            setStatus('');
            setProgress(0);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setStatus('❌ Please select a file first.');
            return;
        }

        setUploading(true);
        setProgress(0);

        try {
            // ========================================
            // STEP 1: Request Presigned Upload URL
            // ========================================
            setStatus('🔐 Requesting upload permission...');

            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Not authenticated');
            }

            const presignResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/upload-direct/presigned`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        filename: file.name,
                        mimetype: file.type,
                        size: file.size
                    })
                }
            );

            if (!presignResponse.ok) {
                const error = await presignResponse.json();
                throw new Error(error.error || `HTTP ${presignResponse.status}`);
            }

            const presignData = await presignResponse.json();

            console.log('Presigned URL received:', {
                fileId: presignData.fileId,
                expiresIn: presignData.expiresIn
            });

            // ========================================
            // STEP 2: Upload File Directly to MinIO
            // ========================================
            setStatus('📤 Uploading to storage...');

            // Note: Native fetch doesn't support progress tracking for uploads
            // For progress, you'd need to use XMLHttpRequest or a library
            // This is a trade-off for zero dependencies

            const uploadResponse = await fetch(presignData.url, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            });

            if (!uploadResponse.ok) {
                throw new Error(`Upload failed: HTTP ${uploadResponse.status}`);
            }

            console.log('File uploaded to storage successfully');
            setProgress(66); // Simulated progress

            // ========================================
            // STEP 3: Notify Backend to Process
            // ========================================
            setStatus('🔔 Notifying server...');

            const notifyResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/upload-direct/notify`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        objectName: presignData.objectName,
                        fileId: presignData.fileId,
                        filename: file.name,
                        mimetype: file.type,
                        size: file.size
                    })
                }
            );

            if (!notifyResponse.ok) {
                const error = await notifyResponse.json();
                throw new Error(error.error || `HTTP ${notifyResponse.status}`);
            }

            const result: UploadResponse = await notifyResponse.json();

            console.log('Upload complete:', result.data);

            setStatus(`✅ Upload successful! Job ID: ${result.data.jobId}`);
            setProgress(100);

            // Optional: Redirect or update UI
            // router.push(`/invoices/${result.data.invoiceId}`);

        } catch (error: any) {
            console.error('Upload failed:', error);

            // Parse error message
            const errorMessage = error.message || 'Unknown error';

            // Handle specific error cases
            if (errorMessage.includes('401') || errorMessage.includes('Not authenticated')) {
                setStatus('❌ Authentication failed. Please log in again.');
            } else if (errorMessage.includes('403') || errorMessage.includes('Unauthorized')) {
                setStatus('❌ Unauthorized. You do not have permission to upload this file.');
            } else if (errorMessage.includes('404')) {
                setStatus('❌ File not found in storage. Please try again.');
            } else if (errorMessage.includes('413')) {
                setStatus('❌ File too large. Maximum size is 50MB.');
            } else if (errorMessage.includes('500')) {
                setStatus('❌ Server error. Please try again later.');
            } else if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
                setStatus('❌ Network error. Please check your connection.');
            } else {
                setStatus(`❌ Upload failed: ${errorMessage}`);
            }

            setProgress(0);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6">Upload Invoice</h2>

            <div className="mb-4">
                <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>

            {file && (
                <div className="mb-4 p-4 bg-gray-50 rounded-md">
                    <p className="text-sm"><strong>Selected:</strong> {file.name}</p>
                    <p className="text-sm"><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p className="text-sm"><strong>Type:</strong> {file.type}</p>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-md
          font-semibold hover:bg-blue-700 disabled:bg-gray-300
          disabled:cursor-not-allowed transition-colors"
            >
                {uploading ? 'Uploading...' : 'Upload Invoice'}
            </button>

            {progress > 0 && (
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {status && (
                <div className={`mt-4 p-4 rounded-md ${status.startsWith('❌')
                        ? 'bg-red-50 text-red-800 border border-red-200'
                        : 'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                    {status}
                </div>
            )}

            <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <h3 className="font-semibold mb-2">Upload Guidelines:</h3>
                <ul className="text-sm space-y-1 list-disc list-inside">
                    <li>Maximum file size: 50MB</li>
                    <li>Supported formats: PDF, JPEG, PNG</li>
                    <li>Files are processed automatically after upload</li>
                    <li>You'll receive a notification when OCR is complete</li>
                </ul>
            </div>
        </div>
    );
};

export default DirectUpload;

/* ========================================
   OPTIONAL: Progress Tracking with XMLHttpRequest
   
   If you need real upload progress, use this helper:
   ======================================== */

/*
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error'));
    });

    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

// Usage in STEP 2:
await uploadWithProgress(presignData.url, file, (percent) => {
  setProgress(percent);
  setStatus(`📤 Uploading: ${percent}%`);
});
*/
