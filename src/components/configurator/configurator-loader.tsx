"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, type ComponentProps } from "react";
import type ConfiguratorRoot from "./configurator";

type Props = ComponentProps<typeof ConfiguratorRoot>;

const LoadingText = createContext("");

/**
 * Loads the 3D configurator in the browser only. three.js and Remotion are
 * large, so they are downloaded on this page alone, never on the rest of the site.
 */
export function ConfiguratorLoader(props: Props) {
  return (
    <LoadingText.Provider value={props.t.loading}>
      <LazyConfigurator {...props} />
    </LoadingText.Provider>
  );
}

function Loading() {
  const text = useContext(LoadingText);
  return (
    <div className="grid h-[60vh] place-items-center bg-sand lg:h-[calc(100dvh-105px)]" role="status">
      <div className="flex flex-col items-center gap-4">
        <span className="size-8 animate-spin rounded-pill border-2 border-line-strong border-t-accent" aria-hidden="true" />
        <span className="text-[15px] text-muted">{text}</span>
      </div>
    </div>
  );
}

const LazyConfigurator = dynamic(() => import("./configurator"), { ssr: false, loading: Loading });
