import { requirePartner } from '@/lib/server/partners/auth'; import { PartnerPortalShell } from '@/components/partners/partner-portal-shell';
export default async function AmbassadorPortalLayout({children}:{children:React.ReactNode}){const {account}=await requirePartner('ambassador');return <PartnerPortalShell role="ambassador" name={account.display_name}>{children}</PartnerPortalShell>}
