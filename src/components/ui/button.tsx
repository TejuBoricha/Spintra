import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-pill font-body font-semibold whitespace-nowrap transition-[transform,filter] duration-fast ease-standard outline-none select-none active:not-aria-[haspopup]:translate-y-px active:not-aria-[haspopup]:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:ring-3 aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-2 border-(--border-strong) bg-primary text-primary-foreground hover:brightness-95",
        brand:
          "border-2 border-(--border-strong) bg-(image:--gradient-brand) text-primary-foreground shadow-glow-primary-sm hover:brightness-95",
        contrast:
          "border-2 border-(--border-strong) bg-(--surface-contrast) text-(--text-on-contrast) hover:brightness-95 dark:hover:brightness-110",
        outline:
          "border-2 border-(--border-strong) bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_8%)]",
        ghost:
          "border border-transparent bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "border border-transparent bg-destructive/10 text-(--destructive-strong) hover:bg-destructive/20 focus-visible:ring-destructive/30",
        link: "border-none bg-transparent p-0 text-[var(--text-accent)] underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-7 gap-1 px-3 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3.5 text-[0.8rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 gap-2 px-7.5 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  icon,
  iconPosition = "start",
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    icon?: React.ReactNode
    iconPosition?: "start" | "end"
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {icon && iconPosition === "start" ? (
        <span data-icon="inline-start">{icon}</span>
      ) : null}
      {children}
      {icon && iconPosition === "end" ? (
        <span data-icon="inline-end">{icon}</span>
      ) : null}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
