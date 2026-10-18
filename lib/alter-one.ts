import { z } from 'zod';

const profileSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  full_name: z.string().min(1).optional(),
  verified_email: z.boolean().optional(),
  email_verified: z.boolean().optional(),
  is_verified: z.boolean().optional(),
  verified: z.boolean().optional(),
}).passthrough();

const responseSchema = z.union([profileSchema, z.object({ data: profileSchema }), z.object({ user: profileSchema }), z.object({ data: z.object({ user: profileSchema }) })]);

function config() {
  const base = process.env.ALTER_ONE_URL ?? 'https://one.alterindonesia.com';
  const clientId = process.env.ALTER_ONE_CLIENT_ID;
  const clientSecret = process.env.ALTER_ONE_CLIENT_SECRET;
  const redirectUri = process.env.ALTER_ONE_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';
  if (!clientId || !clientSecret) throw new Error('Alter One OAuth is not configured');
  return { base, clientId, clientSecret, redirectUri };
}

export function authorizationUrl(state: string) {
  const { base, clientId, redirectUri } = config();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state });
  return `${base}/oauth/authorize?${params}`;
}

export async function alterOneProfile(code: string) {
  const { base, clientId, clientSecret, redirectUri } = config();
  const tokenResponse = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }),
    cache: 'no-store',
  });
  if (!tokenResponse.ok) throw new Error(`Alter One token exchange failed (${tokenResponse.status})`);
  const rawTokenBody = (await tokenResponse.json()) as { access_token?: unknown; data?: { access_token?: unknown } };
  const tokenBody = rawTokenBody.data ?? rawTokenBody;
  if (typeof tokenBody.access_token !== 'string' || !tokenBody.access_token) throw new Error('Alter One returned no access token');
  const profileResponse = await fetch(`${base}/api/user`, { headers: { authorization: `Bearer ${tokenBody.access_token}`, accept: 'application/json' }, cache: 'no-store' });
  if (!profileResponse.ok) throw new Error(`Alter One profile request failed (${profileResponse.status})`);
  const raw = await profileResponse.json();
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) throw new Error('Alter One returned an invalid profile');
  const payload = parsed.data as { data?: unknown; user?: unknown };
  const nested = payload.data && typeof payload.data === 'object' ? payload.data as { user?: unknown } : undefined;
  const profile = (payload.user ?? nested?.user ?? payload.data ?? parsed.data) as z.infer<typeof profileSchema>;
  return { email: profile.email.toLowerCase(), name: profile.name ?? profile.full_name ?? profile.email.split('@')[0] };
}
