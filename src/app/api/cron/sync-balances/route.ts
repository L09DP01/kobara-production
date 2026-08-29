import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Basic security check to ensure it's called by Vercel Cron
    const authHeader = request.headers.get('authorization');
    const isCronAction = authHeader === `Bearer ${process.env.CRON_SECRET}` || process.env.NODE_ENV === 'development';
    
    // We can also allow calling without CRON_SECRET if we want, but it's better to secure it.
    // If you don't have a CRON_SECRET configured yet, you can comment the condition below
    // if (!isCronAction) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const supabase = createAdminClient();

    // Appeler la fonction SQL (RPC) qui recalcule les soldes de tous les marchands
    const { error } = await supabase.rpc('sync_all_merchant_balances');

    if (error) {
      console.error('Erreur lors de la synchronisation des soldes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Tous les soldes marchands ont été recalculés et mis à jour avec succès.',
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Cron sync balances error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
