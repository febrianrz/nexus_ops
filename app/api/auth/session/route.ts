import { route } from '@/lib/api';
import { requestUser } from '@/lib/auth';
import { NextRequest } from 'next/server';
export async function GET(req: NextRequest) {
  return route(req, async () => ({ user: requestUser(req) ?? null }));
}
