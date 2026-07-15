import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";
import { ToolSeoSection } from "@/components/tool-seo-section";

export const metadata = toolMetadata("/tools/tournament");

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToolSeoSection href="/tools/tournament" />
    </>
  );
}
