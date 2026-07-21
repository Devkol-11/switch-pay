const encoder = new TextEncoder();

const API_KEY_BYTES = 32;

export async function generateApiKey(mode: "test" | "live") {
  const prefix = mode === "live" ? "sk_live" : "sk_test";

  // Random 256-bit secret
  const random = crypto.getRandomValues(new Uint8Array(API_KEY_BYTES));

  const secret = btoa(String.fromCharCode(...random))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  const apiKey = `${prefix}_${secret}`;

  const hashedKey = await hashApiKey(apiKey);

  return {
    apiKey,
    hashedKey,
  };
}

export async function hashApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
