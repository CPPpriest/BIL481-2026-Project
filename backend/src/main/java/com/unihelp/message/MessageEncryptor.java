package com.unihelp.message;

/**
 * Encrypts message contents at rest with AES-256 in GCM mode (NFR-02).
 * The 256-bit key is read from configuration (environment variable), never from the database.
 */
public interface MessageEncryptor {

    /** Encrypts plain text with a fresh random IV. */
    EncryptedContent encrypt(String plainText);

    /** Decrypts content previously produced by {@link #encrypt(String)}; fails if it was tampered with. */
    String decrypt(EncryptedContent content);

    /** Base64-encoded ciphertext and IV as stored in {@link Message}. */
    record EncryptedContent(String ciphertext, String iv) {
    }
}
