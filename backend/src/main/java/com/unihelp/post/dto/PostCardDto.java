package com.unihelp.post.dto;

import com.unihelp.post.PostCategory;
import com.unihelp.post.PostStatus;
import com.unihelp.post.PostSubtype;
import java.time.Instant;

/** Feed card: author identity is limited to a display alias (FR-14, NFR-04). */
public record PostCardDto(Long id, String title, String descriptionSnippet,
                          PostCategory category, PostSubtype subtype, PostStatus status,
                          Instant createdAt, String authorAlias) {
}
