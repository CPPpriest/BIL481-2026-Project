import React, { useState } from 'react';
import { moderatePost, setUserSuspension } from '../api/unihelpApi.js';

const SAMPLE_REPORTED_POSTS = [
  {
    postId: 42,
    title: 'Lost blue umbrella',
    status: 'HIDDEN',
    authorId: 7,
    authorAlias: 'BlueOwl482',
    openReportCount: 4,
    alert: true,
    reports: [
      {
        reportId: 118,
        reason: 'FRAUD',
        comment: 'Asks for a deposit before returning the item.',
        reporterAlias: 'GreenFox107',
        reviewed: false,
        createdAt: '2026-11-15T10:15:00Z',
      },
    ],
  },
];

export default function AdminReportsPage({ initialQueue = SAMPLE_REPORTED_POSTS }) {
  const [queue, setQueue] = useState(initialQueue);
  const [feedback, setFeedback] = useState('');

  async function handleModeration(postId, action) {
    setFeedback('');
    try {
      const updated = await moderatePost(postId, action);
      if (action === 'REMOVE') {
        setQueue((prev) => prev.filter((item) => item.postId !== postId));
      } else if (updated) {
        setQueue((prev) => prev.map((item) => (item.postId === postId ? updated : item)));
      }
      setFeedback(`Action ${action} applied to post #${postId}.`);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function handleSuspension(userId, suspended) {
    setFeedback('');
    try {
      const result = await setUserSuspension(userId, suspended);
      setFeedback(`Account ${result.displayAlias} is now ${result.status}.`);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  return (
    <section className="panel" aria-labelledby="admin-reports-heading">
      <h1 id="admin-reports-heading">Administrator Moderation Queue</h1>
      <p style={{ color: 'var(--muted)' }}>
        Posts exceeding 3 unique unreviewed reports are automatically set to <code>HIDDEN</code> and flagged with an alert (FR-26, FR-27).
      </p>
      {feedback && <p role="status">{feedback}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Post</th>
              <th>Author Alias</th>
              <th>Status</th>
              <th>Open Reports</th>
              <th>Post Actions (FR-27)</th>
              <th>Account Actions (FR-28)</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((entry) => (
              <tr key={entry.postId}>
                <td>
                  <strong>{entry.title}</strong>
                  {entry.alert && (
                    <div><span className="badge badge-alert">Auto-hidden alert (&gt;3 reports)</span></div>
                  )}
                </td>
                <td>{entry.authorAlias}</td>
                <td>{entry.status}</td>
                <td>{entry.openReportCount}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn btn-primary" onClick={() => handleModeration(entry.postId, 'RESTORE')}>Restore</button>
                    <button type="button" className="btn btn-danger" onClick={() => handleModeration(entry.postId, 'REMOVE')}>Remove</button>
                  </div>
                </td>
                <td>
                  <div className="row-actions">
                    <button type="button" className="btn" onClick={() => handleSuspension(entry.authorId, true)}>Suspend</button>
                    <button type="button" className="btn" onClick={() => handleSuspension(entry.authorId, false)}>Unsuspend</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}