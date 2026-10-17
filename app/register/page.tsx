import AuthForm from '@/components/auth-form';
import { currentUser } from '@/lib/current-user';
import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function RegisterPage() {
  if (await currentUser()) redirect('/');
  return <AuthForm mode="register" />;
}
