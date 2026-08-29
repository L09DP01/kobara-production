import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import TeamClient from "./team-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Équipe | Kobara",
  description: "Gérez les membres de votre équipe.",
};

export default async function TeamPage() {
  const { merchant, userRole } = await getCurrentUserAndMerchant();

  if (userRole !== 'owner') {
    redirect("/dashboard");
  }

  const supabase = createAdminClient();
  
  const { data: members, error } = await supabase
    .from("merchant_members")
    .select("*")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load team members:", error);
  }

  return <TeamClient initialMembers={members || []} />;
}
