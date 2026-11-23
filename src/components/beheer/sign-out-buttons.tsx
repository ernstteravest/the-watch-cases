import { signOut, signOutEverywhere } from "@/app/beheer/actions/auth";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className ?? "cursor-pointer text-sm font-semibold text-accent underline-offset-4 hover:underline"}>
        Uitloggen
      </button>
    </form>
  );
}

export function SignOutEverywhereButton() {
  return (
    <form action={signOutEverywhere}>
      <button
        type="submit"
        className="inline-flex min-h-10 cursor-pointer items-center rounded-pill border border-line-strong px-5 text-sm font-semibold hover:border-ink"
      >
        Op alle apparaten uitloggen
      </button>
    </form>
  );
}
