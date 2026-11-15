package com.unihelp.post.dto;

import com.unihelp.post.PostCategory;
import com.unihelp.post.PostStatus;
import com.unihelp.post.PostSubtype;
import java.time.Instant;

/** No User entity, author id, e-mail or contact details may enter this response. */
public record PostDetailDto(Long id, String title, String description,
                            PostCategory category, PostSubtype subtype, PostStatus status,
                            String locationText, String imageUrl, String authorAlias,
                            Instant createdAt, Instant updatedAt) {
}
