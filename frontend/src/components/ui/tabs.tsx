'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/* ============================================
   MODERN TAB COMPONENT
   Underline style with smooth indicator animation
   Used for match page sections
   ============================================ */

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'enclosed';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  variant = 'underline',
  size = 'md',
  fullWidth = false,
  className,
  ...props
}: TabsProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({});

  // Compute indicator position
  React.useEffect(() => {
    if (variant !== 'underline' || !containerRef.current) return;

    const activeIndex = tabs.findIndex((t) => t.id === activeTab);
    if (activeIndex === -1) return;

    const container = containerRef.current;
    const activeElement = container.children[activeIndex] as HTMLElement;

    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab, tabs, variant]);

  const sizeStyles = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-4',
    lg: 'text-base gap-5',
  };

  const tabSizeStyles = {
    sm: 'px-2.5 py-2',
    md: 'px-3 py-2.5',
    lg: 'px-4 py-3',
  };

  if (variant === 'pills') {
    return (
      <div
        className={cn(
          "flex items-center rounded-xl bg-white/[0.04] border border-white/[0.06] p-1",
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200",
                tabSizeStyles[size],
                fullWidth && "flex-1",
                isActive
                  ? "bg-gradient-to-r from-accent/80 to-blue-500/80 text-white shadow-md"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-white/[0.04]",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white/[0.06] text-[var(--color-text-muted)]"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'enclosed') {
    return (
      <div
        className={cn(
          "flex items-center border-b border-white/[0.06]",
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                "relative flex items-center justify-center gap-1.5 font-medium transition-all duration-200 border-b-2 -mb-px",
                tabSizeStyles[size],
                fullWidth && "flex-1",
                isActive
                  ? "border-accent text-white bg-white/[0.03]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-white/[0.10]",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive
                      ? "bg-accent/15 text-accent-light"
                      : "bg-white/[0.06] text-[var(--color-text-muted)]"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: underline variant with sliding indicator
  return (
    <div className={cn("relative", className)} {...props}>
      <div
        ref={containerRef}
        className={cn(
          "flex items-center border-b border-white/[0.06]",
          sizeStyles[size],
          fullWidth && "w-full"
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={cn(
                "relative flex items-center justify-center gap-1.5 pb-2.5 font-medium transition-all duration-200 whitespace-nowrap",
                tabSizeStyles[size],
                fullWidth && "flex-1",
                isActive
                  ? "text-white"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]",
                tab.disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    isActive
                      ? "bg-accent/15 text-accent-light"
                      : "bg-white/[0.06] text-[var(--color-text-muted)]"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sliding indicator */}
      <div
        className="absolute bottom-0 h-[2px] rounded-full bg-gradient-to-r from-accent to-blue-500 transition-all duration-300 ease-out"
        style={indicatorStyle}
      />
    </div>
  );
}

/* ============================================
   TAB PANEL - Content container for each tab
   ============================================ */

interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tabId: string;
  activeTab: string;
  unmountOnHide?: boolean;
}

export function TabPanel({
  tabId,
  activeTab,
  unmountOnHide = false,
  children,
  className,
  ...props
}: TabPanelProps) {
  const isActive = tabId === activeTab;

  if (unmountOnHide && !isActive) return null;

  return (
    <div
      role="tabpanel"
      className={cn(
        "transition-all duration-200",
        isActive
          ? "opacity-100 animate-fade-in"
          : "opacity-0 hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
