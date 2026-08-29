import { BillingClient } from "./billing-client";

export const metadata = {
  title: 'Facturation & Plans - Dashboard Kobara',
  description: 'Gérez votre abonnement et vos factures',
};

export default function BillingPage() {
  return <BillingClient />;
}
