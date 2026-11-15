import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReportDialog from '../components/ReportDialog.jsx';
import { deletePost, resolvePost, startConversation, submitReport } from '../api/unihelpApi.js';

const DEFAULT_POST = {
  id: 42,
  title: 'Lost blue umbrella',
  description: 'Left near the library entrance around noon. Please message if you picked it up.',
  category: 'LOST_FOUND',
  subtype: 'LOST',
  status: 'ACTIVE',
  locationText: 'Main Library Entrance',
  imageUrl: null,
  authorAlias: 'BlueOwl482',
  createdAt: '2026-11-15T09:30:00Z',
  updatedAt: '2026-11-15T09:30:00Z',
};

export default function PostDetailPage({ post: initialPost, isAuthor = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(initialPost || { ...DEFAULT_POST, id: Number(id) || 42 });
  const [firstMessage, setFirstMessage] = useState('');
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isResolved = post.status === 'RESOLVED';

  async function handleResolve() {
    try {
      const updated = await resolvePost(post.id);
      setPost(updated);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function handleDelete() {
    try {
      await deletePost(post.id);
      navigate('/feed');
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function handleStartConversation(event) {
    event.preventDefault();
    if (isResolved) return;
    try {
      const conversation = await startConversation(post.id, { content: firstMessage.trim() });
      navigate(`/conversations/${conversation.id}`);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function handleReportSubmit(targetPostId, payload) {
    try {
      await submitReport(targetPostId, payload);
      setFeedback('Report submitted.');
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setIsReportOpen(false);
    }
  }

  return (
    <article className="panel" aria-labelledby="detail-title">
      <div className="row-actions" style={{ justifyContent: 'space-between' }}>
        <span className="badge">{post.category} · {post.subtype}</span>
        {isResolved && <span className="badge">Resolved</span>}
      </div>

      <h1 id="detail-title">{post.title}</h1>
      <p style={{ color: 'var(--muted)' }}>
        Posted by <strong>{post.authorAlias}</strong> · {post.createdAt}
        {post.locationText ? ` · Location: ${post.locationText}` : ''}
      </p>

      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.title} style={{ maxWidth: '100%', borderRadius: '6px', marginBottom: '1rem' }} />
      )}

      <p>{post.description}</p>

      <div className="row-actions" style={{ marginTop: '1rem' }}>
        {isAuthor && (
          <>
            <Link to={`/posts/${post.id}/edit`} className="btn" style={{ textDecoration: 'none' }}>Edit post</Link>
            <button type="button" className="btn" disabled={isResolved} onClick={handleResolve}>
              Mark as Resolved
            </button>
            <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete post</button>
          </>
        )}
        <button type="button" className="btn" onClick={() => setIsReportOpen(true)}>Report post</button>
      </div>

      {!isAuthor && (
        <form className="form-stack" style={{ marginTop: '1.25rem' }} onSubmit={handleStartConversation}>
          <div className="field-group">
            <label htmlFor="initial-message">Contact {post.authorAlias} anonymously (1–1,000 characters)</label>
            <textarea
              id="initial-message"
              rows={3}
              maxLength={1000}
              disabled={isResolved}
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              placeholder={isResolved ? 'This post is Resolved and no longer accepts new messages.' : 'Write a private message...'}
              required
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" disabled={isResolved}>Send message</button>
          </div>
        </form>
      )}

      {feedback && <p role="status">{feedback}</p>}

      <ReportDialog
        postId={post.id}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </article>
  );
}