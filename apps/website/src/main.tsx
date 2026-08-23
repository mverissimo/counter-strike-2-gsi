import "./style.css";
import { GSIProvider } from "@counter-strike-2-gsi/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { EditorPage } from "./editor/editor-page.tsx";
import { installDemoSource } from "./lib/demo-source.ts";

const isDemo = new URLSearchParams(location.search).has("demo");

// `?demo=1` swaps `window.EventSource` for an in-browser canned match before
// `GSIProvider` ever constructs one — see `lib/demo-source.ts`. Otherwise
// this is createGSINode's default `ssePath`
// (packages/handlers/src/node/index.ts); `pnpm mock` serves it locally.
if (isDemo) {
  installDemoSource();
}

const GSI_URL = "http://localhost:3000/sse";

createRoot(document.querySelector("#app")!).render(
  <StrictMode>
    <GSIProvider url={GSI_URL}>
      <EditorPage />
    </GSIProvider>
  </StrictMode>,
);
