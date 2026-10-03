import { TrustPage, trustMetadata } from "@/components/trust-page";
export function generateMetadata() { return trustMetadata("mcp"); }
export default function Page() { return <TrustPage kind="mcp" />; }
