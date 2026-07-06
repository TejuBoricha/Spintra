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
        "glass-card p-12 rounded-3xl text-center w-full border border-border shadow-xl flex flex-col items-center gap-4",
        className
      )}
    >
      {icon && <div className="text-3xl">{icon}</div>}
      {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
