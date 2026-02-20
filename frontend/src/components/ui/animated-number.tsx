'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

/* ============================================
   ANIMATED NUMBER DISPLAY
   Smoothly animates between number values
   Shows green/red flash on change
   Format options: currency, decimal, percentage
   ============================================ */

type NumberFormat = 'currency' | 'decimal' | 'percentage' | 'integer';

interface AnimatedNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  format?: NumberFormat;
  decimals?: number;
  duration?: number;
  colorCode?: boolean;
  flash?: boolean;
  prefix?: string;
  suffix?: string;
  locale?: string;
  currency?: string;
}

function formatValue(
  value: number,
  format: NumberFormat,
  decimals: number,
  locale: string,
  currencyCode: string
): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value / 100);
    case 'integer':
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'decimal':
    default:
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value);
  }
}

export function AnimatedNumber({
  value,
  format = 'decimal',
  decimals = 2,
  duration = 300,
  colorCode = false,
  flash = true,
  prefix,
  suffix,
  locale = 'en-IN',
  currency: currencyCode = 'INR',
  className,
  ...props
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [flashClass, setFlashClass] = useState<string | null>(null);
  const prevValueRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(value);

  const animate = useCallback(
    (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      const current =
        startValueRef.current + (value - startValueRef.current) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    },
    [value, duration]
  );

  useEffect(() => {
    const prevValue = prevValueRef.current;

    if (prevValue !== value) {
      // Flash effect
      if (flash && prevValue !== 0) {
        const direction = value > prevValue ? 'up' : 'down';
        setFlashClass(direction === 'up' ? 'animate-flash-green' : 'animate-flash-red');
        const timer = setTimeout(() => setFlashClass(null), 600);

        // Cleanup timeout
        return () => clearTimeout(timer);
      }

      // Start animation
      startValueRef.current = prevValue;
      startTimeRef.current = null;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(animate);
      prevValueRef.current = value;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [value, flash, animate]);

  // Initial mount
  useEffect(() => {
    setDisplayValue(value);
    prevValueRef.current = value;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const formattedValue = formatValue(displayValue, format, decimals, locale, currencyCode);

  const colorClass = colorCode
    ? value > 0
      ? 'text-profit'
      : value < 0
        ? 'text-loss'
        : 'text-[var(--color-text-secondary)]'
    : '';

  return (
    <span
      className={cn(
        'tabular-nums inline-block transition-colors duration-200',
        colorClass,
        flashClass,
        className
      )}
      {...props}
    >
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}

/* ============================================
   ODDS DISPLAY - Specialized for odds values
   ============================================ */

interface OddsDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  odds: number;
  size?: number;
  prevOdds?: number;
}

export function OddsDisplay({
  odds,
  size,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  prevOdds: _prevOdds,
  className,
  ...props
}: OddsDisplayProps) {
  const [flashClass, setFlashClass] = useState<string | null>(null);
  const prevOddsRef = useRef(odds);

  useEffect(() => {
    if (prevOddsRef.current !== odds) {
      const direction = odds > prevOddsRef.current ? 'up' : 'down';
      setFlashClass(direction === 'up' ? 'animate-flash-green' : 'animate-flash-red');
      const timer = setTimeout(() => setFlashClass(null), 600);
      prevOddsRef.current = odds;
      return () => clearTimeout(timer);
    }
  }, [odds]);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg px-2 py-1.5 transition-all duration-200',
        flashClass,
        className
      )}
      {...props}
    >
      <span className="text-sm font-bold tabular-nums text-white">
        {odds.toFixed(2)}
      </span>
      {size !== undefined && (
        <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
          {size.toLocaleString('en-IN')}
        </span>
      )}
    </div>
  );
}
