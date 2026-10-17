import { cookies } from 'next/headers';
import { SESSION_COOKIE, sessionUser } from './auth';
export async function currentUser() {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}
