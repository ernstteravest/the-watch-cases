"use client";

import type { ReactNode } from "react";
import {
  effectiveMaxLength,
  findProduct,
  surfaceSwatchHex,
  type Catalog,
  type Configuration,
  type LogoArtwork,
} from "@/configurator/catalog";
import type { Labels } from "@/configurator/labels";
import type { LogoState } from "@/configurator/logo/useLogo";
import { cn } from "@/lib/utils";
import { EngravingField } from "./engraving-field";
import { LogoField, type LogoTexts } from "./logo-field";
import { Swatches } from "./swatches";

export type PanelTexts = {
  model: string;
  interiorFollowers: string;
  personalization: string;
  nameLabel: string;
  namePlaceholder: string;
  nameHelp: string;
  rules: string;
  showLid: string;
  logo: LogoTexts & { title: string; description: string };
};

export type LogoControls = {
  state: LogoState;
  artwork: LogoArtwork | null;
  errors: string[];
  visibleInView: boolean;
  onModeChange: (mode: LogoState["mode"]) => void;
  onColorChange: (color: string) => void;
  onRemoveBackgroundChange: (remove: boolean) => void;
  onKeepInsideChange: (keep: boolean) => void;
  onFile: (file: File) => void;
  onPasteWithoutImage: () => void;
  onRemove: () => void;
  onShowLogo: () => void;
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
        {value && <span className="ml-auto text-right text-[15px] text-muted">{value}</span>}
      </header>
      {children}
    </section>
  );
}

/**
 * Steps: model, exterior, interior, engraving, logo. Leather pieces are no
 * longer customer choices (configurator V2); the strap and snap cap follow
 * the interior colour, which the Interior step says.
 */
export function OptionsPanel({
  catalog,
  configuration,
  onChange,
  name,
  nameErrors,
  nameVisible,
  onNameChange,
  onShowLid,
  logo,
  labels,
  texts,
  modelMeta,
  locale,
}: {
  catalog: Catalog;
  configuration: Configuration;
  onChange: (update: (c: Configuration) => Configuration) => void;
  name: string;
  nameErrors: string[];
  nameVisible: boolean;
  onNameChange: (value: string) => void;
  onShowLid: () => void;
  logo: LogoControls;
  labels: Labels;
  texts: PanelTexts;
  /** Per model: capacity line and price line, already translated. */
  modelMeta: Record<string, { capacity: string; price: string }>;
  locale: string;
}) {
  const product = findProduct(catalog, configuration.product) ?? catalog.products[0];
  const followers = labels.interiorFollowers();
  const logoValue =
    logo.state.mode === "none"
      ? texts.logo.none
      : logo.state.mode === "one-color"
        ? `${texts.logo.oneColor} · ${labels.logoColor(logo.state.color)}`
        : texts.logo.fullColor;
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
          {surface === "interior" && followers && (
            <p className="-mt-1 text-sm text-muted">{texts.interiorFollowers.replace("{list}", followers)}</p>
          )}
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

      {catalog.logo.enabled && (
        <Step index={++step} title={texts.logo.title} value={logoValue}>
          <p className="-mt-1 text-sm text-muted">{texts.logo.description}</p>
          <LogoField
            rules={catalog.logo}
            product={product}
            exteriorHex={surfaceSwatchHex(catalog, "exterior", configuration.exterior)}
            state={logo.state}
            artwork={logo.artwork}
            errors={logo.errors}
            visibleInView={logo.visibleInView}
            onModeChange={logo.onModeChange}
            onColorChange={logo.onColorChange}
            onRemoveBackgroundChange={logo.onRemoveBackgroundChange}
            onKeepInsideChange={logo.onKeepInsideChange}
            onFile={logo.onFile}
            onPasteWithoutImage={logo.onPasteWithoutImage}
            onRemove={logo.onRemove}
            onShowLogo={logo.onShowLogo}
            labels={labels}
            texts={texts.logo}
            locale={locale}
          />
        </Step>
      )}
    </div>
  );
}
