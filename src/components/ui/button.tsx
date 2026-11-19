import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Buttons from the design reference.
 *
 *  primary   cognac pill            "Open the configurator", "Design yours"
 *  light     white pill, dark text  hero, on photography
 *  outline   hairline pill, white   hero secondary, on photography
 *  dark      near-black, 3px radius newsletter "Sign up"
 *
 * Use `asChild` to render a link: <Button asChild><Link href=…>…</Link></Button>
 */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap transition-colors duration-200 ease-out-soft disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary: "rounded-pill bg-accent text-paper hover:bg-accent-strong",
        light: "rounded-pill bg-paper text-ink hover:bg-sand",
        outline: "rounded-pill border border-paper/50 text-paper hover:border-paper hover:bg-paper/10",
        dark: "rounded-card bg-ink text-paper hover:bg-espresso",
      },
      size: {
        sm: "min-h-10 px-6 text-[15px]",
        md: "min-h-12 px-7 text-base",
        lg: "min-h-[52px] px-[34px] text-[17px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
