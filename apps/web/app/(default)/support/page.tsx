import { TrustPage, trustMetadata } from "@/components/trust-page";
export function generateMetadata() { return trustMetadata("support"); }
export default function Page() { return <TrustPage kind="support" />; }
