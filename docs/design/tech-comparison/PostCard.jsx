import React from 'react';

/**
 * Documentation-only SELECTED frontend approach: React 18 function component.
 * Renders alias-only PostCardDto fields (FR-14, FR-20, NFR-04).
 */
export function PostCard({ post, onOpen, onReport }) {
  return (
    <article className="post-card" aria-label={post.title}>
      <header className="post-card-meta">
        <span className="badge">
          {post.category} · {post.subtype}
        </span>
        {post.status === 'RESOLVED' && <span className="badge">Resolved</span>}
      </header>

      <h3>
        <button type="button" className="link-button" onClick={() => onOpen(post.id)}>
          {post.title}
        </button>
      </h3>

      <p>{post.descriptionSnippet}</p>

      <footer>
        <span>
          By <strong>{post.authorAlias}</strong> · {post.createdAt}
        </span>
        {post.status === 'ACTIVE' && (
          <button type="button" onClick={() => onReport(post.id)}>
            Report
          </button>
        )}
      </footer>
    </article>
  );
}