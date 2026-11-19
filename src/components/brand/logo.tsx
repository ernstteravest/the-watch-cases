import { cn } from "@/lib/utils";

/**
 * Text wordmark: THE / WATCH CASES / AMSTERDAM in Archivo at 125% width.
 * "md" (header) is slightly smaller on phones so it never touches the icons.
 * Replace with an SVG file here once a final logo exists.
 */
export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <span className={cn("font-wide flex flex-col items-center leading-[1.2] font-normal whitespace-nowrap", className)}>
      <span className={cn("tracking-[0.5em] ps-[0.5em]", lg ? "text-[10px]" : "text-[8px] sm:text-[9px]")}>THE</span>
      <span className={cn("tracking-[0.26em] ps-[0.26em]", lg ? "text-[22px]" : "text-[14px] sm:text-[18px]")}>
        WATCH CASES
      </span>
      <span className={cn("tracking-[0.62em] ps-[0.62em]", lg ? "text-[9px]" : "text-[7px] sm:text-[8px]")}>
        AMSTERDAM
      </span>
    </span>
  );
}
