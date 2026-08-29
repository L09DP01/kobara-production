import MessagingClient from './messaging-client';
import { getAdminSystemAudiences, getAdminCampaigns } from './actions';

export const dynamic = 'force-dynamic';

export default async function MessagingPage() {
  const [audiences, campaigns] = await Promise.all([
    getAdminSystemAudiences(),
    getAdminCampaigns(),
  ]);

  return (
    <MessagingClient
      initialAudiences={audiences}
      initialCampaigns={campaigns}
    />
  );
}
