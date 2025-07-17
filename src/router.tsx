import {
  createRouter as createTanStackRouter,
  ErrorComponent,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: () => <div>Page not found</div>,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
