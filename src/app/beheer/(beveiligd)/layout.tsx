import NextLink from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { SignOutButton } from "@/components/beheer/sign-out-buttons";

/** Frame for every page behind the login. Each page checks access again. */
export default async function ProtectedLayout({ children }: LayoutProps<"/beheer">) {
  const { admin } = await requireAdmin();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-espresso text-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <NextLink href="/beheer" prefetch={false} className="flex items-baseline gap-2">
            <span className="font-wide text-[15px] tracking-[0.2em]">THE WATCH CASES</span>
            <span className="text-xs font-semibold tracking-[0.2em] text-cream-faint uppercase">Beheer</span>
          </NextLink>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-cream-muted sm:inline">
              {admin.name} · {admin.roleName}
            </span>
            <SignOutButton className="cursor-pointer font-semibold text-cream underline-offset-4 hover:underline" />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
