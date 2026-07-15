import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";
import { ToolSeoSection } from "@/components/tool-seo-section";

export const metadata = toolMetadata("/tools/coin-flip");

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToolSeoSection href="/tools/coin-flip" />
    </>
  );
}
