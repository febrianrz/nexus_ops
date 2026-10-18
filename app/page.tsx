import Workspace from '@/components/workspace';
import { currentUser } from '@/lib/current-user';
import LandingPage from '@/components/landing-page';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await currentUser();
  if (!user) return <LandingPage />;
  return <Workspace user={user} />;
}
