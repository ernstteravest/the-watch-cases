import { offersSeveralModels } from "@/catalog/availability";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { ClockIcon, EngraveIcon, ShieldIcon, TruckIcon } from "@/components/ui/icons";

const icons = [EngraveIcon, ClockIcon, TruckIcon, ShieldIcon];

/** Four selling points under the hero. 2×2 on phones, one row from tablet up. */
export function Reassurance({ t }: { t: Dictionary }) {
  const r = t.home.reassurance;
  return (
    <section aria-label={r.label} className="border-b border-line">
      <ul className="container-page grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {r.items.map((item, i) => {
          const Icon = icons[i];
          return (
            <li
              key={item.title}
              className="flex items-start gap-3 border-line py-5 max-sm:not-first:border-t sm:py-[26px] sm:nth-[2n]:border-l sm:nth-[2n]:pl-6 sm:nth-[n+3]:border-t lg:border-l lg:px-6 lg:nth-[n+3]:border-t-0 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0"
            >
              <Icon className="mt-0.5 flex-none text-accent" />
              <div>
                <p className="text-[15px] font-semibold">{item.title}</p>
                <p className="mt-0.5 text-sm text-muted">
                  {!offersSeveralModels && "textDuoOnly" in item ? item.textDuoOnly : item.text}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
