import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { CustomersClient } from "./customers-client";

export default async function CustomersPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  // Fetch all customers for this merchant with their payments
  const { data: dbCustomers } = await supabase
    .from('customers')
    .select(`
      *,
      payments (
        id,
        amount,
        net_amount,
        created_at,
        provider,
        payment_method,
        status,
        environment
      )
    `)
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test')
    .order('created_at', { ascending: false });

  const rawCustomers = dbCustomers || [];

  // Filter customers based on user rule:
  // A customer is valid ONLY IF they have at least one successful payment
  // OR if they have exactly 0 payments (meaning they were added manually via the dashboard).
  const currentEnv = merchant.current_environment || 'test';
  
  const validCustomers = rawCustomers.filter((c: any) => {
    // Keep only payments that match the current environment
    if (c.payments) {
      c.payments = c.payments.filter((p: any) => p.environment === currentEnv || p.environment === null);
    }
    
    const hasPayments = c.payments && c.payments.length > 0;
    if (!hasPayments) return true;
    
    return c.payments.some((p: any) => p.status === 'succeeded' || p.status === 'completed');
  });

  // Calculate statistics
  const totalClients = validCustomers.length;
  
  let activeClients = 0;
  let totalVolumeSucceeded = 0;

  const processedCustomers = validCustomers.map((c: any) => {
    // Only count succeeded payments for volume and activity
    const successfulPayments = c.payments ? c.payments.filter((p: any) => p.status === 'succeeded' || p.status === 'completed') : [];
    
    if (successfulPayments.length > 0) {
      activeClients++;
      const customerVolume = successfulPayments.reduce((sum: number, p: any) => sum + Number(p.net_amount || p.amount), 0);
      totalVolumeSucceeded += customerVolume;
    }
    
    return {
      ...c,
      payments: c.payments // keep all payments for history if needed, or just successful. Let's keep all for the table.
    };
  });

  const volumeMoyen = totalClients > 0 ? (totalVolumeSucceeded / totalClients) : 0;

  return (
    <CustomersClient 
      customers={processedCustomers} 
      stats={{
        totalClients,
        activeClients,
        volumeMoyen
      }}
    />
  );
}
