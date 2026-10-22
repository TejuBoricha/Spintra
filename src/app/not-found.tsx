import type { Metadata } from "next";
import { ErrorState } from "@/components/error-state";
import { ButtonLink } from "@/components/ui/button";

// Without its own title the 404 showed the home page's, which is what a search result or a browser tab then lists.
export const metadata: Metadata = {
  title: "Page not found | Spintra",
  description: "This page does not exist or has moved. Browse Spintra's free tools and party games instead.",
  robots: { index: false, follow: true },
};

export default function NotFoundPage() {
  return (
    <ErrorState
      emoji="question_mark"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved. Check the address, or start from one of these."
    >
      <ButtonLink href="/tools" className="h-11 w-full">
        Browse tools
      </ButtonLink>
      <ButtonLink href="/" variant="outline" className="h-11 w-full">
        Go home
      </ButtonLink>
    </ErrorState>
  );
}
