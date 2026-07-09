const algorithm = "PBKDF2-SHA256";
// Cloudflare Workers currently cap PBKDF2 at 100,000 iterations.
const iterations = 100_000;
const saltBytes = 16;
const derivedBits = 256;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      hash: "SHA-256",
      iterations,
      name: "PBKDF2",
      salt: salt.buffer.slice(
        salt.byteOffset,
        salt.byteOffset + salt.byteLength,
      ) as ArrayBuffer,
    },
    key,
    derivedBits,
  );

  return bytesToHex(new Uint8Array(bits));
}

export function cleanPassword(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function validatePassword(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (password.length > 200) {
    return "Password is too long.";
  }

  return null;
}

export async function hashPassword(password: string) {
  const salt = new Uint8Array(saltBytes);
  crypto.getRandomValues(salt);
  const hash = await derivePasswordHash(password, salt);

  return [algorithm, String(iterations), bytesToHex(salt), hash].join("$");
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [storedAlgorithm, storedIterations, storedSalt, storedDigest] =
    storedHash.split("$");

  if (
    storedAlgorithm !== algorithm ||
    storedIterations !== String(iterations) ||
    !storedSalt ||
    !storedDigest
  ) {
    return false;
  }

  const hash = await derivePasswordHash(password, hexToBytes(storedSalt));

  return constantTimeEqual(hash, storedDigest);
}
