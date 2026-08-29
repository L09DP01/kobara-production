import { redirect } from "next/navigation";

export default function KycStartPage() {
  // Redirection directe vers la page principale unifiée Didit KYC
  redirect('/dashboard/kyc');
}
