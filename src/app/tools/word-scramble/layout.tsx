import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";

export const metadata = toolMetadata("/tools/word-scramble");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
