import type { ReactNode } from "react";
import { ReturnToDiscovery } from "@/components/return-to-discovery";
export default function UniversityDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <ReturnToDiscovery />
      {children}
    </>
  );
}
