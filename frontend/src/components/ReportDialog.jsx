import React, { useState } from 'react';

const REPORT_REASONS = [
  { value: 'FRAUD', label: 'Fraud' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OFFENSIVE_CONTENT', label: 'Offensive content' },
  { value: 'OTHER', label: 'Other' },
];

export default function ReportDialog({ postId, isOpen, onClose, onSubmit }) {
  const [reason, setReason] = useState('FRAUD');
  const [comment, setComment] = useState('');

  if (!isOpen || postId === null) return null;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit?.(postId, { reason, comment: comment.trim() });
    setComment('');
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <h2 id="report-dialog-title" style={{ marginTop: 0 }}>Report Post #{postId}</h2>
        <form className="form-stack" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="report-reason">Reason</label>
            <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} required>
              {REPORT_REASONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="report-comment">Optional comment (max 500 characters)</label>
            <textarea
              id="report-comment"
              rows={4}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Provide optional context for moderators..."
            />
          </div>
          <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Submit report</button>
          </div>
        </form>
      </div>
    </div>
  );
}