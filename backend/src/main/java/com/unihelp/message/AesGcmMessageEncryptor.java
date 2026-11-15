package com.unihelp.message;

import org.springframework.stereotype.Component;

/**
 * AES-256-GCM implementation of {@link MessageEncryptor}.
 * Stub for PA-2; implemented in Sprint 2 (task T3.6).
 */
@Component
public class AesGcmMessageEncryptor implements MessageEncryptor {

    @Override
    public EncryptedContent encrypt(String plainText) {
        throw new UnsupportedOperationException("Not implemented yet (Sprint 2, T3.6)");
    }

    @Override
    public String decrypt(EncryptedContent content) {
        throw new UnsupportedOperationException("Not implemented yet (Sprint 2, T3.6)");
    }
}
