import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/services/crypto.js";

/**
 * Crypto service tests.
 *
 * Tests the AES-256-GCM encrypt/decrypt functions used for storing
 * OAuth tokens securely. Uses random IVs, so identical plaintext
 * produces different ciphertext on each call.
 */
describe("Crypto service", () => {
  const TEST_KEY = "test-encryption-key-for-unit-tests";

  it("encrypt + decrypt round-trip returns original plaintext", async () => {
    const plaintext = "oauth-access-token-abc123";
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe(plaintext);
  });

  it("same input produces different ciphertext (random IV)", async () => {
    const plaintext = "same-input-every-time";
    const encrypted1 = await encrypt(plaintext, TEST_KEY);
    const encrypted2 = await encrypt(plaintext, TEST_KEY);

    // Both should decrypt to the same value
    expect(await decrypt(encrypted1, TEST_KEY)).toBe(plaintext);
    expect(await decrypt(encrypted2, TEST_KEY)).toBe(plaintext);

    // But the ciphertext should differ due to random IV
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("wrong key fails to decrypt", async () => {
    const plaintext = "secret-data";
    const encrypted = await encrypt(plaintext, TEST_KEY);

    await expect(decrypt(encrypted, "wrong-key-entirely")).rejects.toThrow();
  });

  it("empty string round-trip", async () => {
    const plaintext = "";
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe(plaintext);
  });

  it("unicode content round-trip", async () => {
    const plaintext = "Hello \u4e16\u754c \ud83c\udf0d \u00e9\u00e0\u00fc\u00f1 \u2603\ufe0f";
    const encrypted = await encrypt(plaintext, TEST_KEY);
    const decrypted = await decrypt(encrypted, TEST_KEY);

    expect(decrypted).toBe(plaintext);
  });
});
