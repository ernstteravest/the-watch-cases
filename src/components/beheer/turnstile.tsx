"use client";

import { useEffect, useRef } from "react";

type TurnstileApi = {
  render: (el: HTMLElement, options: { sitekey: string; language?: string; appearance?: string }) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile check (adds a hidden "cf-turnstile-response" field to
 * the surrounding form). Renders nothing when no site key is configured.
 */
export function Turnstile({ siteKey }: { siteKey: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let id: string | null = null;
    let alive = true;
    loadScript()
      .then(() => {
        if (alive && ref.current && window.turnstile) {
          id = window.turnstile.render(ref.current, { sitekey: siteKey, language: "nl", appearance: "interaction-only" });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey]);
  if (!siteKey) return null;
  return <div ref={ref} className="min-h-0" />;
}
