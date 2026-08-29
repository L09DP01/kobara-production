import crypto from 'crypto';

/**
 * Utility for managing Kobara API keys.
 * Keys are generated with a prefix and a random string.
 * Only the hash of the key is stored in the database.
 */
export const ApiKeySecurity = {
  /**
   * Generates a new API key and its hash.
   * @param prefix The prefix for the key (e.g., 'kbr_sk_test_')
   * @returns { rawKey: string, keyHash: string }
   */
  generateKey(prefix: string): { rawKey: string, keyHash: string } {
    const randomPart = crypto.randomBytes(24).toString('hex');
    const rawKey = `${prefix}${randomPart}`;
    const keyHash = this.hashKey(rawKey);
    return { rawKey, keyHash };
  },

  /**
   * Hashes a key using SHA-256.
   * @param key The full API key
   */
  hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  },

  /**
   * Verifies if a raw key matches a stored hash.
   */
  verifyKey(rawKey: string, storedHash: string): boolean {
    const computedHash = this.hashKey(rawKey);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash),
      Buffer.from(storedHash)
    );
  }
};
