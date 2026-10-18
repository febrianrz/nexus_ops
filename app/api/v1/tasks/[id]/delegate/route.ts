import { route } from '@/lib/api';
import { ProtocolError } from '@/lib/protocol';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return route(req, async () => {
    void req;
    void ctx;
    throw new ProtocolError(
      'Delegation is handled by external workers through task telemetry.',
      410,
    );
  });
}
