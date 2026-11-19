"use client";

import { cn } from "@/lib/utils";

export type SwatchOption = { value: string; label: string; hex: string; isMatch?: boolean };

/** Leather colour chips as an accessible radio group (arrow keys move between colours). */
export function Swatches({
  name,
  label,
  options,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: SwatchOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const id = `${name}-${o.value.replace(/[^a-z0-9-]/gi, "_")}`;
        const checked = value === o.value;
        return (
          <label key={o.value} htmlFor={id} title={o.label} className="group relative cursor-pointer">
            <input
              id={id}
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={cn(
                "grid size-10 place-items-center rounded-pill border border-ink/15 ring-offset-2 ring-offset-paper transition-shadow",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-accent group-hover:ring-1 group-hover:ring-line-strong",
                checked && "ring-2 ring-ink group-hover:ring-2 group-hover:ring-ink",
              )}
              style={{ backgroundColor: o.hex }}
            >
              {o.isMatch && (
                <svg viewBox="0 0 16 16" width="14" height="14" className="text-paper mix-blend-difference">
                  <path
                    d="M6.5 9.5 9.5 6.5M5.5 7.3 4.2 8.6a2.3 2.3 0 0 0 3.2 3.2l1.3-1.3M10.5 8.7l1.3-1.3a2.3 2.3 0 0 0-3.2-3.2L7.3 5.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </span>
            <span className="sr-only">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
