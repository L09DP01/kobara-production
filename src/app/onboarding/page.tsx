import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect('/login');
  }

  const supabase = createAdminClient();

  // Check if merchant already exists and has completed onboarding
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, phone, category')
    .eq('user_id', user.id)
    .maybeSingle();

  if (merchant && merchant.phone && merchant.category) {
    // Already onboarded
    redirect('/dashboard');
  }

  return <OnboardingClient defaultEmail={user.email || ''} />;
}

