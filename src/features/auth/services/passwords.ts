import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16_384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function deriveKey(password: string, salt: Buffer, keyLength: number, N: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, COST, BLOCK_SIZE, PARALLELIZATION);
  return ["scrypt", String(COST), String(BLOCK_SIZE), String(PARALLELIZATION), salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, cost, blockSize, parallelization, encodedSalt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;
  const N = Number(cost);
  const r = Number(blockSize);
  const p = Number(parallelization);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < 1 || r < 1 || p < 1) return false;

  try {
    const expected = Buffer.from(encodedHash, "base64url");
    const derived = await deriveKey(password, Buffer.from(encodedSalt, "base64url"), expected.length, N, r, p);
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}
