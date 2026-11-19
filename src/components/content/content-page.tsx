import type { ReactNode } from "react";
import { site } from "@/config/site";
import { TextLink } from "@/components/ui/text-link";

/**
 * Simple text page in the house style: heading, intro, optional body and
 * an honest "coming soon" note until the real content is written.
 */
export function ContentPage({
  eyebrow,
  title,
  intro,
  notice,
  email,
  children,
  back,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  /** e.g. "This page will be completed soon." Omit once the page is finished. */
  notice?: string;
  /** Show the contact address with this label. */
  email?: string;
  children?: ReactNode;
  back?: { label: string; href: string };
}) {
  return (
    <article className="container-page py-section">
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h1 className="text-h1 font-bold text-accent">{title}</h1>
        {intro && <p className="mt-6 text-[17px] leading-[1.65] text-body md:text-lead">{intro}</p>}
        {email && (
          <p className="mt-6">
            <a
              href={`mailto:${site.email}`}
              className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent hover:text-accent-strong"
            >
              {email}: {site.email}
            </a>
          </p>
        )}
        {children}
        {notice && (
          <p className="mt-10 border-t border-line pt-6 text-[15px] text-muted" role="note">
            {notice}
          </p>
        )}
        {back && (
          <TextLink href={back.href} className="mt-4">
            {back.label}
          </TextLink>
        )}
      </div>
    </article>
  );
}
