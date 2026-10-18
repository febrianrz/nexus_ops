import { route } from '@/lib/api';
import { ProtocolError } from '@/lib/protocol';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  return route(req, async () => {
    void req;
    throw new ProtocolError('Worker registration is not supported. Use the task queue API.', 410);
  });
}
