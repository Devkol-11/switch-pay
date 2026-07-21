import { Merchant } from "../generated/prisma/client";

export interface HonoContextVariables {
  requestId: string;
  merchantId: string;
  sessionId: string;
  merchant: Merchant;
}

// Extend Hono's Context with our variables
declare module "hono" {
  interface ContextVariableMap extends HonoContextVariables {}
}

export type HonoContext = {
  Variables: HonoContextVariables;
};
