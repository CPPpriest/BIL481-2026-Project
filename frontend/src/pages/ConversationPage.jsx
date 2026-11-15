import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sendMessage } from '../api/unihelpApi.js';

const SAMPLE_SUMMARIES = [
  {
    id: 7,
    postId: 42,
    postTitle: 'Lost blue umbrella',
    counterpartAlias: 'BlueOwl482',
    lastMessagePreview: 'Hi, I think I found your blue umbrella in the library.',
    lastMessageAt: '2026-11-15T10:15:00Z',
    unreadCount: 1,
  },
];

const SAMPLE_MESSAGES = [
  {
    id: 31,
    conversationId: 7,
    senderAlias: 'GreenFox107',
    sentByMe: true,
    content: 'Hi, I think I found your blue umbrella in the library.',
    sentAt: '2026-11-15T10:15:00Z',
  },
];

export default function ConversationPage({
  conversations = SAMPLE_SUMMARIES,
  initialMessages = SAMPLE_MESSAGES,
}) {
  const { id } = useParams();
  const activeConversationId = Number(id) || conversations[0]?.id || 7;
  const activeSummary = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState('');
  const [feedback, setFeedback] = useState('');

  async function handleSend(event) {
    event.preventDefault();
    setFeedback('');
    try {
      const created = await sendMessage(activeConversationId, { content: content.trim() });
      setMessages((prev) => [...prev, created]);
      setContent('');
    } catch (error) {
      setFeedback(error.message);
    }
  }

  return (
    <div className="conversation-layout">
      <aside className="panel" aria-label="Conversations list">
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>Conversations</h2>
        {conversations.map((conv) => (
          <div key={conv.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <Link to={`/conversations/${conv.id}`}><strong>{conv.counterpartAlias}</strong></Link>
              {conv.unreadCount > 0 && <span className="badge">{conv.unreadCount} unread</span>}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{conv.postTitle}</div>
          </div>
        ))}
      </aside>

      <section className="panel" aria-labelledby="thread-heading">
        <h1 id="thread-heading" style={{ marginTop: 0, fontSize: '1.25rem' }}>
          Conversation with {activeSummary?.counterpartAlias || 'Campus Student'}
        </h1>
        {activeSummary && (
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            Regarding post: <Link to={`/posts/${activeSummary.postId}`}>{activeSummary.postTitle}</Link>
          </p>
        )}

        <div aria-live="polite" style={{ marginBottom: '1rem' }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                padding: '0.625rem',
                marginBottom: '0.5rem',
                borderRadius: '6px',
                background: msg.sentByMe ? '#ccfbf1' : '#f1f5f9',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                <strong>{msg.senderAlias}</strong> · {msg.sentAt}
              </div>
              <div>{msg.content}</div>
            </div>
          ))}
        </div>

        <form className="form-stack" onSubmit={handleSend}>
          <div className="field-group">
            <label htmlFor="message-input">Message (1–1,000 characters)</label>
            <textarea
              id="message-input"
              rows={3}
              maxLength={1000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write an anonymous message..."
              required
            />
          </div>
          <div className="row-actions">
            <button type="submit" className="btn btn-primary">Send</button>
            {feedback && <span role="alert">{feedback}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}