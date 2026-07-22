import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </IconBase>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 5h5v5" />
      <path d="m10 14 9-9" />
      <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </IconBase>
  );
}

export function SignalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="2" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" />
      <path d="M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" />
    </IconBase>
  );
}

export function StatusIcon({
  kind,
  ...props
}: IconProps & { kind: 'success' | 'warning' | 'danger' | 'unavailable' }) {
  if (kind === 'success') {
    return (
      <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16.5 9" />
      </IconBase>
    );
  }

  if (kind === 'warning') {
    return (
      <IconBase {...props}>
        <path d="M10.3 4.2 2.6 18a1.4 1.4 0 0 0 1.2 2h16.4a1.4 1.4 0 0 0 1.2-2L13.7 4.2a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </IconBase>
    );
  }

  if (kind === 'unavailable') {
    return (
      <IconBase {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </IconBase>
    );
  }

  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconBase>
  );
}
