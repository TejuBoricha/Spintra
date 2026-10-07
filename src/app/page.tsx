import type { Metadata } from "next";
import HomeClient from "./home-client";

// The home page itself is a client component (home-client.tsx), which cannot
// export metadata. This server page carries the one thing the home page needs
// that the root layout cannot give it: its own canonical address. Setting a
// canonical in the layout would hand "/" to every page that has none of its own.
// Title, description and share preview come from the root layout.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <HomeClient />;
}
