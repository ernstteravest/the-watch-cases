"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Slide-in panel (shadcn/ui "Sheet" pattern on Radix Dialog): focus is trapped
 * while open, Escape and the overlay close it, focus returns to the trigger.
 */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
  closeLabel: string;
};

export function SheetContent({ side = "left", closeLabel, className, children, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim/50 data-[state=closed]:animate-[fade-out_200ms_ease-in] data-[state=open]:animate-[fade-in_300ms_ease-out]" />
      <SheetPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex w-full max-w-[420px] flex-col bg-paper shadow-2xl outline-none",
          side === "left"
            ? "left-0 data-[state=closed]:animate-[sheet-out-left_220ms_ease-in] data-[state=open]:animate-[sheet-in-left_380ms_var(--ease-out-soft)]"
            : "right-0 data-[state=closed]:animate-[sheet-out-right_220ms_ease-in] data-[state=open]:animate-[sheet-in-right_380ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          aria-label={closeLabel}
          className="absolute top-3 right-3 grid size-11 cursor-pointer place-items-center text-ink hover:text-accent"
        >
          <CloseIcon />
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
