import { TrustPage, trustMetadata } from "@/components/trust-page";
export function generateMetadata() { return trustMetadata("terms"); }
export default function Page() { return <TrustPage kind="terms" />; }
