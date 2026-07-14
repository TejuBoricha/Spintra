import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";

export const metadata = toolMetadata("/tools/truth-or-dare");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
