// Must match public.file_ext() in the database (20261101000002_security.sql).
export const ALLOWED_MIME_TYPES = [
  "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "video/mp4", "video/webm", "video/quicktime", "application/zip",
] as const;

// No storage quota (MVP: "No storage cap"); this is R2's limit for a single PUT.
export const MAX_FILE_BYTES = 5 * 1024 ** 3;

/** Extensions the file picker offers (the server checks the MIME type). */
export const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.ppt,.pptx,.doc,.docx,.mp4,.webm,.mov,.zip";
