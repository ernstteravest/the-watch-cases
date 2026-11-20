"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  catalogResult,
  defaultRenderProps,
  effectiveMaxLength,
  findProduct,
  validateConfiguration,
  validatePersonalization,
  validateRenderProps,
  type Catalog,
  type Configuration,
  type RenderProps,
} from "@/configurator/catalog";
import { decodeDesign, encodeDesign } from "@/configurator/design-link";
import { isEngravingPlacement } from "@/configurator/geometry/layout";
import { createLabels } from "@/configurator/labels";
import { useLogo } from "@/configurator/logo/useLogo";
import { isAnchorVisible } from "@/configurator/scene/camera";
import { layoutFor, logoAnchorFor } from "@/configurator/scene/describeScene";
import type { SceneEvent, SceneStatusApi } from "@/configurator/scene/SceneStatus";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/nl";
import Link from "next/link";
import { addToCart, type CartLogo } from "@/lib/cart/cart";
import { Button } from "@/components/ui/button";
import { describeDesign } from "./describe";
import { downloadPreviewImage } from "./download-image";
import { OptionsPanel } from "./options-panel";
import { PreviewStage } from "./preview-stage";
import { useViewState } from "./use-view-state";

type Props = {
  locale: Locale;
  t: Dictionary["configurator"];
  cart: { texts: Dictionary["cart"]; href: string };
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

function Configurator({ catalog, locale, t, modelMeta, cart }: Props & { catalog: Catalog }) {
  const labels = useMemo(() => createLabels(catalog, locale), [catalog, locale]);

  // Start from the design in the URL (or the model chosen on a product page).
  const [initial] = useState(() => decodeDesign(catalog, new URLSearchParams(window.location.search)));
  const [configuration, setConfiguration] = useState<Configuration>(initial.configuration);
  const [name, setName] = useState(initial.name);
  const { view, showPreset, rotateBy } = useViewState(catalog);
  const logo = useLogo(catalog);
  const { upload } = logo;
  // Stable, so the paste listener isn't re-attached on every render.
  // The configurator keeps a prepared copy of the logo; for printing we also keep
  // the file exactly as the customer uploaded it.
  const pendingFile = useRef<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const uploadLogo = useCallback(
    (file: File) => {
      pendingFile.current = file;
      void upload(file);
    },
    [upload],
  );
  const uploaded = logo.state.upload;
  const [seenUpload, setSeenUpload] = useState(uploaded);
  if (uploaded !== seenUpload) {
    setSeenUpload(uploaded);
    setOriginalFile(uploaded ? pendingFile.current : null);
  }
  const [cartState, setCartState] = useState<"idle" | "adding" | "added" | "full" | "storage">("idle");
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

  // The preview keeps the last valid name while the customer is correcting it,
  // unless that name no longer fits (e.g. after switching to the shorter Duo).
  const [lastValidName, setLastValidName] = useState(() => (personalization.ok ? personalization.value : ""));
  if (personalization.ok && personalization.value !== lastValidName) setLastValidName(personalization.value);
  else if (!personalization.ok && lastValidName && !validatePersonalization(lastValidName, catalog.personalization, product).ok) {
    setLastValidName("");
  }

  const logoChoice = logo.choice;
  const previewConfiguration = useMemo<Configuration>(
    () => ({
      ...configuration,
      personalization: { ...configuration.personalization, text: lastValidName },
      ...(logoChoice ? { logo: logoChoice } : {}),
    }),
    [configuration, lastValidName, logoChoice],
  );
  const configurationOk = useMemo(
    () => validateConfiguration(catalog, previewConfiguration).ok,
    [catalog, previewConfiguration],
  );
  // The 3D preview only ever receives valid props; otherwise it keeps the last valid ones.
  const [lastValidProps, setLastValidProps] = useState<RenderProps>(() => defaultRenderProps(catalog));
  const candidateProps = useMemo<RenderProps>(() => ({ configuration: previewConfiguration, view }), [previewConfiguration, view]);
  const candidateOk = useMemo(() => validateRenderProps(catalog, candidateProps).ok, [catalog, candidateProps]);
  if (candidateOk && candidateProps !== lastValidProps) setLastValidProps(candidateProps);
  const renderProps = candidateOk ? candidateProps : lastValidProps;

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

  // Logo chosen or uploaded: turn the box so the outside of the lid is in view.
  const logoAnchor = useMemo(() => logoAnchorFor(catalog, configuration.product), [catalog, configuration.product]);
  const logoVisible = isAnchorVisible(layout, logoAnchor, view);
  const shownLogo = useRef<string | null>(null);
  useEffect(() => {
    const key = logo.state.mode === "none" ? null : `${logo.artwork?.name ?? ""}/${logo.artwork?.dataUrl.length ?? 0}`;
    if (key !== null && key !== shownLogo.current && !logoVisible) showPreset(catalog.presentation.logoView);
    shownLogo.current = key;
  }, [logo.state.mode, logo.artwork, logoVisible, showPreset, catalog]);

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
    code === "FONT_FALLBACK"
      ? t.fontFallback
      : code === "HDRI_FALLBACK"
        ? t.lightingFallback
        : code === "LOGO_FALLBACK"
          ? t.logo.previewFailed
          : notices[code].message,
  );

  const nameErrors = personalization.ok
    ? []
    : personalization.issues.map((issue) => labels.personalizationIssue(issue, maxLength, Array.from(name.trim()).length));

  const summary = describeDesign(
    catalog,
    labels,
    t,
    { ...configuration, personalization: { ...configuration.personalization, text: lastValidName } },
    logo.state.mode === "none"
      ? null
      : logo.artwork
        ? { mode: logo.state.mode, color: logo.state.color, name: logo.artwork.name }
        : "pending",
  );
  const logoErrors = logo.state.issues.map((issue) => labels.logoIssue(issue));
  const canDownload = configurationOk && logo.complete && candidateOk && !downloading;
  const canAddToCart = configurationOk && candidateOk && personalization.ok && logo.complete && cartState !== "adding";

  const onAddToCart = useCallback(async () => {
    if (!personalization.ok) return;
    setCartState("adding");
    const choice = logo.choice;
    const artwork = logo.artwork;
    const cartLogo: CartLogo | null =
      choice && artwork
        ? {
            mode: choice.mode,
            ...(choice.mode === "one-color" ? { color: choice.color } : {}),
            name: artwork.name,
            format: artwork.format,
            width: artwork.width,
            height: artwork.height,
          }
        : null;
    const design: Configuration = {
      ...configuration,
      personalization: { ...configuration.personalization, text: personalization.value },
      ...(choice ? { logo: { ...choice, artwork: null } } : {}),
    };
    const files =
      artwork && cartLogo
        ? {
            original: originalFile ?? (await (await fetch(artwork.dataUrl)).blob()),
            originalName: originalFile?.name ?? artwork.name,
            preview: artwork.dataUrl,
          }
        : null;
    const result = await addToCart({ configuration: design, designUrl: window.location.href, logo: cartLogo }, files);
    setCartState(result.ok ? "added" : result.reason);
  }, [configuration, personalization, logo.choice, logo.artwork, originalFile]);

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
            logo={{
              state: logo.state,
              artwork: logo.artwork,
              errors: logoErrors,
              visibleInView: logoVisible,
              onModeChange: logo.setMode,
              onColorChange: logo.setColor,
              onRemoveBackgroundChange: logo.setRemoveBackground,
              onKeepInsideChange: logo.setKeepInside,
              onFile: uploadLogo,
              onPasteWithoutImage: logo.pastedWithoutImage,
              onRemove: logo.remove,
              onShowLogo: () => showPreset(catalog.presentation.logoView),
            }}
            labels={labels}
            texts={t}
            modelMeta={modelMeta}
            locale={locale}
          />
        </div>

        <footer className="flex flex-col gap-3 border-t border-line bg-sand px-[var(--spacing-gutter)] py-5 lg:px-8">
          <p className="text-[15px] leading-snug">{summary}</p>
          <p className="text-sm text-muted">{modelMeta[product.id]?.price}</p>
          <Button type="button" size="lg" onClick={onAddToCart} disabled={!canAddToCart} className="w-full">
            {cartState === "adding" ? cart.texts.adding : cart.texts.add}
          </Button>
          <p role="status" className="text-sm empty:hidden">
            {cartState === "added" && (
              <>
                <span className="font-semibold">{cart.texts.added}</span>{" "}
                <Link href={cart.href} className="font-semibold text-accent underline underline-offset-4">
                  {cart.texts.view}
                </Link>
              </>
            )}
            {cartState === "full" && <span className="font-semibold text-accent">{cart.texts.full}</span>}
            {cartState === "storage" && <span className="font-semibold text-accent">{cart.texts.storageError}</span>}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="dark"
              size="md"
              onClick={onDownload}
              disabled={!canDownload}
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
          {!logo.complete && !logo.state.reading && <p className="text-sm text-muted">{t.logo.needed}</p>}
          {downloadError && (
            <p role="alert" className="text-sm font-semibold text-accent">
              {t.downloadError}
            </p>
          )}
          <p className="text-sm text-muted">
            {t.savedNote}
          </p>
        </footer>
      </aside>
    </div>
  );
}
