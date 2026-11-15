package com.unihelp.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * A single text message inside a {@link Conversation}.
 * The plain text (max 1,000 characters, FR-19) is never stored; only the AES-256-GCM
 * ciphertext and its IV produced by {@link MessageEncryptor} are persisted (NFR-02).
 */
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @Column(name = "sender_id", nullable = false)
    private Long senderId;

    /** Base64-encoded AES-256-GCM ciphertext (including the authentication tag). */
    @Column(name = "content_ciphertext", nullable = false, length = 4096)
    private String contentCiphertext;

    /** Base64-encoded 12-byte initialization vector, unique per message. */
    @Column(name = "content_iv", nullable = false, length = 32)
    private String contentIv;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    /** Null until the recipient opens the conversation; used for the unread counter (FR-21). */
    @Column(name = "read_at")
    private Instant readAt;

    protected Message() {
        // for JPA
    }

    public Message(Conversation conversation, Long senderId, String contentCiphertext, String contentIv) {
        this.conversation = conversation;
        this.senderId = senderId;
        this.contentCiphertext = contentCiphertext;
        this.contentIv = contentIv;
        this.sentAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public Conversation getConversation() {
        return conversation;
    }

    public Long getSenderId() {
        return senderId;
    }

    public String getContentCiphertext() {
        return contentCiphertext;
    }

    public String getContentIv() {
        return contentIv;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void markRead(Instant when) {
        this.readAt = when;
    }
}
