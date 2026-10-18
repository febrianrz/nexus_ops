'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, File, LoaderCircle, Paperclip, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { attachmentError, formatFileSize, type Attachment } from '@/lib/attachments';
import { Button } from './ui';

export function TaskAttachments({ taskId }: { taskId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pending, setPending] = useState<globalThis.File[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/v1/tasks/${encodeURIComponent(taskId)}/attachments`;
  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const response = await fetch(base, { credentials: 'same-origin', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Could not load attachments.');
      setAttachments(data.attachments);
      setError('');
    } catch (failure) { if (!signal?.aborted) setError((failure as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [taskId]);
  function add(files: globalThis.File[]) {
    if (uploading) return;
    const next = [...pending, ...files];
    const invalid = attachmentError(next);
    if (invalid) { setError(invalid); return; }
    setPending(next);
    setError('');
  }
  return <section className="task-attachments" aria-label="Attachments">
    <div className="attachment-heading"><h3><Paperclip size={15} />Attachments<span>{attachments.length}</span></h3><button className="attachment-refresh" type="button" aria-label="Refresh attachments" onClick={() => void load()}><RefreshCw size={14} /></button></div>
    {loading ? <p className="attachment-status" role="status"><LoaderCircle size={14} className="spin" />Loading attachments…</p> : <>
      <ul className="attachment-list">{attachments.map((file) => <li key={file.id}><File size={17} /><span><a href={`${base}/${encodeURIComponent(file.id)}`} download>{file.filename}</a><small>{formatFileSize(file.size)}</small></span><a href={`${base}/${encodeURIComponent(file.id)}`} download aria-label={`Download ${file.filename}`}><Download size={15} /></a></li>)}</ul>
      {!attachments.length && <p className="attachment-status">Keep files and context with this task.</p>}
    </>}
    <div className={`attachment-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!uploading) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); add(Array.from(event.dataTransfer.files)); }}>
      <input ref={input} type="file" multiple className="attachment-file-input" id={`attachments-${taskId}`} aria-label="Choose attachments" onChange={(event) => { add(Array.from(event.target.files ?? [])); event.target.value = ''; }} />
      <label htmlFor={`attachments-${taskId}`}><Upload size={16} /><span>Choose files or drop them here</span></label>
      <small>Up to 10 files · 10 MB each · 25 MB per upload</small>
    </div>
    {pending.length > 0 && <div className="attachment-pending" aria-busy={uploading}>
      <ul>{pending.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name}<small>{formatFileSize(file.size)}</small></span><button type="button" disabled={uploading} aria-label={`Remove ${file.name} from upload`} onClick={() => setPending((files) => files.filter((_, i) => i !== index))}><X size={14} /></button></li>)}</ul>
      <div className="attachment-upload-actions"><Button disabled={uploading} onClick={() => setPending([])}>Cancel</Button><Button className="primary" disabled={uploading} onClick={async () => {
        if (uploading) return;
        setUploading(true); setError('');
        const form = new FormData(); pending.forEach((file) => form.append('files', file));
        try {
          const response = await fetch(base, { method: 'POST', credentials: 'same-origin', body: form });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? 'Upload failed. Try again.');
          setAttachments((files) => [...files, ...data.attachments]);
          setPending([]);
          toast.success(`${data.attachments.length} file${data.attachments.length === 1 ? '' : 's'} attached`);
        } catch (failure) { setError((failure as Error).message); }
        finally { setUploading(false); }
      }}>{uploading ? <LoaderCircle size={14} className="spin" /> : <Upload size={14} />}{uploading ? 'Uploading…' : `Upload ${pending.length} file${pending.length === 1 ? '' : 's'}`}</Button></div>
    </div>}
    {error && <p className="attachment-error" role="alert">{error}</p>}
  </section>;
}
