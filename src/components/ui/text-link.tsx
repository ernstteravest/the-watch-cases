import Link from "@/components/ui/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "@/components/ui/icons";

/**
 * "Find your box ›" — a text link with a chevron that nudges on hover.
 * tone="accent" on light backgrounds, tone="light" on photography.
 */
type TextLinkProps = ComponentProps<typeof Link> & { tone?: "accent" | "light"; size?: "md" | "sm" };

export function TextLink({ tone = "accent", size = "md", className, children, ...props }: TextLinkProps) {
  return (
    <Link
      className={cn(
        "group inline-flex items-center gap-2 self-start font-semibold transition-colors",
        size === "md" ? "min-h-11 text-base" : "min-h-9 text-[15px]",
        tone === "accent" ? "text-accent hover:text-accent-strong" : "text-paper hover:text-on-photo-muted",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronIcon
        size={size === "md" ? 14 : 12}
        className="transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5"
      />
    </Link>
  );
}
