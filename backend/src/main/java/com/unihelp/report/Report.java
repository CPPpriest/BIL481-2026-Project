package com.unihelp.report;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;

/**
 * One report of one post by one student (FR-25). UNIQUE(post_id, reporter_id) makes every
 * stored report a unique report, also under concurrent requests. Never serialize this entity.
 */
@Entity
@Table(name = "reports",
        uniqueConstraints = @UniqueConstraint(name = "uk_reports_post_reporter",
                columnNames = {"post_id", "reporter_id"}),
        indexes = @Index(name = "idx_reports_post_reviewed", columnList = "post_id,reviewed"))
public class Report {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "post_id", nullable = false)
    private Long postId;

    @Column(name = "reporter_id", nullable = false)
    private Long reporterId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ReportReason reason;

    /** Optional, sanitized like post text before storage. */
    @Column(columnDefinition = "text")
    private String comment;

    /** Set to true when an administrator restores the post (FR-27). */
    @Column(nullable = false)
    private boolean reviewed;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Report() {
        // JPA
    }

    public Report(Long postId, Long reporterId, ReportReason reason, String comment) {
        this.postId = postId;
        this.reporterId = reporterId;
        this.reason = reason;
        this.comment = comment;
        this.reviewed = false;
        this.createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Long getPostId() { return postId; }
    public Long getReporterId() { return reporterId; }
    public ReportReason getReason() { return reason; }
    public String getComment() { return comment; }
    public boolean isReviewed() { return reviewed; }
    public Instant getCreatedAt() { return createdAt; }
}
