import * as React from "react";
import { cn } from "@/lib/utils";

/* ============================================
   GLASS CARD COMPONENT
   Variants: default, elevated, bordered, accent
   ============================================ */

type CardVariant = "default" | "elevated" | "bordered" | "accent";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
  noPadding?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: [
    "bg-glass backdrop-blur-xl",
    "border border-glass-border",
    "shadow-glass-sm",
  ].join(" "),
  elevated: [
    "bg-glass-light backdrop-blur-xl",
    "border border-glass-border-light",
    "shadow-glass",
  ].join(" "),
  bordered: [
    "bg-glass backdrop-blur-xl",
    "border border-glass-border-light",
    "shadow-glass-sm",
  ].join(" "),
  accent: [
    "bg-glass backdrop-blur-xl",
    "gradient-border",
    "shadow-glass",
  ].join(" "),
};

export function Card({
  className,
  variant = "default",
  hover = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  noPadding = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-300",
        variantStyles[variant],
        hover && "hover:bg-glass-light hover:shadow-card-hover hover:border-glass-border-light hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

export function CardHeader({ className, action, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-white/[0.06] px-5 py-4",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">{children}</div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-white tracking-tight", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[var(--color-text-secondary)]", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-white/[0.06] px-5 py-3",
        className
      )}
      {...props}
    />
  );
}
