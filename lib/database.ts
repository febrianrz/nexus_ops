import * as schema from '@/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const globals = globalThis as unknown as { nexusSql?: ReturnType<typeof postgres> };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  globals.nexusSql ??= postgres(process.env.DATABASE_URL, { max: 5 });
  return drizzle(globals.nexusSql, { schema });
}
