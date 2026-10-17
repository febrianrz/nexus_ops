import { authenticate, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
const sourceUrl = z.url().regex(/^https?:\/\//);
const githubItem = z.object({
  number: z.number().int().positive(),
  title: z.string().min(3).max(180),
  body: z.string().nullable().optional(),
  html_url: sourceUrl,
  head: z.object({ ref: z.string() }).optional(),
  labels: z.array(z.object({ name: z.string() })).default([]),
});
const githubPayload = z.object({
  action: z.string(),
  repository: z.object({ full_name: z.string().min(3) }),
  issue: githubItem.optional(),
  pull_request: githubItem.optional(),
});
const input = z
  .object({
    title: z.string().min(3).max(180),
    description: z.string().max(10000).default(''),
    source_type: z.enum(['TICKET', 'GITHUB_ISSUE', 'GITHUB_PR', 'MANUAL']),
    source_ref: z.string().min(1).max(200),
    source_url: sourceUrl.nullable().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    context_payload: z.record(z.string(), z.unknown()).default({}),
    labels: z.array(z.string().max(30)).max(10).default([]),
  })
  .strict();
export async function POST(req: NextRequest) {
  return route(req, async () => {
    const raw = await req.text();
    if (Buffer.byteLength(raw) > 262144) throw new ProtocolError('Payload exceeds 256 KB', 413);
    const signature =
      req.headers.get('x-hub-signature-256') ?? req.headers.get('x-nexus-signature');
    let signed = false;
    if (signature && process.env.NEXUS_WEBHOOK_SECRET) {
      const expected =
        'sha256=' +
        createHmac('sha256', process.env.NEXUS_WEBHOOK_SECRET).update(raw).digest('hex');
      signed =
        Buffer.byteLength(signature) === Buffer.byteLength(expected) &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      if (!signed) throw new ProtocolError('Invalid webhook signature', 401);
    }
    const incoming: unknown = JSON.parse(raw);
    const githubEvent = req.headers.get('x-github-event');
    let normalized = incoming;
    if (githubEvent) {
      if (!['issues', 'pull_request'].includes(githubEvent))
        throw new ProtocolError('Unsupported GitHub event', 422);
      const github = githubPayload.parse(incoming);
      if (!['opened', 'reopened'].includes(github.action))
        return { ignored: true, reason: 'Only opened and reopened events create tasks' };
      const item = githubEvent === 'pull_request' ? github.pull_request : github.issue;
      if (!item) throw new ProtocolError('Missing GitHub issue or pull request', 422);
      normalized = {
        title: item?.title,
        description: item?.body ?? '',
        source_type: githubEvent === 'pull_request' ? 'GITHUB_PR' : 'GITHUB_ISSUE',
        source_ref: `${github.repository.full_name}#${item.number}`,
        source_url: item?.html_url,
        context_payload: {
          repo: github.repository.full_name,
          branch: item.head?.ref,
        },
        labels: item.labels.map((label) => label.name),
      };
    }
    const body = input.parse(normalized);
    return transact(
      req,
      (w) => {
        const caller = signed
          ? w.actors.find((a) => a.type === 'HUMAN')!
          : authenticate(req, w, true);
        const existing = w.tasks.find(
          (t) => t.source_type === body.source_type && t.source_ref === body.source_ref,
        );
        if (existing) return { task: existing, duplicate: true };
        if (!caller)
          throw new ProtocolError('No human identity exists for this integration workspace', 403);
        const triage = w.actors.find(
          (actor) =>
            actor.type === 'AGENT' && actor.handle === '@bot-triage' && actor.status !== 'OFFLINE',
        );
        const now = new Date().toISOString();
        const task = {
          ...body,
          id:
            w.next_task_id ??
            `NEX-${Math.max(104, ...w.tasks.map((t) => Number(t.id.split('-')[1]) || 0)) + 1}`,
          state: 'TRIAGE' as const,
          source_url: body.source_url ?? null,
          assignee_id: triage?.id ?? null,
          delegated_by_id: null,
          hop_count: 0,
          max_hops: 4,
          lock_token: null,
          confidence_score: null,
          live_activity_text: triage ? 'Analyzing incoming task' : null,
          created_at: now,
          updated_at: now,
        };
        w.tasks.push(task);
        if (triage && triage.status !== 'OFFLINE') triage.status = 'EXECUTING';
        event(
          w,
          task,
          caller,
          'STATE_CHANGE',
          `Ingested ${body.source_type.toLowerCase().replaceAll('_', ' ')} ${body.source_ref}`,
          { delivery_id: req.headers.get('x-github-delivery') ?? randomUUID() },
        );
        return { task, duplicate: false };
      },
      signed,
    );
  });
}
