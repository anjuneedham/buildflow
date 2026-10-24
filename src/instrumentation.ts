import type { Instrumentation } from "next";

// Every uncaught server error (pages, layouts, server actions, route
// handlers) lands here with the digest shown to the user, so a support
// reference maps to a log line.
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const { captureError } = await import("@/server/log");
  const digest = (error as { digest?: string }).digest;
  captureError(error, {
    digest, method: request.method, path: request.path.split("?")[0],
    routerKind: context.routerKind, routePath: context.routePath, routeType: context.routeType,
  });
};
