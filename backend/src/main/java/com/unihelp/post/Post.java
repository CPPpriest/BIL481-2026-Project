package com.unihelp.post;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Persistence model for FR-09–FR-13. Never serialize this entity as an API response.
 * authorId is internal; responses contain only the author's display alias.
 * Service code must sanitize text and check ownership before applying mutations.
 */
@Entity
@Table(name = "posts", indexes = {
        @Index(name = "idx_posts_feed", columnList = "status,created_at,id"),
        @Index(name = "idx_posts_author", columnList = "author_id")
})
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private PostCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PostSubtype subtype;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(name = "location_text", columnDefinition = "text")
    private String locationText;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PostStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    protected Post() {
        // JPA
    }

    /** Parameters must already have passed service validation and sanitization. */
    public Post(Long authorId, PostCategory category, PostSubtype subtype,
                String title, String description, String locationText) {
        this.authorId = authorId;
        this.category = category;
        this.subtype = subtype;
        this.title = title;
        this.description = description;
        this.locationText = locationText;
        this.status = PostStatus.ACTIVE;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public Long getId() { return id; }
    public Long getAuthorId() { return authorId; }
    public PostCategory getCategory() { return category; }
    public PostSubtype getSubtype() { return subtype; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getLocationText() { return locationText; }
    public PostStatus getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getArchivedAt() { return archivedAt; }
}
