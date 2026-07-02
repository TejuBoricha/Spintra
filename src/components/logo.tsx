interface LogoProps {
  size?: number;
  className?: string;
}

/** The Spintra sparkle mark — matches public/favicon.svg exactly. */
export function Logo({ size = 20, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label="Spintra"
      className={className}
    >
      <path
        d="M32 14l6.1 12.4L52 28.3l-10.4 9.9L43.5 52 32 44.4 20.5 52l2.1-13.8L12 28.3l13.9-1.9L32 14z"
        fill="currentColor"
      />
    </svg>
  );
}
