import { loadEnvConfig } from '@next/env';
import { seedWorkspace } from '../lib/seed';
import { transact } from '../lib/store';
loadEnvConfig(process.cwd());
transact((workspace) => {
  if (workspace.actors.length || workspace.tasks.length || workspace.events.length) {
    console.log('Legacy integration workspace already contains data; nothing was added.');
    return;
  }
  Object.assign(workspace, seedWorkspace());
  console.log('Seeded the isolated legacy integration workspace. User workspaces are unchanged.');
})
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
