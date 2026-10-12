import type { SVGProps } from 'react';

/**
 * Inline SVG icon set — no emoji, no icon-font dependency.
 * Icons are decorative by default (aria-hidden); the surrounding button or
 * link carries the accessible name.
 */
export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v13a1.75 1.75 0 0 0-1.75-1.75H5.5A1.5 1.5 0 0 1 4 15.75z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v13a1.75 1.75 0 0 1 1.75-1.75h4.75A1.5 1.5 0 0 0 20 15.75z" />
    </Icon>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 5.5H5a1 1 0 0 0-1 1V8a3 3 0 0 0 3 3h.5" />
      <path d="M16.5 5.5H19a1 1 0 0 1 1 1V8a3 3 0 0 1-3 3h-.5" />
      <path d="M12 13.5V17" />
      <path d="M8.5 20h7" />
      <path d="M9.5 20a2.5 2.5 0 0 1 2.5-3 2.5 2.5 0 0 1 2.5 3" />
    </Icon>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6.5" />
      <path d="M12 20V7" />
      <path d="M17 20v-9.5" />
    </Icon>
  );
}

export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3s4.5 3.8 4.5 8.2a4.5 4.5 0 0 1-9 0C7.5 9.6 8.4 8.3 9.3 7.4c0 1.6.6 2.6 1.5 3 .5-2.6.3-5.2 1.2-7.4z" />
      <path d="M12 21a5.5 5.5 0 0 0 5.5-5.5c0-.6-.1-1.2-.2-1.7M12 21a5.5 5.5 0 0 1-5.5-5.5c0-.6.1-1.2.2-1.7" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 6.5l8 5.5-8 5.5z" fill="currentColor" />
    </Icon>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </Icon>
  );
}

export function SwordsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 4H20v5.5L10 19.5l-5.5-5.5z" />
      <path d="M4 20l2.5-2.5" />
      <path d="M14.5 9.5L20 4" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 5.5l6.5 6.5-6.5 6.5" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </Icon>
  );
}
