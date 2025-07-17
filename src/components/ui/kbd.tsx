import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const kbdVariants = cva(
  "inline-flex place-items-center justify-center gap-1 rounded-md p-0.5",
  {
    variants: {
      variant: {
        outline: "border border-border bg-background text-muted-foreground",
        secondary: "bg-secondary text-muted-foreground",
        primary: "bg-primary text-primary-foreground",
      },
      size: {
        sm: "min-w-5 gap-1 p-0.5 px-0.5 text-xs",
        default: "min-w-6 gap-1.5 p-0.5 px-1 text-sm",
        lg: "min-w-8 gap-1.5 p-1 px-2",
        xl: "min-w-9 gap-2 p-1 px-3 text-lg",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "default",
    },
  },
);

export interface KbdProps
  extends React.ComponentProps<"kbd">,
    VariantProps<typeof kbdVariants> {}

export function Kbd({
  className,
  size = "default",
  variant = "outline",
  children,
  ...props
}: KbdProps) {
  return (
    <kbd className={cn(kbdVariants({ size, variant }), className)} {...props}>
      {children}
    </kbd>
  );
}

export { kbdVariants };
