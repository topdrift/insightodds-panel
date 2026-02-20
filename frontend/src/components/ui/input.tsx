'use client';

import * as React from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

/* ============================================
   MODERN INPUT COMPONENT
   Features: glass effect, floating label,
   error state with glow, search variant
   ============================================ */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  variant?: "default" | "search";
  icon?: React.ReactNode;
  inputSize?: "sm" | "md" | "lg";
  floating?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      hint,
      variant = "default",
      icon,
      inputSize = "md",
      floating = false,
      type,
      placeholder,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      setHasValue(!!e.target.value);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      props.onChange?.(e);
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs rounded-lg",
      md: "h-10 px-4 text-sm rounded-xl",
      lg: "h-12 px-4 text-base rounded-xl",
    };

    const isSearchVariant = variant === "search";
    const showFloatingLabel = floating && label;
    const isFloated = isFocused || hasValue || !!props.value || !!props.defaultValue;

    if (isSearchVariant) {
      return (
        <div className={cn("relative", className)}>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
          </div>
          <input
            ref={ref}
            id={inputId}
            type={type || "search"}
            placeholder={placeholder || "Search..."}
            className={cn(
              "w-full bg-glass backdrop-blur-sm border border-glass-border",
              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
              "focus:bg-glass-light focus:border-accent/40",
              "focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1),0_0_16px_rgba(139,92,246,0.08)]",
              "outline-none transition-all duration-200",
              "pl-10",
              sizeStyles[inputSize]
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
        </div>
      );
    }

    return (
      <div className={cn("space-y-1.5", className)}>
        {label && !floating && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}

        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <span className="text-[var(--color-text-muted)]">{icon}</span>
            </div>
          )}

          {showFloatingLabel && (
            <label
              htmlFor={inputId}
              className={cn(
                "absolute left-4 transition-all duration-200 pointer-events-none z-10",
                isFloated
                  ? "top-1 text-[10px] font-medium text-accent-light"
                  : "top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]"
              )}
            >
              {label}
            </label>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            placeholder={floating ? "" : placeholder}
            className={cn(
              "w-full bg-glass backdrop-blur-sm border border-glass-border",
              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
              "focus:bg-glass-light focus:border-accent/40",
              "focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1),0_0_16px_rgba(139,92,246,0.08)]",
              "outline-none transition-all duration-200",
              sizeStyles[inputSize],
              icon && "pl-10",
              floating && isFloated && "pt-4 pb-1",
              error && "border-red-500/50 focus:border-red-500/60 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.1),0_0_16px_rgba(239,68,68,0.08)]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
        </div>

        {error && (
          <p className="flex items-center gap-1 text-xs text-red-400 animate-slide-up">
            <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.75a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0v-3.5z" />
            </svg>
            {error}
          </p>
        )}

        {hint && !error && (
          <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

/* ============================================
   TEXTAREA COMPONENT
   ============================================ */

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = React.useId();
    const textareaId = id || generatedId;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "w-full rounded-xl px-4 py-3 text-sm",
            "bg-glass backdrop-blur-sm border border-glass-border",
            "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
            "focus:bg-glass-light focus:border-accent/40",
            "focus:shadow-[0_0_0_3px_rgba(139,92,246,0.1),0_0_16px_rgba(139,92,246,0.08)]",
            "outline-none transition-all duration-200 resize-none",
            error && "border-red-500/50",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-400 animate-slide-up">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
