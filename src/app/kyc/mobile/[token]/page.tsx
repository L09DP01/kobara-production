import { MobileStepperClient } from "./mobile-stepper";

export default async function MobileKycPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <MobileStepperClient token={token} />;
}
