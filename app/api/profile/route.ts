import { actors, users } from '@/db/schema';
import { route } from '@/lib/api';
import { database } from '@/lib/database';
import { hashPassword } from '@/lib/password';
import { ProtocolError } from '@/lib/protocol';
import { putObject } from '@/lib/object-storage';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { requestUser } from '@/lib/auth';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  return route(req, async () => {
    const user = requestUser(req);
    if (!user) throw new ProtocolError('Please sign in to continue', 401);
    const [profile] = await database().select({ id: users.id, name: users.name, email: users.email, avatar_url: actors.avatar_url }).from(users).innerJoin(actors, eq(actors.id, users.actor_id)).where(eq(users.id, user.id)).limit(1);
    return { profile };
  });
}
export async function PATCH(req: NextRequest) {
  return route(req, async () => {
    const user = requestUser(req);
    if (!user) throw new ProtocolError('Please sign in to continue', 401);
    const form = await req.formData();
    const name = String(form.get('name') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const password = String(form.get('password') ?? '');
    if (!name || !email.includes('@')) throw new ProtocolError('Name and email are required', 422);
    await database().update(users).set({ name, email }).where(eq(users.id, user.id));
    if (password) {
      if (password.length < 12) throw new ProtocolError('Password must be at least 12 characters', 422);
      await database().update(users).set({ password_hash: await hashPassword(password) }).where(eq(users.id, user.id));
    }
    const avatar = form.get('avatar');
    if (avatar instanceof File && avatar.size) {
      if (avatar.size > 5 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(avatar.type)) throw new ProtocolError('Avatar must be PNG, JPEG, WebP, or GIF up to 5 MB', 422);
      const url = await putObject(`avatars/${user.id}/${randomUUID()}`, new Uint8Array(await avatar.arrayBuffer()), avatar.type);
      if (url) await database().update(actors).set({ avatar_url: url }).where(eq(actors.id, user.actorId));
    }
    return { ok: true };
  });
}
