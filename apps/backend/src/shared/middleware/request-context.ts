import { Context, Next } from "hono";
import { HonoContextVariables } from "../../types/hono.types";

/**
 * Adds a request ID to every request for tracing
 */
export async function addRequestId(c: Context, next: Next) {
  const requestId = crypto.randomUUID();
  c.set("requestId" as keyof HonoContextVariables, requestId as string);
  c.res.headers.set("X-Request-Id", requestId);
  await next();
}
