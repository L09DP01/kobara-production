import { redirect } from 'next/navigation';

export default function DeveloperAccessPage() {
  redirect('/settings?tab=team');
}
