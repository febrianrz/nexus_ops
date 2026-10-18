import { taskAttachments } from '@/db/schema';
import { route } from '@/lib/api';
import { attachmentTask } from '@/lib/attachment-access';
import { attachmentError, attachmentName, MAX_ATTACHMENT_BATCH } from '@/lib/attachments';
import { database } from '@/lib/database';
import { ProtocolError } from '@/lib/protocol';
import { asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
const metadata = { id: taskAttachments.id, filename: taskAttachments.filename, mime_type: taskAttachments.mime_type, size: taskAttachments.size, created_at: taskAttachments.created_at };
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await ctx.params;
    await attachmentTask(req, id);
    return { attachments: await database().select(metadata).from(taskAttachments).where(eq(taskAttachments.task_id, id)).orderBy(asc(taskAttachments.created_at), asc(taskAttachments.id)) };
  });
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const { id } = await ctx.params;
    const { task, user } = await attachmentTask(req, id);
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data')) throw new ProtocolError('Use a multipart file upload', 422);
    const limit = MAX_ATTACHMENT_BATCH + 512 * 1024;
    if (Number(req.headers.get('content-length')) > limit) throw new ProtocolError('Upload is too large', 413);
    const reader = req.body?.getReader();
    if (!reader) throw new ProtocolError('Choose files to upload', 422);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > limit) { await reader.cancel(); throw new ProtocolError('Upload is too large', 413); }
        chunks.push(next.value);
      }
    } finally { reader.releaseLock(); }
    let form: FormData;
    try { form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { 'content-type': contentType } }).formData(); }
    catch { throw new ProtocolError('Invalid file upload', 422); }
    const values = form.getAll('files');
    if (values.some((value) => typeof value === 'string')) throw new ProtocolError('Choose valid files', 422);
    const files = values as File[];
    const error = attachmentError(files);
    if (error) throw new ProtocolError(error, 422);
    const createdAt = new Date().toISOString();
    const rows = await Promise.all(files.map(async (file) => ({ id: randomUUID(), task_id: id, workspace_id: task.workspace_id!, uploaded_by: user.id, filename: attachmentName(file.name), mime_type: file.type.slice(0, 200) || 'application/octet-stream', size: file.size, content: Buffer.from(await file.arrayBuffer()), created_at: createdAt })));
    const attachments = await database().transaction(async (tx) => tx.insert(taskAttachments).values(rows).returning(metadata));
    return NextResponse.json({ attachments }, { status: 201 });
  });
}
