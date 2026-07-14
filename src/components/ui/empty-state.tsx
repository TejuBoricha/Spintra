import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "bg-(--surface-panel) p-12 rounded-2xl text-center w-full border border-(--border-hairline) shadow-1 flex flex-col items-center gap-4",
        className
      )}
    >
      {icon && <div className="text-3xl">{icon}</div>}
      {title && <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>}
      {description && <p className="font-body text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
