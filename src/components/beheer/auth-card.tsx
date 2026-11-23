import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";

/** Centred card for the sign-in screens. */
export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-ink">
          <Logo size="lg" label="The Watch Cases" />
          <span className="text-xs font-semibold tracking-[0.2em] text-muted uppercase">Beheer</span>
        </div>
        <section className="rounded-card border border-line bg-paper p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {intro && <div className="mt-2 text-[15px] leading-relaxed text-body">{intro}</div>}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
