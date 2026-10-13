import type { SessionAudience } from "@/features/auth/types/auth";

export const AUTH_SESSION_COOKIE = "vr_session";
const LOCAL_AUTH_SECRET = "vr-gestao-local-auth-secret-only-for-development-2026";

type SessionPayload = {
  version: 1;
  sessionId: string;
  expiresAt: number;
  audience: SessionAudience;
};

function secretBytes() {
  const secret = process.env.AUTH_SECRET?.trim() || (process.env.NODE_ENV !== "production" ? LOCAL_AUTH_SECRET : "");
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function encodeBase64Url(value: Uint8Array) {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey() {
  const secret = secretBytes();
  if (!secret) return null;
  return crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export function isAuthSecretConfigured() {
  return Boolean(secretBytes());
}

export async function createSessionToken(payload: Omit<SessionPayload, "version">) {
  const key = await hmacKey();
  if (!key) throw new Error("AUTH_SECRET deve possuir ao menos 32 caracteres.");
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ version: 1, ...payload } satisfies SessionPayload)));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionToken(value: string | undefined): Promise<SessionPayload | null> {
  if (!value) return null;
  const [encodedPayload, encodedSignature, ...extra] = value.split(".");
  const key = await hmacKey();
  if (!encodedPayload || !encodedSignature || extra.length || !key) return null;

  try {
    const isValid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(encodedSignature), new TextEncoder().encode(encodedPayload));
    if (!isValid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Partial<SessionPayload>;
    if (parsed.version !== 1 || typeof parsed.sessionId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(parsed.sessionId) || typeof parsed.expiresAt !== "number" || !Number.isFinite(parsed.expiresAt) || (parsed.audience !== "management" && parsed.audience !== "client")) return null;
    if (parsed.expiresAt <= Date.now()) return null;
    return { version: 1, sessionId: parsed.sessionId, expiresAt: parsed.expiresAt, audience: parsed.audience };
  } catch {
    return null;
  }
}
