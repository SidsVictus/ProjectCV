// Must match public.file_ext() in the database (20261101000002_security.sql).
export const ALLOWED_MIME_TYPES = [
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4", "video/webm", "video/quicktime", "application/zip",
] as const;

// Must match create_file_document() (migration 0005): 100 MB per file, 1 GB per account.
export const MAX_FILE_BYTES = 100 * 1024 ** 2;

/** Extensions the file picker offers (the server checks the MIME type). */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.doc,.docx,.mp4,.webm,.mov,.zip";
