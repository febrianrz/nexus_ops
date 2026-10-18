import { authenticate, publicActor, route } from '@/lib/api';
import { transactForRequest as transact } from '@/lib/workspace-scope';
import { NextRequest } from 'next/server';
import { sortTasks } from '@/lib/task-order';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  return route(req, () =>
    transact(req, (w) => {
      const caller = authenticate(req, w);
      const tasks =
        caller.type === 'HUMAN' ? w.tasks : w.tasks.filter((t) => t.assignee_id === caller.id);
      const taskIds = new Set(tasks.map((t) => t.id));
      return {
        tasks: sortTasks(tasks),
        projects: w.projects,
        events: w.events.filter((e) => taskIds.has(e.task_id)),
        actors: w.actors.filter((actor) => (actor.type === 'HUMAN' || actor.status !== 'OFFLINE')).map(publicActor),
        storage: process.env.DATABASE_URL ? 'postgresql' : 'local-demo',
      };
    }),
  );
}
