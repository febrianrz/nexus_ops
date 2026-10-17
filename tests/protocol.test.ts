import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import test from 'node:test';
import { authenticate, hashKey, publicActor } from '../lib/api';
import { delegate, ProtocolError } from '../lib/protocol';
import { seedWorkspace } from '../lib/seed';

test('handoff preserves context, increments depth and records the relay', () => {
  const w = seedWorkspace();
  const task = w.tasks.find((t) => t.id === 'NEX-102')!;
  const actor = w.actors.find((a) => a.id === 'coder')!;
  const context = structuredClone(task.context_payload);
  delegate(w, task, actor, '@bot-qa', 'Please verify this implementation.');
  assert.equal(task.assignee_id, 'qa');
  assert.equal(task.delegated_by_id, 'coder');
  assert.equal(task.hop_count, 2);
  assert.equal(task.state, 'EXECUTING');
  assert.deepEqual(task.context_payload, context);
  assert.equal(w.events.at(-1)?.event_type, 'DELEGATION');
});
test('the fourth handoff trips the breaker atomically and does not reassign execution', () => {
  const w = seedWorkspace();
  const task = w.tasks[0];
  task.hop_count = 3;
  task.lock_token = 'in-flight';
  const assignee = task.assignee_id;
  delegate(w, task, w.actors[0], '@bot-coder', 'Continue');
  assert.equal(task.hop_count, 4);
  assert.equal(task.state, 'WAITING_HUMAN');
  assert.equal(task.assignee_id, assignee);
  assert.equal(task.lock_token, null);
  assert.equal(w.events.at(-1)?.event_type, 'CIRCUIT_BREAKER');
  assert.throws(
    () => delegate(w, task, w.actors[0], '@bot-qa', 'Continue'),
    (e: unknown) => e instanceof ProtocolError && e.status === 409,
  );
  assert.equal(task.hop_count, 4);
});
test('unassigned agents cannot delegate another agent’s task', () => {
  const w = seedWorkspace();
  assert.throws(
    () =>
      delegate(
        w,
        w.tasks[0],
        w.actors.find((a) => a.id === 'qa')!,
        '@bot-coder',
        'Take over',
      ),
    (e: unknown) => e instanceof ProtocolError && e.status === 403,
  );
  assert.equal(w.tasks[0].hop_count, 0);
});
test('self-handoffs, offline actors, unknown handles and completed tasks are rejected without spending a hop', () => {
  const w = seedWorkspace();
  const t = w.tasks[0];
  assert.throws(() => delegate(w, t, w.actors[0], '@bot-triage', ''));
  assert.throws(() => delegate(w, t, w.actors[0], '@missing', ''));
  w.actors.find((a) => a.id === 'coder')!.status = 'OFFLINE';
  assert.throws(() => delegate(w, t, w.actors[0], '@bot-coder', ''));
  t.state = 'DONE';
  assert.throws(() => delegate(w, t, w.actors[0], '@bot-qa', ''));
  assert.equal(t.hop_count, 0);
});
test('human delegation enters human review', () => {
  const w = seedWorkspace();
  delegate(
    w,
    w.tasks[0],
    w.actors.find((a) => a.id === 'triage')!,
    '@admin',
    'Need your judgment',
  );
  assert.equal(w.tasks[0].state, 'WAITING_HUMAN');
  assert.equal(w.tasks[0].assignee_id, 'admin');
});
test('sequential relay cannot increment beyond the limit', () => {
  const w = seedWorkspace();
  const t = w.tasks[0];
  for (let i = 0; i < 4; i++)
    delegate(w, t, w.actors[0], t.assignee_id === 'coder' ? '@bot-qa' : '@bot-coder', 'Review');
  assert.equal(t.hop_count, 4);
  assert.equal(t.state, 'WAITING_HUMAN');
  assert.equal(
    w.events.filter((e) => e.task_id === t.id && e.event_type === 'CIRCUIT_BREAKER').length,
    1,
  );
});
test('external requests need a token even when the demo is enabled', () => {
  process.env.NEXUS_DEMO_MODE = 'true';
  const req = new NextRequest('http://localhost:3002/api/v1/workspace');
  assert.throws(
    () => authenticate(req, seedWorkspace()),
    (e: unknown) => e instanceof ProtocolError && e.status === 401,
  );
});
test('the old demo header cannot bypass session authentication', () => {
  process.env.NEXUS_DEMO_MODE = 'true';
  const good = new NextRequest('http://localhost:3002/api/v1/ingest', {
    method: 'POST',
    headers: { origin: 'http://localhost:3002', 'x-nexus-workspace': 'local' },
  });
  assert.throws(
    () => authenticate(good, seedWorkspace()),
    (error: unknown) => error instanceof ProtocolError && error.status === 401,
  );
  const evil = new NextRequest('http://localhost:3002/api/v1/ingest', {
    method: 'POST',
    headers: { origin: 'https://untrusted.example', 'x-nexus-workspace': 'local' },
  });
  assert.throws(() => authenticate(evil, seedWorkspace()));
});
test('agent tokens authenticate a scoped identity but cannot act as an administrator', () => {
  const w = seedWorkspace();
  const a = w.actors.find((a) => a.id === 'coder')!;
  a.api_key_hash = hashKey('test-secret');
  const req = new NextRequest('http://localhost:3002/api/v1/workspace', {
    headers: { authorization: 'Bearer test-secret' },
  });
  assert.equal(authenticate(req, w).id, 'coder');
  assert.throws(() => authenticate(req, w, true));
  a.status = 'OFFLINE';
  assert.throws(() => authenticate(req, w));
});
test('public identities never expose credential hashes or webhook configuration', () => {
  const w = seedWorkspace();
  const actor = { ...w.actors[1], api_key_hash: 'private', webhook_url: 'https://private.example' };
  const safe = publicActor(actor);
  assert.equal('api_key_hash' in safe, false);
  assert.equal('webhook_url' in safe, false);
  assert.equal(safe.handle, '@bot-triage');
});
