import { useState, useRef } from 'react';
import '../css/FileUploader.css';

const EXTENSION_COLORS = {
  mp3: '#3D8BFF',
  wav: '#8B6CFF',
  flac: '#1FB89A',
  m4a: '#5B8CFF',
  png: '#3D8BFF',
  jpg: '#22A06B',
  jpeg: '#22A06B',
  webp: '#B7A4FF',
  pdf: '#E5484D',
};

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes > 1048576) {
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function FileUploader({
  file,
  onFileSelect,
  onFileRemove,
  accept,
  title = 'Kéo thả file vào đây hoặc',
  browseText = 'chọn file',
  subtitle = 'MP3, WAV, FLAC · tối đa 50 MB',
  uploading = false,
  uploadProgress = 100,
  isError = false,
  errorMessage,
  onRetry,
  compact = false,
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef(null);

  const handleZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleInputChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected && onFileSelect) {
      onFileSelect(selected);
    }
    e.target.value = '';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile && onFileSelect) {
      onFileSelect(droppedFile);
    }
  };

  // Extract extension
  const fileName = file?.name || '';
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const extColor = EXTENSION_COLORS[ext] || '#8E8A97';
  const extBadge = ext.slice(0, 4).toUpperCase() || 'FILE';

  const progressFraction = (uploadProgress / 100).toFixed(3);

  return (
    <div className={`mf-uploader ${isDragOver ? 'is-over' : ''}`}>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="mf-hidden-file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInputChange}
      />

      {/* Drop Zone Box */}
      <button
        type="button"
        className={`mf-dropzone ${compact ? 'compact' : ''}`}
        onClick={handleZoneClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg className="mf-dropzone-dash" aria-hidden="true">
          <rect width="100%" height="100%" rx={compact ? 20 : 24} />
        </svg>

        <span className="mf-dropzone-orb" aria-hidden="true">
          <svg viewBox="0 0 28 28">
            <path d="M8.5 20.5H7a5 5 0 0 1-.6-10 7 7 0 0 1 13.4-1.6A5.5 5.5 0 0 1 21 20.5h-1.5M14 13v10M10.5 16.5L14 13l3.5 3.5" />
          </svg>
        </span>

        <b>
          {title} <em>{browseText}</em>
        </b>
        <small>{subtitle}</small>
      </button>

      {/* Uploaded File Row */}
      {file && (
        <ul className="mf-upload-list" aria-live="polite">
          <li
            className={`mf-upload-row ${isError ? 'fail' : uploading ? '' : 'done'}`}
            style={{ '--p': progressFraction }}
          >
            {/* Colored extension tag */}
            <span
              className="mf-upload-ic"
              style={{ '--c': extColor }}
              aria-hidden="true"
            >
              {extBadge}
            </span>

            {/* Meta */}
            <span className="mf-upload-meta">
              <b title={fileName}>{fileName}</b>
              <small>
                {isError
                  ? (errorMessage || 'Lỗi tải lên · Vui lòng thử lại')
                  : uploading
                  ? `${formatFileSize(file.size * (uploadProgress / 100))} / ${formatFileSize(file.size)} · ${Math.round(uploadProgress)}%`
                  : `${formatFileSize(file.size)} · Sẵn sàng`}
              </small>
            </span>

            {/* Right Status */}
            {isError ? (
              <button
                type="button"
                className="mf-upload-retry"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry?.();
                }}
              >
                Thử lại
              </button>
            ) : uploading ? (
              <span className="mf-upload-spin" aria-hidden="true" />
            ) : (
              <span className="mf-upload-st" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.4l3 3 6-6.4" />
                </svg>
              </span>
            )}

            {/* Remove / Cancel button */}
            {onFileRemove && !uploading && (
              <button
                type="button"
                className="mf-upload-remove-btn"
                title="Xóa file"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileRemove();
                }}
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}

            {/* Animated Bottom Bar */}
            <span className="mf-upload-bar" aria-hidden="true" />
          </li>
        </ul>
      )}
    </div>
  );
}
