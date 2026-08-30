import { NextResponse } from 'next/server';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  try {
    const { merchant } = await getCurrentUserAndMerchant();

    if (!merchant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Vérifier si kyc_profiles est validé
    let isApproved = merchant.kyc_status === 'approved';
    let currentKycStatus = merchant.kyc_status || 'not_started';

    if (!isApproved) {
      const { data: profile } = await supabase
        .from('kyc_profiles')
        .select('status')
        .eq('merchant_id', merchant.id)
        .maybeSingle();

      if (profile?.status === 'approved') {
        isApproved = true;
        currentKycStatus = 'approved';
        // Synchroniser merchants.kyc_status
        await supabase
          .from('merchants')
          .update({ kyc_status: 'approved', kyc_verified_at: new Date().toISOString(), current_environment: 'live' })
          .eq('id', merchant.id);
      }
    }

    if (!isApproved) {
      return NextResponse.json(
        { error: 'kyc_required', message: 'La vérification KYC est requise pour accéder à Production.' },
        { status: 403 }
      );
    }

    if (merchant.current_environment !== 'live') {
      await supabase
        .from('merchants')
        .update({ current_environment: 'live' })
        .eq('id', merchant.id);
    }

    return NextResponse.json({
      environment: 'live',
      canUseLive: true,
      kycStatus: currentKycStatus
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard/environment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { merchant } = await getCurrentUserAndMerchant();

    if (!merchant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (body.environment && body.environment !== 'live') {
      return NextResponse.json(
        { error: 'production_only', message: 'Utilisez test.kobara.app pour le Sandbox.' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Vérifier si kyc_profiles ou merchant est approuvé
    let isApproved = merchant.kyc_status === 'approved';
    if (!isApproved) {
      const { data: profile } = await supabase
        .from('kyc_profiles')
        .select('status')
        .eq('merchant_id', merchant.id)
        .maybeSingle();

      if (profile?.status === 'approved') {
        isApproved = true;
        await supabase
          .from('merchants')
          .update({ kyc_status: 'approved', kyc_verified_at: new Date().toISOString(), current_environment: 'live' })
          .eq('id', merchant.id);
      }
    }

    if (!isApproved) {
      return NextResponse.json(
        { 
          error: 'kyc_required', 
          message: 'Veuillez vérifier votre compte pour accéder à Production.'
        }, 
        { status: 403 }
      );
    }

    const { error: updateError } = await supabase
      .from('merchants')
      .update({ current_environment: 'live' })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error updating merchant environment:', updateError);
      return NextResponse.json({ error: 'Failed to update environment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, environment: 'live' });
  } catch (error) {
    console.error('Error in POST /api/dashboard/environment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
