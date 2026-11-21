import { Fragment } from "react";

/** Thin espresso bar above the header. On phones only the first message shows. */
export function AnnouncementBar({ messages, label }: { messages: readonly string[]; label: string }) {
  return (
    <section aria-label={label} className="bg-espresso text-[12.5px] tracking-[0.04em] text-announce">
      <div className="container-page flex justify-center gap-x-7 gap-y-1 py-[9px] text-center">
        {messages.map((message, i) => (
          <Fragment key={message}>
            {i > 0 && (
              <span aria-hidden="true" className="hidden opacity-40 md:inline">
                ·
              </span>
            )}
            <span className={i > 0 ? "hidden md:inline" : undefined}>{message}</span>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
