import { connection } from 'next/server';
import { AdminShell } from './admin-shell';

export const dynamic = 'force-dynamic';

export default async function SystemCoreLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <AdminShell>{children}</AdminShell>;
}
