import type { ReactNode } from "react";
import { toolMetadata } from "@/lib/tool-metadata";

export const metadata = toolMetadata("/tools/name-draw");

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
