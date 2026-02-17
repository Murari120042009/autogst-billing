import React, { useState } from 'react';
import axios from 'axios';

/**
 * Production-Ready Direct Upload Component
 * 
 * Uses presigned URLs to upload files directly to MinIO,
 * bypassing Vercel's 4.5MB limit and 10s timeout.
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

            const token = localStorage.getItem('authToken'); // Adjust based on your auth implementation
            if (!token) {
                throw new Error('Not authenticated');
            }

            const { data: presignData } = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/upload-direct/presigned`,
                {
                    filename: file.name,
                    mimetype: file.type,
                    size: file.size // ⚠️ REQUIRED for backend validation
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Presigned URL received:', {
                fileId: presignData.fileId,
                expiresIn: presignData.expiresIn
            });

            // ========================================
            // STEP 2: Upload File Directly to MinIO
            // ========================================
            setStatus('📤 Uploading to storage...');

            // ⚠️ CRITICAL: Do NOT send Authorization header to MinIO
            // The presigned URL already contains authentication
            await axios.put(presignData.url, file, {
                headers: {
                    'Content-Type': file.type // Must match the file's actual type
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / (progressEvent.total || 1)
                    );
                    setProgress(percentCompleted);
                    setStatus(`📤 Uploading: ${percentCompleted}%`);
                }
            });

            console.log('File uploaded to storage successfully');

            // ========================================
            // STEP 3: Notify Backend to Process
            // ========================================
            setStatus('🔔 Notifying server...');

            const { data: result }: { data: UploadResponse } = await axios.post(
                `${process.env.REACT_APP_API_URL}/api/upload-direct/notify`,
                {
                    objectName: presignData.objectName,
                    fileId: presignData.fileId,
                    filename: file.name,
                    mimetype: file.type,
                    size: file.size
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Upload complete:', result.data);

            setStatus(`✅ Upload successful! Job ID: ${result.data.jobId}`);
            setProgress(100);

            // Optional: Redirect or update UI
            // navigate(`/invoices/${result.data.invoiceId}`);

        } catch (error: any) {
            console.error('Upload failed:', error);

            // Handle specific error cases
            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.error || 'Unknown error';

                switch (status) {
                    case 401:
                        setStatus('❌ Authentication failed. Please log in again.');
                        break;
                    case 403:
                        setStatus('❌ Unauthorized. You do not have permission to upload this file.');
                        break;
                    case 404:
                        setStatus('❌ File not found in storage. Please try again.');
                        break;
                    case 413:
                        setStatus('❌ File too large. Maximum size is 50MB.');
                        break;
                    case 500:
                        setStatus('❌ Server error. Please try again later.');
                        break;
                    default:
                        setStatus(`❌ Upload failed: ${message}`);
                }
            } else if (error.request) {
                // Network error
                setStatus('❌ Network error. Please check your connection.');
            } else {
                setStatus(`❌ Error: ${error.message}`);
            }

            setProgress(0);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-container">
            <h2>Upload Invoice</h2>

            <div className="file-input-wrapper">
                <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
            </div>

            {file && (
                <div className="file-info">
                    <p><strong>Selected:</strong> {file.name}</p>
                    <p><strong>Size:</strong> {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><strong>Type:</strong> {file.type}</p>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="upload-button"
            >
                {uploading ? 'Uploading...' : 'Upload Invoice'}
            </button>

            {progress > 0 && (
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}

            {status && (
                <div className={`status-message ${status.startsWith('❌') ? 'error' : 'success'}`}>
                    {status}
                </div>
            )}

            <div className="upload-notes">
                <h3>Upload Guidelines:</h3>
                <ul>
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
   BASIC CSS (Add to your stylesheet)
   ======================================== */

/*
.upload-container {
  max-width: 600px;
  margin: 2rem auto;
  padding: 2rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.file-input-wrapper {
  margin: 1rem 0;
}

.file-info {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  margin: 1rem 0;
}

.upload-button {
  background: #007bff;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.upload-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.progress-bar {
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  margin: 1rem 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.status-message {
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 4px;
}

.status-message.success {
  background: #d4edda;
  color: #155724;
}

.status-message.error {
  background: #f8d7da;
  color: #721c24;
}

.upload-notes {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid #ddd;
}

.upload-notes ul {
  list-style-type: disc;
  padding-left: 1.5rem;
}
*/
