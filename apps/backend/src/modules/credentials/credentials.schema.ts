// modules/credentials/credentials.schema.ts
import { z } from "zod";

// ============== SHARED ==============

export const providerSchema = z.enum(["paystack", "flutterwave", "monnify"]);
export const modeSchema = z.enum(["test", "live"]);
export const statusSchema = z.enum([
  "pending",
  "active",
  "disabled",
  "invalid",
]);

// ============== CREATE CREDENTIAL ==============

export const createCredentialSchema = z.object({
  provider: providerSchema,
  mode: modeSchema,
  secret: z.string().min(1, "Secret is required"),
  publicKey: z.string().optional(),
});

export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;

// ============== UPDATE CREDENTIAL ==============

export const updateCredentialSchema = z.object({
  secret: z.string().optional(),
  publicKey: z.string().optional(),
  status: statusSchema.optional(),
});

export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;

// ============== VALIDATE CREDENTIAL ==============

export const validateCredentialSchema = z.object({
  provider: providerSchema,
  mode: modeSchema,
  secret: z.string().min(1, "Secret is required"),
  publicKey: z.string().optional(),
});

export type ValidateCredentialInput = z.infer<typeof validateCredentialSchema>;

// ============== LIST QUERY ==============

export const listCredentialsQuerySchema = z.object({
  provider: providerSchema.optional(),
  mode: modeSchema.optional(),
  status: statusSchema.optional(),
});

export type ListCredentialsQuery = z.infer<typeof listCredentialsQuerySchema>;

// ============== PROVIDER-SPECIFIC SECRET SCHEMAS ==============

export const paystackSecretsSchema = z.object({
  publicKey: z.string().min(1, "Public key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
});

export const flutterwaveSecretsSchema = z.object({
  publicKey: z.string().min(1, "Public key is required"),
  secretKey: z.string().min(1, "Secret key is required"),
  encryptionKey: z.string().min(1, "Encryption key is required"),
});

export const monnifySecretsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
  apiKey: z.string().min(1, "API key is required"),
});

// ============== TYPE INFERENCE ==============

export type PaystackSecretsInput = z.infer<typeof paystackSecretsSchema>;
export type FlutterwaveSecretsInput = z.infer<typeof flutterwaveSecretsSchema>;
export type MonnifySecretsInput = z.infer<typeof monnifySecretsSchema>;
