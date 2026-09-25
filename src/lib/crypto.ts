import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const source = process.env.INTEGRATION_ENCRYPTION_KEY?.trim();
  if (!source || source.length < 32) throw new Error("INTEGRATION_ENCRYPTION_KEY deve possuir ao menos 32 caracteres.");
  return createHash("sha256").update(source, "utf8").digest();
}

export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, encodedIv, encodedTag, encodedText] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedText) throw new Error("Segredo de integração inválido.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedText, "base64url")), decipher.final()]).toString("utf8");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
