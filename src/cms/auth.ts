// src/cms/auth.ts — Password hashing using Web Crypto (PBKDF2).
// No external deps — runs natively in Workers/V8 isolates.

// 10K iterations keeps us under Workers free tier 10ms CPU limit
// while still providing adequate protection for a CMS admin account.
const PBKDF2_ITERATIONS = 10_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const toHex = (arr: Uint8Array) => [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
  // Format: "<salt-hex>:<hash-hex>" — single colon separator.
  // (Previous version joined every byte with ':' so verify could only read
  // the first two byte-segments — login always failed.)
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  const expected = new Uint8Array(hashHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial, 256,
  );
  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
