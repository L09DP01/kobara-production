import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ChallengeEmailClient } from './challenge-email-client';

export default async function ChallengeEmailPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return <ChallengeEmailClient userEmail={session.user.email || ''} />;
}
