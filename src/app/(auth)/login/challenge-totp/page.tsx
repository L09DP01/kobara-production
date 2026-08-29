import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ChallengeTotpClient } from './challenge-totp-client';

export default async function ChallengeTotpPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return <ChallengeTotpClient userEmail={session.user.email || ''} />;
}
