package com.unihelp.post.dto;

import com.unihelp.post.PostCategory;
import com.unihelp.post.PostStatus;
import com.unihelp.post.PostSubtype;
import java.time.Instant;

/** Inclusive UTC creation-time range; null filters are omitted; status defaults to ACTIVE. */
public record PostSearchCriteria(String keyword, PostCategory category, PostSubtype subtype,
                                 PostStatus status, Instant from, Instant to) {
}
