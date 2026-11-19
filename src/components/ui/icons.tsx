import type { SVGProps } from "react";

/**
 * Line icons from the design reference (1.5–1.6 stroke, 24 grid).
 * Decorative by default: give the surrounding control an aria-label.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, strokeWidth = 1.6, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
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

export const MenuIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M3 8h18" />
    <path d="M3 16h18" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon size={22} {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
);

export const BagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 8h14l-1.2 12H6.2L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Icon>
);

export const ChevronIcon = (p: IconProps) => (
  <Icon size={14} strokeWidth={2.2} {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
);

export const EngraveIcon = (p: IconProps) => (
  <Icon strokeWidth={1.5} {...p}>
    <path d="M4 7h16v12H4z" />
    <path d="M8 11h8M8 15h5" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon strokeWidth={1.5} {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4.4l3 1.8" />
  </Icon>
);

export const TruckIcon = (p: IconProps) => (
  <Icon strokeWidth={1.5} {...p}>
    <path d="M3 8h11v8H3zM14 11h4l3 3v2h-7z" />
    <circle cx="7" cy="18" r="1.6" />
    <circle cx="17.5" cy="18" r="1.6" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon strokeWidth={1.5} {...p}>
    <path d="M12 3.5 19 6v6c0 4.2-3 7-7 8.5C8 19 5 16.2 5 12V6z" />
    <path d="M9.2 12.2 11 14l4-4.2" />
  </Icon>
);

export const InstagramIcon = (p: IconProps) => (
  <Icon size={19} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </Icon>
);

export const LinkedInIcon = (p: IconProps) => (
  <Icon size={19} {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M8 10.5V17M8 7.6v.1M12 17v-3.6a2 2 0 0 1 4 0V17" />
  </Icon>
);
