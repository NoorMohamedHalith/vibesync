import { useState, useRef } from 'react';
import { useMedia } from '../context/MediaContext';
import { useToast } from '../context/ToastContext';

export default function FileShare({ isAdmin }) {
  const { sharedFiles, shareFile, deleteSharedFile } = useMedia();
  const { addToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Supported formats: images, PDFs, docs, videos
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'video/mp4', 'video/webm'
    ];
    // Check type or extension (allow common extensions)
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.doc', '.docx', '.mp4', '.webm', '.txt', '.zip'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt)) {
      addToast({ type: 'error', message: 'Supported formats: PDF, Images, Videos, Word Documents, TXT, ZIP.' });
      return;
    }

    // Size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      addToast({ type: 'error', message: 'File is too large! Maximum limit is 10MB.' });
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      for (let p = 15; p <= 100; p += 15) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        setUploadProgress(Math.min(p, 100));
      }

      shareFile(file);
      addToast({ type: 'success', message: `Successfully shared ${file.name}!` });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      addToast({ type: 'error', message: err.message || 'Failed to share file.' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.fileData;
    link.download = file.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-white/50 dark:bg-black/10 backdrop-blur-md rounded-2xl border border-white/20 dark:border-white/5 p-4">
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3 mb-4">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Shared Files
        </h3>
        
        {/* Upload Button */}
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip"
            className="hidden"
            id="file-upload-input"
          />
          <label
            htmlFor="file-upload-input"
            className="btn-primary cursor-pointer !py-1.5 !px-3 !text-xs flex items-center gap-1.5 shadow-none"
          >
            {isUploading ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Upload
          </label>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="mb-4 animate-fade-in shrink-0">
          <div className="flex justify-between text-[11px] text-violet-400 font-semibold mb-1">
            <span>Uploading {fileInputRef.current?.files?.[0]?.name || 'file'}...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5 shadow-[0_0_10px_rgba(139,92,246,0.15)]">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 rounded-full transition-all duration-150"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Files List */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
        {sharedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400 dark:text-gray-500 text-sm">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            No files shared yet
          </div>
        ) : (
          sharedFiles.map((file) => {
            const isImage = file.fileType?.startsWith('image/');
            return (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/70 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 hover:border-brand-500/30 transition-all group"
              >
                {/* File Preview Icon */}
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-brand-500/10 text-brand-600 dark:text-brand-400 flex-shrink-0 overflow-hidden">
                  {isImage ? (
                    <img src={file.fileData} alt={file.fileName} className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>

                {/* File Details */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {formatBytes(file.fileSize)} • By <span className="font-medium text-brand-500">{file.senderName}</span>
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 rounded-lg text-gray-500 hover:text-brand-500 hover:bg-brand-500/10 transition-all"
                    title="Download File"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>

                  {/* Delete button for admin */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        deleteSharedFile(file.id);
                        addToast({ type: 'info', message: `Deleted ${file.fileName}` });
                      }}
                      className="p-2 rounded-lg text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all"
                      title="Delete File"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
