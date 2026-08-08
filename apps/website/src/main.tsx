import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GSIProvider } from "@counter-strike-2-gsi/client";

// Before the component import: ES modules evaluate in source order, and
// `Overlay` pulls in every `*.module.css`. Importing these after it would put
// the tokens and the reset *last* in the stylesheet.
import "./styles/tokens.css";
import "./styles/global.css";

import { Overlay } from "./overlay.tsx";

/**
 * Same origin as the page: in development Vite proxies `/sse` to the GSI
 * server on :3000, and a built overlay is served by that same server. Override
 * with `VITE_GSI_URL` to point at a GSI server on another machine —
 * `ws://host/ws` selects the WebSocket transport instead of SSE.
 */
const GSI_URL = import.meta.env.VITE_GSI_URL ?? `${location.origin}/sse`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GSIProvider
      url={GSI_URL}
      onError={(error) => {
        console.error("[gsi]", error);
      }}
    >
      <Overlay />
    </GSIProvider>
  </StrictMode>,
);
