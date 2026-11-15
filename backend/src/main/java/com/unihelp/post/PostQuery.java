package com.unihelp.post;

/** Internal module boundary for messaging; never exposed directly by a controller. */
public interface PostQuery {
    PostSummary getPostSummary(Long postId);

    /** Internal author id is needed to authorize conversations; no e-mail is loaded. */
    record PostSummary(Long id, Long authorId, String title, PostStatus status) { }
}
