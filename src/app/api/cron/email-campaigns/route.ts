import { NextResponse } from 'next/server';
import { CampaignService } from '@/lib/server/messaging/campaign-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await CampaignService.processDailyCampaignBatches();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      processedCampaigns: result.processedCampaigns,
      details: result.results,
    });
  } catch (error: any) {
    console.error('[Cron:EmailCampaigns] Error processing daily batches:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
