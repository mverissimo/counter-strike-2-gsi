import appCss from "../styles.css?url";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createRootRoute({
  // Default SSR: the document shell must arrive as HTML before hydration.
  ssr: true,
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "HUD Studio" },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  notFoundComponent: () => (
    <main>
      <h1>Page not found</h1>
    </main>
  ),
  errorComponent: () => (
    <main>
      <h1>Unable to load this page</h1>
      <p>Please reload to try again.</p>
    </main>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
