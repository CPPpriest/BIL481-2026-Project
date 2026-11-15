import React from 'react';
import { Link } from 'react-router-dom';

export default function PostCard({ post, onReportClick }) {
  return (
    <article className="panel" aria-label={post.title}>
      <div className="row-actions" style={{ justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span className="badge">
          {post.category} · {post.subtype}
        </span>
        {post.status === 'RESOLVED' && <span className="badge">Resolved</span>}
      </div>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>
        <Link to={`/posts/${post.id}`}>{post.title}</Link>
      </h2>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--muted)' }}>{post.descriptionSnippet}</p>
      <div className="row-actions" style={{ justifyContent: 'space-between', fontSize: '0.875rem' }}>
        <span>
          By <strong>{post.authorAlias}</strong> · {post.createdAt}
        </span>
        {onReportClick && (
          <button type="button" className="btn" onClick={() => onReportClick(post.id)}>
            Report
          </button>
        )}
      </div>
    </article>
  );
}