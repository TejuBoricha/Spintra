import type { Metadata } from "next";
import type { ReactNode } from "react";

// The settings page itself is a client component and cannot export metadata.
// Settings are per-visitor (localStorage) — no value in search indexes.
export const metadata: Metadata = {
  title: "Settings | Spintra",
  description:
    "Manage your Spintra preferences: customize your display name, audio effects, visual themes, and local privacy settings stored in your browser.",
  robots: { index: false },
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
