import { TrustPage, trustMetadata } from "@/components/trust-page";
export function generateMetadata() { return trustMetadata("privacy"); }
export default function Page() { return <TrustPage kind="privacy" />; }
