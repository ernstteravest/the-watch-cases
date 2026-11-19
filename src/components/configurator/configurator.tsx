"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  catalogResult,
  effectiveMaxLength,
  findProduct,
  validateConfiguration,
  validatePersonalization,
  type Catalog,
  type Configuration,
  type RenderProps,
} from "@/configurator/catalog";
import { decodeDesign, encodeDesign } from "@/configurator/design-link";
import { isEngravingPlacement } from "@/configurator/geometry/layout";
import { createLabels } from "@/configurator/labels";
import { isAnchorVisible } from "@/configurator/scene/camera";
import { layoutFor } from "@/configurator/scene/describeScene";
import type { SceneEvent, SceneStatusApi } from "@/configurator/scene/SceneStatus";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import { Button } from "@/components/ui/button";
import { downloadPreviewImage } from "./download-image";
import { OptionsPanel } from "./options-panel";
import { PreviewStage } from "./preview-stage";
import { useViewState } from "./use-view-state";

type Props = {
  locale: Locale;
  t: Dictionary["configurator"];
  /** Per model id: translated capacity and price lines. */
  modelMeta: Record<string, { capacity: string; price: string }>;
};

/** Entry point: shows a clear message if config/options.ts is invalid. */
export default function ConfiguratorRoot(props: Props) {
  if (!catalogResult.ok) {
    return (
      <p role="alert" className="container-page py-section text-body">
        {props.t.catalogError}
      </p>
    );
  }
  return <Configurator {...props} catalog={catalogResult.value} />;
}

function Configurator({ catalog, locale, t, modelMeta }: Props & { catalog: Catalog }) {
  const labels = useMemo(() => createLabels(catalog, locale), [catalog, locale]);

  // Start from the design in the URL (or the model chosen on a product page).
  const [initial] = useState(() => decodeDesign(catalog, new URLSearchParams(window.location.search)));
  const [configuration, setConfiguration] = useState<Configuration>(initial.configuration);
  const [name, setName] = useState(initial.name);
  const { view, showPreset, rotateBy } = useViewState(catalog);
  const [notices, setNotices] = useState<Record<string, SceneEvent>>({});
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [copied, setCopied] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  const product = findProduct(catalog, configuration.product) ?? catalog.products[0];
  const maxLength = effectiveMaxLength(catalog.personalization, product);
  const personalization = useMemo(
    () => validatePersonalization(name, catalog.personalization, product),
    [name, catalog, product],
  );

  // The preview keeps the last valid name while the customer is correcting it.
  const [lastValidName, setLastValidName] = useState(() => (personalization.ok ? personalization.value : ""));
  if (personalization.ok && personalization.value !== lastValidName) setLastValidName(personalization.value);

  const previewConfiguration = useMemo<Configuration>(
    () => ({ ...configuration, personalization: { ...configuration.personalization, text: lastValidName } }),
    [configuration, lastValidName],
  );
  const configurationOk = useMemo(
    () => validateConfiguration(catalog, previewConfiguration).ok,
    [catalog, previewConfiguration],
  );
  const renderProps = useMemo<RenderProps>(() => ({ configuration: previewConfiguration, view }), [previewConfiguration, view]);

  // Is the engraving visible from the current camera angle?
  const layout = useMemo(() => layoutFor(catalog, configuration.product), [catalog, configuration.product]);
  const placement = configuration.personalization.placement;
  const anchor = layout.engraving[isEngravingPlacement(placement) ? placement : "lid-inside"];
  const nameVisible = isAnchorVisible(layout, anchor, view);

  // First character typed: turn the box so the inside of the lid is in view.
  const hadName = useRef(name.trim().length > 0);
  useEffect(() => {
    const has = name.trim().length > 0;
    if (has && !hadName.current && !nameVisible) showPreset(catalog.presentation.personalizationView);
    hadName.current = has;
  }, [name, nameVisible, showPreset, catalog]);

  // Keep the design in the page URL (no new history entry per click).
  useEffect(() => {
    const id = setTimeout(() => {
      const params = encodeDesign(catalog, { configuration, name: personalization.ok ? personalization.value : lastValidName });
      const url = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState(window.history.state, "", url);
    }, 250);
    return () => clearTimeout(id);
  }, [catalog, configuration, personalization, lastValidName]);

  const status = useMemo<SceneStatusApi>(
    () => ({
      report: (event) => setNotices((n) => (n[event.code]?.message === event.message ? n : { ...n, [event.code]: event })),
      clear: (code) =>
        setNotices((n) => {
          if (!(code in n)) return n;
          const next = { ...n };
          delete next[code];
          return next;
        }),
    }),
    [],
  );
  const noticeTexts = Object.keys(notices).map((code) =>
    code === "FONT_FALLBACK" ? t.fontFallback : code === "HDRI_FALLBACK" ? t.lightingFallback : notices[code].message,
  );

  const nameErrors = personalization.ok
    ? []
    : personalization.issues.map((issue) => labels.personalizationIssue(issue, maxLength, Array.from(name.trim()).length));

  const summary =
    t.summary
      .replace("{model}", product.name)
      .replace("{exterior}", labels.color(configuration.exterior).toLowerCase())
      .replace("{interior}", labels.color(configuration.interior).toLowerCase()) +
    (lastValidName ? t.summaryName.replace("{name}", lastValidName) : "");

  const onDownload = useCallback(async () => {
    if (!playerRef.current) return;
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadPreviewImage(playerRef.current, catalog.presentation.background, `${t.fileName}-${product.id}`);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }, [catalog, product.id, t.fileName]);

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* Clipboard blocked: the address bar still holds the link. */
    }
  }, []);

  return (
    <div className="grid lg:h-[calc(100dvh-105px)] lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
      {/* Preview: sticky on phones so it stays in view while choosing. */}
      <div className="sticky top-0 z-10 aspect-[4/3] w-full sm:aspect-[16/10] border-b border-line lg:static lg:aspect-auto lg:h-full lg:border-b-0">
        <PreviewStage
          catalog={catalog}
          renderProps={renderProps}
          notices={noticeTexts}
          status={status}
          labels={labels}
          playerRef={playerRef}
          onRotate={rotateBy}
          onPreset={showPreset}
          texts={t}
        />
      </div>

      <aside aria-label={t.panelLabel} className="flex flex-col border-line bg-paper lg:min-h-0 lg:border-l">
        <div className="flex-1 px-[var(--spacing-gutter)] pt-6 pb-4 lg:overflow-y-auto lg:px-8 lg:pt-8">
          <h1 className="mb-6 text-h3 font-bold">{t.title}</h1>
          <OptionsPanel
            catalog={catalog}
            configuration={configuration}
            onChange={(update) => setConfiguration((c) => update(c))}
            name={name}
            nameErrors={nameErrors}
            nameVisible={nameVisible}
            onNameChange={setName}
            onShowLid={() => showPreset(catalog.presentation.personalizationView)}
            labels={labels}
            texts={t}
            modelMeta={modelMeta}
          />
        </div>

        <footer className="flex flex-col gap-3 border-t border-line bg-sand px-[var(--spacing-gutter)] py-5 lg:px-8">
          <p className="text-[15px] leading-snug">{summary}</p>
          <p className="text-sm text-muted">{modelMeta[product.id]?.price}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="dark"
              size="md"
              onClick={onDownload}
              disabled={downloading || !configurationOk}
              className="px-4"
            >
              {t.download}
            </Button>
            <Button
              type="button"
              variant="dark"
              size="md"
              onClick={onCopyLink}
              aria-live="polite"
              className="border border-ink bg-transparent px-4 text-ink hover:bg-ink hover:text-paper"
            >
              {copied ? t.copied : t.copyLink}
            </Button>
          </div>
          {downloadError && (
            <p role="alert" className="text-sm font-semibold text-accent">
              {t.downloadError}
            </p>
          )}
          <p className="text-sm text-muted">
            {t.savedNote} {t.orderSoon}
          </p>
        </footer>
      </aside>
    </div>
  );
}
