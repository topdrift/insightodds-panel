import { cn } from "@/lib/utils";

/* ============================================
   STATUS BADGE COMPONENT
   Variants: success, danger, warning, info, neutral
   Features: pulse animation for live/active states
   ============================================ */

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";
type BadgeSize = "sm" | "md";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  pulse?: boolean;
  dot?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-white/[0.08] text-white/80 border-white/[0.10]",
  success: "bg-green-500/12 text-green-400 border-green-500/20",
  warning: "bg-yellow-500/12 text-yellow-400 border-yellow-500/20",
  danger: "bg-red-500/12 text-red-400 border-red-500/20",
  info: "bg-blue-500/12 text-blue-400 border-blue-500/20",
  neutral: "bg-white/[0.05] text-[var(--color-text-muted)] border-white/[0.08]",
};

const dotColorMap: Record<BadgeVariant, string> = {
  default: "bg-white/60",
  success: "bg-green-400",
  warning: "bg-yellow-400",
  danger: "bg-red-400",
  info: "bg-blue-400",
  neutral: "bg-white/40",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export function Badge({
  className,
  variant = "default",
  size = "md",
  pulse = false,
  dot = false,
  icon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-semibold border tracking-wide",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                "absolute inset-0 rounded-full animate-ping opacity-75",
                dotColorMap[variant]
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex h-1.5 w-1.5 rounded-full",
              dotColorMap[variant]
            )}
          />
        </span>
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
