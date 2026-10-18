import { taskAttachments } from '@/db/schema';
import { route } from '@/lib/api';
import { attachmentTask } from '@/lib/attachment-access';
import { database } from '@/lib/database';
import { ProtocolError } from '@/lib/protocol';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; attachmentId: string }> }) {
  return route(req, async () => {
    const { id, attachmentId } = await ctx.params;
    await attachmentTask(req, id);
    const [file] = await database().select({ content: taskAttachments.content, filename: taskAttachments.filename, size: taskAttachments.size }).from(taskAttachments).where(and(eq(taskAttachments.id, attachmentId), eq(taskAttachments.task_id, id))).limit(1);
    if (!file) throw new ProtocolError('Attachment not found', 404);
    return new NextResponse(new Uint8Array(file.content), { headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`,
      'Content-Length': String(file.size),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    } });
  });
}
