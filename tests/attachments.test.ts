import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachmentError, attachmentName, MAX_ATTACHMENT_SIZE } from '../lib/attachments';

test('multiple attachment uploads enforce file count, individual and combined size limits', () => {
  assert.equal(attachmentError([{ size: 0 }, { size: 2048 }]), null);
  assert.ok(attachmentError([]));
  assert.ok(attachmentError(Array.from({ length: 11 }, () => ({ size: 1 }))));
  assert.ok(attachmentError([{ size: MAX_ATTACHMENT_SIZE + 1 }]));
  assert.ok(attachmentError(Array.from({ length: 3 }, () => ({ size: MAX_ATTACHMENT_SIZE }))));
  assert.equal(attachmentError([{ size: MAX_ATTACHMENT_SIZE }]), null);
});
test('attachment names cannot retain path segments, control characters, or an unbounded filename', () => {
  assert.equal(attachmentName('../../report.pdf'), 'report.pdf');
  assert.equal(attachmentName('C:\\uploads\\report.pdf'), 'report.pdf');
  assert.equal(attachmentName('evil\r\nname.txt'), 'evilname.txt');
  assert.equal(attachmentName('   '), 'attachment');
  assert.equal(attachmentName('x'.repeat(1000)).length, 255);
});
