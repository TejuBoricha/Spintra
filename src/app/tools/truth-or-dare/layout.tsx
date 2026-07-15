import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";
import { ToolSeoSection } from "@/components/tool-seo-section";

export const metadata = toolMetadata("/tools/truth-or-dare");

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ToolSeoSection href="/tools/truth-or-dare" />
    </>
  );
}
