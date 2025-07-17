import { json } from "@tanstack/react-start";
import {
  AnyServerRouteWithTypes,
  getEvent,
  type ServerRouteMethodsRecord,
} from "@tanstack/react-start/server";
import createNodeAdapter, {
  type NodeOptions as NodeAdapterOptions,
} from "crossws/adapters/node";

// https://gist.github.com/darkobits/4b2073742af7d89707e216915fae7e9d
/**
 * Adapter for TanStack Start and `crossws`.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/server-routes
 * @see https://nitro.build/guide/websocket
 *
 * @example
 *
 * ```
 * import { createServerFileRoute } from '@tanstack/react-start/server'
 * import { createWebSocketHandler } from '...'
 *
 * export const ServerRoute = createServerFileRoute('/api/ws').methods(createWebSocketHandler({
 *   serverOptions: {
 *     // ...
 *   },
 *   hooks: {
 *     open: () => {
 *       // ...
 *     },
 *     message: () => {
 *       // ...
 *     },
 *     error: : () => {
 *       // ...
 *     },
 *     close: : () => {
 *       // ...
 *     },
 *   }
 * }))
 * ```
 */
export function createWebSocketHandler<
  TParentRoute extends AnyServerRouteWithTypes,
  TFullPath extends string,
  TMiddlewares,
>(
  options: NodeAdapterOptions,
): ServerRouteMethodsRecord<TParentRoute, TFullPath, TMiddlewares> {
  const nodeAdapter = createNodeAdapter(options);

  const handler = async () => {
    try {
      const event = getEvent();

      if (event.node.req.headers.upgrade === "websocket") {
        const { req } = event.node;
        const { socket } = req;
        if (socket) {
          await nodeAdapter.handleUpgrade(req, socket, Buffer.from([]));
          return;
        }
      }

      return json(
        { message: "This is a WebSocket endpoint." },
        { status: 400, statusText: "Bad Request" },
      );
    } catch (error: any) {
      const message = error.message ?? "An unknown error occurred.";
      return json(
        { message },
        { status: 500, statusText: "Internal Server Error" },
      );
    }
  };

  return {
    GET: handler,
    POST: handler,
  };
}
