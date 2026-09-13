type EnRouteMarkProps = {
  className?: string;
  size?: number;
  variant?: 'tile' | 'pwa';
};

/**
 * A clean route-shaped E: one continuous path that stays clear from navigation
 * size through to the installed PWA icon.
 */
export function EnRouteMark({ className, size = 32, variant = 'tile' }: EnRouteMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 64 64"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        fill="#14B8A6"
        height={variant === 'pwa' ? '64' : '60'}
        rx={variant === 'pwa' ? '0' : '18'}
        width={variant === 'pwa' ? '64' : '60'}
        x={variant === 'pwa' ? '0' : '2'}
        y={variant === 'pwa' ? '0' : '2'}
      />
      <path d="M20 16V48M20 16H44M20 32H37M20 48H44" stroke="white" strokeLinecap="round" strokeWidth="6" />
    </svg>
  );
}

export function EnRouteWordmark() {
  return <span className="text-lg font-bold tracking-tight text-ink">EnRoute</span>;
}
