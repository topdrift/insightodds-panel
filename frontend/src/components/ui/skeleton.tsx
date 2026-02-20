import { cn } from "@/lib/utils";

/* ============================================
   SKELETON LOADING COMPONENTS
   Animated shimmer effect placeholders
   ============================================ */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("skeleton", className)}
      style={{
        width: width ? (typeof width === "number" ? `${width}px` : width) : undefined,
        height: height ? (typeof height === "number" ? `${height}px` : height) : undefined,
        ...style,
      }}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
  ...props
}: { lines?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-2.5", className)} {...props}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded-md"
          style={{ width: i === lines - 1 ? "60%" : `${85 + Math.random() * 15}%` }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-glass p-5 space-y-4",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      {/* Content */}
      <SkeletonText lines={2} />

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
  ...props
}: { rows?: number; cols?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-glass overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Table Header */}
      <div
        className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-3.5"
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3 rounded-md"
            style={{ width: `${60 + Math.random() * 40}px` }}
          />
        ))}
      </div>

      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="flex items-center gap-4 border-b border-white/[0.03] px-5 py-3.5"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className="h-3.5 rounded-md"
              style={{ width: `${50 + Math.random() * 60}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonOddsRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-glass px-4 py-3",
        className
      )}
      {...props}
    >
      {/* Team name */}
      <div className="flex-1">
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>

      {/* Back cells */}
      <div className="flex gap-1.5">
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.08)' }} />
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.06)' }} />
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(59, 130, 246, 0.04)' }} />
      </div>

      {/* Lay cells */}
      <div className="flex gap-1.5">
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(236, 72, 153, 0.04)' }} />
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(236, 72, 153, 0.06)' }} />
        <Skeleton className="h-10 w-16 rounded-lg" style={{ background: 'rgba(236, 72, 153, 0.08)' }} />
      </div>
    </div>
  );
}

export function SkeletonAvatar({
  size = "md",
  className,
  ...props
}: { size?: "sm" | "md" | "lg" } & React.HTMLAttributes<HTMLDivElement>) {
  const sizeMap = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" };
  return <Skeleton className={cn("rounded-full", sizeMap[size], className)} {...props} />;
}
