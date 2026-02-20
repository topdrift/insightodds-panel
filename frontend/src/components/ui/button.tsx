'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

/* ============================================
   MODERN BUTTON COMPONENT
   Variants: primary, secondary, danger, success, ghost, outline
   Sizes: xs, sm, md, lg
   Features: loading spinner, icon button
   ============================================ */

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost" | "outline";
type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "text-white font-semibold",
    "bg-gradient-to-r from-blue-500 to-accent",
    "hover:from-blue-400 hover:to-accent-light",
    "shadow-md hover:shadow-glow-purple",
    "border border-transparent",
    "active:scale-[0.98]",
  ].join(" "),
  secondary: [
    "text-white/90 font-medium",
    "bg-glass-light backdrop-blur-xl",
    "border border-glass-border-light",
    "hover:bg-glass-heavy hover:border-white/20",
    "shadow-glass-sm hover:shadow-glass",
    "active:scale-[0.98]",
  ].join(" "),
  danger: [
    "text-white font-semibold",
    "bg-gradient-to-r from-red-600 to-red-500",
    "hover:from-red-500 hover:to-red-400",
    "shadow-md hover:shadow-glow-red",
    "border border-transparent",
    "active:scale-[0.98]",
  ].join(" "),
  success: [
    "text-white font-semibold",
    "bg-gradient-to-r from-green-600 to-emerald-500",
    "hover:from-green-500 hover:to-emerald-400",
    "shadow-md hover:shadow-glow-green",
    "border border-transparent",
    "active:scale-[0.98]",
  ].join(" "),
  ghost: [
    "text-white/70 font-medium",
    "bg-transparent",
    "hover:bg-white/[0.06] hover:text-white",
    "border border-transparent",
    "active:scale-[0.98]",
  ].join(" "),
  outline: [
    "text-white/80 font-medium",
    "bg-transparent",
    "border border-white/[0.12]",
    "hover:bg-white/[0.05] hover:border-white/[0.20] hover:text-white",
    "active:scale-[0.98]",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs rounded-lg gap-1.5",
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-9 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-6 text-sm rounded-xl gap-2.5",
  icon: "h-9 w-9 rounded-xl p-0 justify-center",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      icon,
      iconPosition = "left",
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {children && size !== "icon" && (
              <span className="ml-1">{children}</span>
            )}
          </>
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className="flex-shrink-0">{icon}</span>
            )}
            {children}
            {icon && iconPosition === "right" && (
              <span className="flex-shrink-0">{icon}</span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
