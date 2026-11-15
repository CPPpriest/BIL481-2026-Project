package com.unihelp.message;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * A private conversation between the author of a post and one other student (FR-19).
 * Users and posts are referenced by id only, so this module does not depend on the
 * auth/post entities and never loads e-mail addresses (FR-20, NFR-04).
 */
@Entity
@Table(name = "conversations",
        uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "initiator_id"}))
public class Conversation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    /** The student who started the conversation from the post detail page. */
    @Column(name = "initiator_id", nullable = false)
    private Long initiatorId;

    /** The author of the post. */
    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** Updated on every new message; used for ordering and for archiving (FR-30). */
    @Column(name = "last_message_at", nullable = false)
    private Instant lastMessageAt;

    protected Conversation() {
        // for JPA
    }

    public Conversation(Long postId, Long initiatorId, Long authorId) {
        this.postId = postId;
        this.initiatorId = initiatorId;
        this.authorId = authorId;
        this.createdAt = Instant.now();
        this.lastMessageAt = this.createdAt;
    }

    /** Returns true if the given user is one of the two participants (FR-19). */
    public boolean isParticipant(Long userId) {
        return initiatorId.equals(userId) || authorId.equals(userId);
    }

    public Long getId() {
        return id;
    }

    public Long getPostId() {
        return postId;
    }

    public Long getInitiatorId() {
        return initiatorId;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastMessageAt() {
        return lastMessageAt;
    }

    public void setLastMessageAt(Instant lastMessageAt) {
        this.lastMessageAt = lastMessageAt;
    }
}
