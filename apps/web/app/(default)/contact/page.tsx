import { TrustPage, trustMetadata } from "@/components/trust-page";
export function generateMetadata() { return trustMetadata("contact"); }
export default function Page() { return <TrustPage kind="contact" />; }
