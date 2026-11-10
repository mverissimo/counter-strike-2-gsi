import { Await, createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { getMockWorkspace } from "../functions/workspace.functions";
import { validateWorkspaceSearch } from "../shared/workspace";

export const Route = createFileRoute("/")({
  // Default SSR: this static placeholder needs no browser APIs and can stream its mock loader data.
  ssr: true,
  validateSearch: validateWorkspaceSearch,
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: ({ deps }) => ({ workspace: getMockWorkspace({ data: deps }) }),
  component: Home,
});

function Home() {
  const { workspace } = Route.useLoaderData();
  return (
    <main>
      <h1>HUD Studio</h1>
      <Suspense fallback={<p role="status">Loading workspace…</p>}>
        <Await promise={workspace}>
          {(data) => (
            <>
              <p>{data.description}</p>
              <p>View: {data.view}</p>
            </>
          )}
        </Await>
      </Suspense>
      <nav aria-label="Placeholder views">
        <Link to="/" search={{ view: "canvas" }}>
          Canvas
        </Link>
        {" · "}
        <Link to="/" search={{ view: "outline" }}>
          Outline
        </Link>
        {" · "}
        <Link to="/sidebar">Sidebar example</Link>
      </nav>
    </main>
  );
}
