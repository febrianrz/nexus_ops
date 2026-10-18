import { loadEnvConfig } from '@next/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';
loadEnvConfig(process.cwd());
const base = process.env.NEXUS_TEST_URL ?? 'http://localhost:3002';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const accounts: { id: string; actorId: string; cookie: string }[] = [];
async function account() {
  const password = randomBytes(24).toString('base64url');
  const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Attachment QA', email: `attachments-${randomBytes(8).toString('hex')}@example.test`, password, confirm_password: password }) });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  const result = { ...data.user, cookie: response.headers.get('set-cookie')!.split(';')[0] };
  accounts.push(result);
  return result;
}
async function json(cookie: string, path: string, body?: unknown) {
  const response = await fetch(base + '/api/v1' + path, { method: body ? 'POST' : 'GET', headers: { cookie, origin: base, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
async function main() {
  try {
    const owner = await account();
    const outsider = await account();
    const project = await json(owner.cookie, '/projects', { name: 'Attachment QA project' });
    let parent: string | null = null;
    let previousTask: string | null = null;
    for (let level = 0; level < 3; level++) {
      const created = await json(owner.cookie, '/ingest', { title: `Attachment level ${level + 1}`, project_id: project.project.id, source_type: 'MANUAL', source_ref: `attachment-${randomBytes(8).toString('hex')}`, parent_task_id: parent });
      const id = created.task.id;
      const path = `/api/v1/tasks/${id}/attachments`;
      const binary = new Uint8Array([0, 255, 1, 2]);
      const form = new FormData();
      form.append('files', new File(['<script>plain download</script>'], 'notes.html', { type: 'text/html' }));
      form.append('files', new File([binary], 'data.bin', { type: 'application/octet-stream' }));
      const uploaded = await fetch(base + path, { method: 'POST', headers: { cookie: owner.cookie, origin: base }, body: form });
      const data = await uploaded.json();
      assert.equal(uploaded.status, 201, JSON.stringify(data));
      assert.equal(data.attachments.length, 2);
      assert.equal('content' in data.attachments[0], false);
      const listed = await json(owner.cookie, path.slice('/api/v1'.length));
      assert.equal(listed.attachments.length, 2);
      const file = data.attachments.find((item: { filename: string }) => item.filename === 'data.bin');
      const download = await fetch(base + path + '/' + file.id, { headers: { cookie: owner.cookie } });
      assert.equal(download.status, 200);
      assert.deepEqual(new Uint8Array(await download.arrayBuffer()), binary);
      assert.ok(download.headers.get('content-disposition')?.startsWith('attachment;'));
      assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
      const [stored] = await sql`SELECT octet_length(content) AS bytes FROM task_attachments WHERE id = ${file.id}`;
      assert.equal(stored.bytes, 4);
      assert.equal((await fetch(base + path, { headers: { cookie: outsider.cookie } })).status, 403);
      assert.equal((await fetch(base + path + '/' + file.id, { headers: { cookie: outsider.cookie } })).status, 403);
      assert.equal((await fetch(base + path)).status, 401);
      assert.equal((await fetch(base + path, { method: 'POST', headers: { cookie: outsider.cookie, origin: base }, body: form })).status, 403);
      assert.equal((await fetch(base + path, { method: 'POST', headers: { cookie: owner.cookie, origin: 'https://untrusted.example' }, body: form })).status, 403);
      const tooMany = new FormData();
      for (let i = 0; i < 11; i++) tooMany.append('files', new File(['x'], `${i}.txt`));
      assert.equal((await fetch(base + path, { method: 'POST', headers: { cookie: owner.cookie, origin: base }, body: tooMany })).status, 422);
      assert.equal((await json(owner.cookie, path.slice('/api/v1'.length))).attachments.length, 2);
      if (previousTask) assert.equal((await fetch(`${base}/api/v1/tasks/${previousTask}/attachments/${file.id}`, { headers: { cookie: owner.cookie } })).status, 404);
      previousTask = id;
      parent = id;
    }
    console.log('PASS multiple uploads on three task levels, PostgreSQL binary persistence, download bytes, limits, CSRF and workspace isolation');
  } finally {
    for (const entry of accounts) await sql`DELETE FROM workspaces WHERE created_by = ${entry.id}`;
    for (const entry of accounts) {
      await sql`DELETE FROM users WHERE id = ${entry.id}`;
      await sql`DELETE FROM actors WHERE id = ${entry.actorId}`;
    }
    await sql.end();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
