import Workspace from '@/components/workspace';
import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <Workspace user={user} />;
}
