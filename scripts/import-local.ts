import { loadEnvConfig } from '@next/env';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { transact } from '../lib/store';
import type { Workspace } from '../lib/types';

loadEnvConfig(process.cwd());

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const source = path.resolve(process.argv[2] ?? '.data/workspace.json');
  const workspace = JSON.parse(await readFile(source, 'utf8')) as Workspace;
  if (
    !Array.isArray(workspace.actors) ||
    !Array.isArray(workspace.tasks) ||
    !Array.isArray(workspace.events)
  ) {
    throw new Error('Invalid workspace snapshot');
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const [counts] =
      await sql`SELECT (SELECT count(*) FROM actors) AS actors, (SELECT count(*) FROM tasks) AS tasks, (SELECT count(*) FROM task_events) AS events`;
    if (Number(counts.actors) || Number(counts.tasks) || Number(counts.events)) {
      throw new Error('Import requires an empty database; existing data was not changed');
    }
    await transact((state) => {
      state.actors = workspace.actors;
      state.tasks = workspace.tasks;
      state.events = workspace.events;
    });
    console.log(
      `Imported ${workspace.actors.length} actors, ${workspace.tasks.length} tasks, ${workspace.events.length} events`,
    );
  } finally {
    await sql.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Import failed');
    process.exit(1);
  });
