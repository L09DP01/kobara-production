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
          .update({ kyc_status: 'approved', kyc_verified_at: new Date().toISOString() })
          .eq('id', merchant.id);
      }
    }

    const canUseLive = isApproved;
    // Si approuvé, autoriser l'environnement choisi (ou live), sinon forcer test
    const environment = canUseLive ? (merchant.current_environment || 'live') : 'test';

    return NextResponse.json({
      environment,
      canUseLive,
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
    const requestedEnvironment = body.environment;

    if (!['test', 'live'].includes(requestedEnvironment)) {
      return NextResponse.json({ error: 'Invalid environment' }, { status: 400 });
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
          .update({ kyc_status: 'approved', kyc_verified_at: new Date().toISOString() })
          .eq('id', merchant.id);
      }
    }

    if (requestedEnvironment === 'live' && !isApproved) {
      return NextResponse.json(
        { 
          error: 'kyc_required', 
          message: 'Veuillez vérifier votre compte pour activer le Live Mode.' 
        }, 
        { status: 403 }
      );
    }

    // Mettre à jour current_environment
    const { error: updateError } = await supabase
      .from('merchants')
      .update({ current_environment: requestedEnvironment })
      .eq('id', merchant.id);

    if (updateError) {
      console.error('Error updating merchant environment:', updateError);
      return NextResponse.json({ error: 'Failed to update environment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, environment: requestedEnvironment });
  } catch (error) {
    console.error('Error in POST /api/dashboard/environment:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
