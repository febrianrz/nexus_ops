export const MAX_ATTACHMENT_FILES = 10;
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_BATCH = 25 * 1024 * 1024;
export interface Attachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  created_at: string;
}
export function attachmentError(files: { size: number }[]): string | null {
  if (!files.length) return 'Choose at least one file.';
  if (files.length > MAX_ATTACHMENT_FILES) return 'Upload up to 10 files at a time.';
  if (files.some((file) => file.size > MAX_ATTACHMENT_SIZE)) return 'Each file must be 10 MB or smaller.';
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_ATTACHMENT_BATCH) return 'The total upload must be 25 MB or smaller.';
  return null;
}
export function attachmentName(name: string): string {
  return (name.split(/[\\/]/).pop() ?? '').replace(/[\x00-\x1f\x7f]/g, '').trim().slice(0, 255) || 'attachment';
}
export function formatFileSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
