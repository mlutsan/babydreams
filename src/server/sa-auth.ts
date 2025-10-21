let cachedToken: { accessToken: string; exp: number; } | null = null;
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_AUD = "https://oauth2.googleapis.com/token";
import { env } from "cloudflare:workers";

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if valid for >= 2 minutes
  if (cachedToken && cachedToken.exp - now > 120) {
    return cachedToken.accessToken;
  }

  const jwt = await signJwtRS256(env.SA_PRIVATE_KEY_PEM, {
    iss: env.SA_EMAIL,
    scope: SCOPE,
    aud: TOKEN_AUD,
    iat: now,
    exp: now + 3600
  });

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt
  });

  const r = await fetch(TOKEN_AUD, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tok = await r.json() as { access_token: string; expires_in: number; token_type: string; };
  cachedToken = { accessToken: tok.access_token, exp: now + tok.expires_in };
  return tok.access_token;
}

async function signJwtRS256(pem: string, claims: Record<string, unknown>): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const enc = (obj: unknown) => base64url(new TextEncoder().encode(JSON.stringify(obj)));
  const input = `${enc(header)}.${enc(claims)}`;

  const key = await importPkcs8PrivateKey(pem);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(input)
  ));
  return `${input}.${base64url(sig)}`;
}

async function importPkcs8PrivateKey(pem: string): Promise<CryptoKey> {
  const trimmed = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "")
    .replaceAll("\\n", "");
  const raw = Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    raw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function base64url(buf: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...buf));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
