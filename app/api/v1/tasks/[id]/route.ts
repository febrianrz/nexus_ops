import { assignTask } from '@/lib/task-assignment';
import { authenticate, route } from '@/lib/api';
import { event, ProtocolError } from '@/lib/protocol';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { planningContextInput, planningPatchInput } from '@/lib/task-planning-input';
import { canReorderTask, reorderTaskList } from '@/lib/task-order';
const assigneeInput = z.object({ action: z.literal('set-assignee'), assignee_id: z.string().min(1).nullable() }).strict();
const checklistInput = z.object({ action: z.literal('update-checklist'), checklist: z.array(z.object({ id: z.string().min(1).max(80), text: z.string().trim().min(1).max(240), completed: z.boolean() }).strict()).max(50) }).strict();
const descriptionInput = z.object({ action: z.literal('update-description'), description: z.string().max(10000) }).strict();
const reorderInput = z.object({ action: z.literal('reorder'), target_id: z.string().min(1), placement: z.enum(['before', 'after']) }).strict();
const priorityInput = z.object({ action: z.literal('set-priority'), priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']) }).strict();
const input = z
  .object({
    action: z.enum(['approve', 'resume', 'queue', 'set-status']),
    state: z.enum(['TRIAGE', 'EXECUTING', 'WAITING_HUMAN', 'DONE']).optional(),
    title: z.string().min(3).max(180).optional(),
  })
  .strict()
  .refine((body) => body.action !== 'set-status' || body.state !== undefined, {
    message: 'Choose a task status',
    path: ['state'],
  });
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    const body = z.union([assigneeInput, checklistInput, input, planningPatchInput, priorityInput, reorderInput, descriptionInput]).parse(await req.json());
    const { id } = await ctx.params;
    return transact(req, (w) => {
      const actor = authenticate(req, w, true);
      const task = w.tasks.find((t) => t.id === id);
      if (!task) throw new ProtocolError('Task not found', 404);
      if (body.action === 'set-assignee') {
        if (task.assignee_id === body.assignee_id && (body.assignee_id !== null || !task.is_agent_task)) return task;
        assignTask(w, task, body.assignee_id);
        event(w, task, actor, 'COMMENT', `Assignment updated by ${actor.display_name}.`, { assignee_id: task.assignee_id });
        return task;
      }
      if (body.action === 'update-checklist') {
        if (!task.parent_task_id || !w.tasks.some((item) => item.id === task.parent_task_id && item.parent_task_id)) throw new ProtocolError('Checklists are available on sub-subtasks', 422);
        task.context_payload = planningContextInput.parse({ ...task.context_payload, checklist: body.checklist, completion: null });
        task.updated_at = new Date().toISOString();
        event(w, task, actor, 'COMMENT', `Checklist updated by ${actor.display_name}.`, { checklist_count: body.checklist.length });
        return task;
      }
      if (body.action === 'update-description') {
        task.description = body.description;
        task.updated_at = new Date().toISOString();
        event(w, task, actor, 'COMMENT', `Description ${body.description ? 'updated' : 'cleared'} by ${actor.display_name}.`, { description_changed: true });
        return task;
      }
      if (body.action === 'reorder') {
        const target = w.tasks.find((item) => item.id === body.target_id);
        if (!target) throw new ProtocolError('Drop target not found', 404);
        if (!canReorderTask(task, target)) throw new ProtocolError('Move tasks within the same parent, project, and status group', 422);
        w.tasks = reorderTaskList(w.tasks, task, target, body.placement);
        return { task_id: task.id, target_id: target.id, placement: body.placement };
      }
      if (body.action === 'set-priority') {
        task.priority = body.priority;
        task.updated_at = new Date().toISOString();
        event(w, task, actor, 'COMMENT', `Priority ${body.priority === 'NONE' ? 'cleared' : `changed to ${body.priority}`} by ${actor.display_name}.`, { priority: body.priority });
        return task;
      }
      if (body.action === 'update-planning') {
        const { action: planningAction, ...changes } = body;
        void planningAction;
        if (changes.completion !== undefined && changes.completion !== null && w.tasks.some((item) => item.parent_task_id === task.id))
          throw new ProtocolError('Parent progress is calculated from its subtasks', 422);
        task.context_payload = planningContextInput.parse({ ...task.context_payload, ...changes });
        task.updated_at = new Date().toISOString();
        event(w, task, actor, 'COMMENT', `Schedule and progress updated by ${actor.display_name}.`, { planning: changes });
        return task;
      }
      if (body.action === 'approve' && task.state !== 'WAITING_HUMAN')
        throw new ProtocolError('Only tasks awaiting human review can be approved', 409);
      task.state = body.action === 'set-status'
        ? body.state!
        : body.action === 'approve' ? 'DONE' : body.action === 'queue' ? 'QUEUED' : 'EXECUTING';
      task.updated_at = new Date().toISOString();
      if (body.action === 'set-status') task.lock_token = null;
      if (body.action === 'resume') {
        task.hop_count = 0;
        task.lock_token = null;
      }
      if (body.action === 'queue' && task.is_agent_task) task.lock_token = null;
      if (body.title) task.title = body.title;
      task.live_activity_text =
        body.action === 'approve' || body.action === 'set-status' ? null : 'Human reviewed · ready to continue';
      const assignee = w.actors.find((candidate) => candidate.id === task.assignee_id);
      if (assignee?.type === 'AGENT') {
        assignee.status = w.tasks.some(
          (candidate) => candidate.assignee_id === assignee.id && candidate.state === 'EXECUTING',
        )
          ? 'EXECUTING'
          : 'IDLE';
      }
      event(
        w,
        task,
        actor,
        'STATE_CHANGE',
        body.action === 'set-status'
          ? `Status changed to ${task.state} by ${actor.display_name}.`
          : body.action === 'approve'
          ? `Approved & marked complete by ${actor.display_name}. Repository merge must be performed in GitHub.`
          : body.action === 'resume'
            ? 'Human resumed execution and reset the circuit breaker.'
            : 'Task added to the queue.',
        { state: task.state },
      );
      return task;
    });
  });
}
