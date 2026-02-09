/**
 * Crypto utilities for token encryption/decryption.
 * Uses AES-256-GCM as specified in PRD Section 8 (US-005).
 *
 * Tokens are stored as: iv:ciphertext:tag (base64 encoded, colon-separated)
 */

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 128; // bits

/**
 * Derives a CryptoKey from the encryption key string.
 * Uses SHA-256 to ensure consistent 256-bit key length.
 */
async function deriveKey(keyString: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);

  // Hash the key to get consistent 256-bit key
  const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);

  return crypto.subtle.importKey("raw", hashBuffer, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @param encryptionKey - The encryption key from environment
 * @returns Base64-encoded string in format: iv:ciphertext (tag is appended to ciphertext by GCM)
 */
export async function encrypt(plaintext: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);
  const encoder = new TextEncoder();

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    encoder.encode(plaintext),
  );

  // Combine IV and ciphertext, encode as base64
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a ciphertext string using AES-256-GCM.
 *
 * @param encrypted - Base64-encoded string from encrypt()
 * @param encryptionKey - The encryption key from environment
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails
 */
export async function decrypt(encrypted: string, encryptionKey: string): Promise<string> {
  const key = await deriveKey(encryptionKey);

  // Decode base64
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // Extract IV and ciphertext
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH,
    },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plaintext);
}
