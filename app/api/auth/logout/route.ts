import { route } from '@/lib/api';
import { assertSameOrigin, revokeSession, SESSION_COOKIE, setSessionCookie } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest) {
  return route(req, async () => {
    assertSameOrigin(req);
    await revokeSession(req.cookies.get(SESSION_COOKIE)?.value);
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, req, '', 0);
    return response;
  });
}
