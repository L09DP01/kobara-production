import { NextResponse } from 'next/server';
import { getMaintenanceState } from '@/lib/server/maintenance';
import { isMaintenanceActive } from '@/lib/maintenance-state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getMaintenanceState();
  return NextResponse.json(
    {
      active: isMaintenanceActive(state),
      announcement_enabled: state.announcement_enabled,
      scheduled_for: state.scheduled_for,
      title: state.title,
      message: state.message,
      maintenance_message: state.maintenance_message,
    },
    { headers: { 'Cache-Control': 'public, max-age=10, stale-while-revalidate=20' } },
  );
}
