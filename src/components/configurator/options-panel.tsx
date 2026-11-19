"use client";

import type { ReactNode } from "react";
import {
  effectiveMaxLength,
  findProduct,
  pieceColorChoices,
  surfaceSwatchHex,
  type Catalog,
  type Configuration,
} from "@/configurator/catalog";
import type { Labels } from "@/configurator/labels";
import { cn } from "@/lib/utils";
import { EngravingField } from "./engraving-field";
import { Swatches } from "./swatches";

export type PanelTexts = {
  model: string;
  leatherDetails: string;
  personalization: string;
  nameLabel: string;
  namePlaceholder: string;
  nameHelp: string;
  rules: string;
  showLid: string;
};

function Step({ index, title, value, children }: { index: number; title: string; value?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`step-${index}`} className="flex flex-col gap-4 border-t border-line py-6 first:border-t-0 first:pt-0">
      <header className="flex items-baseline gap-3">
        <span aria-hidden="true" className="text-[13px] font-bold tracking-[0.1em] text-accent">
          {String(index).padStart(2, "0")}
        </span>
        <h2 id={`step-${index}`} className="text-[17px] font-semibold">
          {title}
        </h2>
        {value && <span className="ml-auto text-[15px] text-muted">{value}</span>}
      </header>
      {children}
    </section>
  );
}

export function OptionsPanel({
  catalog,
  configuration,
  onChange,
  name,
  nameErrors,
  nameVisible,
  onNameChange,
  onShowLid,
  labels,
  texts,
  modelMeta,
}: {
  catalog: Catalog;
  configuration: Configuration;
  onChange: (update: (c: Configuration) => Configuration) => void;
  name: string;
  nameErrors: string[];
  nameVisible: boolean;
  onNameChange: (value: string) => void;
  onShowLid: () => void;
  labels: Labels;
  texts: PanelTexts;
  /** Per model: capacity line and price line, already translated. */
  modelMeta: Record<string, { capacity: string; price: string }>;
}) {
  const product = findProduct(catalog, configuration.product) ?? catalog.products[0];
  let step = 0;

  return (
    <div className="flex flex-col">
      <Step index={++step} title={texts.model}>
        <div role="radiogroup" aria-label={texts.model} className="grid grid-cols-2 gap-3">
          {catalog.products.map((p) => {
            const checked = configuration.product === p.id;
            return (
              <label
                key={p.id}
                className={cn(
                  "relative flex cursor-pointer flex-col gap-0.5 rounded-card border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent",
                  checked ? "border-ink bg-sand" : "border-line-strong hover:border-ink/40",
                )}
              >
                <input
                  type="radio"
                  name="product"
                  value={p.id}
                  checked={checked}
                  onChange={() => onChange((c) => ({ ...c, product: p.id }))}
                  className="sr-only"
                />
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{modelMeta[p.id]?.capacity}</span>
                <span className="text-sm text-muted">{modelMeta[p.id]?.price}</span>
              </label>
            );
          })}
        </div>
      </Step>

      {(["exterior", "interior"] as const).map((surface) => (
        <Step
          key={surface}
          index={++step}
          title={labels.surface(surface)}
          value={`${labels.color(configuration[surface])} · ${labels.material(catalog[surface].material)}`}
        >
          <Swatches
            name={surface}
            label={labels.surface(surface)}
            value={configuration[surface]}
            onChange={(v) => onChange((c) => ({ ...c, [surface]: v }))}
            options={catalog[surface].colors.map((id) => ({
              value: id,
              label: labels.color(id),
              hex: surfaceSwatchHex(catalog, surface, id),
            }))}
          />
        </Step>
      ))}

      <Step index={++step} title={texts.leatherDetails}>
        <div className="flex flex-col gap-6">
          {catalog.pieces.map((piece) => {
            const choice = configuration.pieces[piece.id] ?? piece.default;
            const choices = pieceColorChoices(catalog, configuration, piece.id);
            const selected = choices.find((c) => c.value === choice.color);
            const selectedLabel = selected
              ? selected.isMatch
                ? `${labels.match(selected.value)} (${labels.color(selected.colorId)})`
                : labels.color(selected.colorId)
              : "";
            return (
              <div key={piece.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-[15px] font-semibold">{labels.piece(piece.id)}</h3>
                  <span className="text-sm text-muted">{selectedLabel}</span>
                </div>
                {piece.materials.length > 1 && (
                  <div
                    role="radiogroup"
                    aria-label={labels.piece(piece.id)}
                    className="inline-flex self-start rounded-pill border border-line-strong p-0.5"
                  >
                    {piece.materials.map((m) => (
                      <label
                        key={m}
                        className="cursor-pointer has-[:focus-visible]:rounded-pill has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                      >
                        <input
                          type="radio"
                          name={`${piece.id}-material`}
                          value={m}
                          checked={choice.material === m}
                          onChange={() =>
                            onChange((c) => ({ ...c, pieces: { ...c.pieces, [piece.id]: { ...choice, material: m } } }))
                          }
                          className="peer sr-only"
                        />
                        <span className="block min-h-9 rounded-pill px-3.5 py-2 text-sm font-semibold text-body peer-checked:bg-ink peer-checked:text-paper">
                          {labels.material(m)}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <Swatches
                  name={`${piece.id}-color`}
                  label={labels.piece(piece.id)}
                  value={choice.color}
                  onChange={(v) =>
                    onChange((c) => ({ ...c, pieces: { ...c.pieces, [piece.id]: { ...choice, color: v } } }))
                  }
                  options={choices.map((c) => ({
                    value: c.value,
                    hex: c.hex,
                    isMatch: c.isMatch,
                    label: c.isMatch ? `${labels.match(c.value)} (${labels.color(c.colorId)})` : labels.color(c.colorId),
                  }))}
                />
              </div>
            );
          })}
        </div>
      </Step>

      {catalog.personalization.enabled && (
        <Step index={++step} title={texts.personalization}>
          <EngravingField
            value={name}
            maxLength={effectiveMaxLength(catalog.personalization, product)}
            errors={nameErrors}
            visibleInView={nameVisible}
            onChange={onNameChange}
            onShowLid={onShowLid}
            texts={{
              label: texts.nameLabel,
              placeholder: texts.namePlaceholder,
              help: texts.nameHelp,
              rules: texts.rules.replace("{max}", String(effectiveMaxLength(catalog.personalization, product))),
              showLid: texts.showLid,
            }}
          />
        </Step>
      )}
    </div>
  );
}
