/**
 * Google OAuth2 and Service Account Authentication
 * Handles token management and JWT creation for Google APIs
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface JWTPayload {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
}

let cachedToken: { accessToken: string; exp: number; } | null = null;

/**
 * Base64 URL encode (for JWT)
 */
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Create JWT token for service account authentication
 */
async function createServiceAccountJWT(
  serviceAccountEmail: string,
  privateKeyPem: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload: JWTPayload = {
    iss: serviceAccountEmail,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Encode header and payload
  const headerEncoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(header))
  );
  const payloadEncoded = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const unsignedToken = `${headerEncoded}.${payloadEncoded}`;

  // Import private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "")
    .replaceAll("\\n", "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
  return `${unsignedToken}.${signatureEncoded}`;
}

/**
 * Get access token from service account using JWT
 */
export async function getServiceAccountAccessToken(
  serviceAccountEmail: string,
  privateKeyPem: string,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.exp - now > 120) {
    return cachedToken.accessToken;
  }

  const jwt = await createServiceAccountJWT(
    serviceAccountEmail,
    privateKeyPem,
    scopes
  );

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get access token: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number; token_type: string; };
  cachedToken = { accessToken: data.access_token, exp: now + data.expires_in };
  return data.access_token;
}
