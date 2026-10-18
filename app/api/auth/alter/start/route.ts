import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { authorizationUrl } from '@/lib/alter-one';
import { ProtocolError } from '@/lib/protocol';

export async function GET(req: NextRequest) {
  try {
    const state = randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(authorizationUrl(state));
    response.cookies.set('alter_one_oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: req.nextUrl.protocol === 'https:', path: '/auth/callback', maxAge: 600 });
    return response;
  } catch {
    return NextResponse.json({ error: 'Alter One login is not configured' }, { status: 503 });
  }
}
