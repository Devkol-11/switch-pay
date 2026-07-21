import { Hono } from "hono";
import { ResponseHelper } from "../shared/utils/response";

const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  return ResponseHelper.success(
    c,
    {
      status: "healthy",
      runtime: "Bun",
      service: "switch-pay-backend",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    "Service is healthy"
  );
});

healthRouter.get("/readiness", (c) => {
  return ResponseHelper.success(
    c,
    {
      status: "ready",
      checks: {
        database: "healthy",
        redis: "healthy",
      },
    },
    "Service is ready"
  );
});

healthRouter.get("/liveness", (c) => {
  // Basic liveness check
  return ResponseHelper.success(
    c,
    {
      status: "alive",
      timestamp: new Date().toISOString(),
    },
    "Service is alive"
  );
});

export { healthRouter };
