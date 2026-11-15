import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import ReportDialog from '../components/ReportDialog.jsx';
import { searchPosts, submitReport } from '../api/unihelpApi.js';

const SAMPLE_POSTS = [
  {
    id: 42,
    title: 'Lost blue umbrella',
    descriptionSnippet: 'Left near the library entrance around noon.',
    category: 'LOST_FOUND',
    subtype: 'LOST',
    status: 'ACTIVE',
    createdAt: '2026-11-15T09:30:00Z',
    authorAlias: 'BlueOwl482',
  },
  {
    id: 43,
    title: 'Software Engineering textbook for short-term borrow',
    descriptionSnippet: 'Available on campus for two weeks; message if needed.',
    category: 'STUDENT_COOPERATION',
    subtype: 'BOOK',
    status: 'ACTIVE',
    createdAt: '2026-11-15T08:15:00Z',
    authorAlias: 'GreenFox107',
  },
];

export default function FeedPage({ initialPosts = SAMPLE_POSTS }) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [subtype, setSubtype] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);
  const [posts, setPosts] = useState(initialPosts);
  const [reportPostId, setReportPostId] = useState(null);
  const [feedback, setFeedback] = useState('');

  const visiblePosts = posts.filter((post) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const matchesKeyword =
      !normalizedKeyword ||
      post.title.toLowerCase().includes(normalizedKeyword) ||
      post.descriptionSnippet.toLowerCase().includes(normalizedKeyword);
    const matchesCategory = !category || post.category === category;
    const matchesSubtype = !subtype || post.subtype === subtype;
    const matchesStatus = !status || post.status === status;
    return matchesKeyword && matchesCategory && matchesSubtype && matchesStatus;
  });

  async function handleSearchSubmit(event) {
    event.preventDefault();
    setFeedback('');
    try {
      const resultPage = await searchPosts({
        keyword: keyword.trim(),
        category: category || undefined,
        subtype: subtype || undefined,
        status,
        from: fromDate ? `${fromDate}T00:00:00Z` : undefined,
        to: toDate ? `${toDate}T23:59:59Z` : undefined,
        page,
      });
      setPosts(resultPage.content || []);
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
      setReportPostId(null);
    }
  }

  return (
    <div>
      <div className="row-actions" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Campus Feed</h1>
        <Link to="/posts/new" className="btn btn-primary" style={{ textDecoration: 'none' }}>Create post</Link>
      </div>

      <form className="panel" aria-label="Search and filter posts" onSubmit={handleSearchSubmit}>
        <div className="filter-grid">
          <div className="field-group">
            <label htmlFor="feed-search-input">Keyword</label>
            <input
              id="feed-search-input"
              type="search"
              placeholder="Search title or description..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label htmlFor="feed-category">Category</label>
            <select
              id="feed-category"
              value={category}
              onChange={(e) => { setCategory(e.target.value); setSubtype(''); }}
            >
              <option value="">All categories</option>
              <option value="LOST_FOUND">Lost &amp; Found</option>
              <option value="STUDENT_COOPERATION">Student Cooperation</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="feed-subtype">Sub-type</label>
            <select id="feed-subtype" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
              <option value="">All sub-types</option>
              {(!category || category === 'LOST_FOUND') && (
                <>
                  <option value="LOST">Lost</option>
                  <option value="FOUND">Found</option>
                </>
              )}
              {(!category || category === 'STUDENT_COOPERATION') && (
                <>
                  <option value="BOOK">Book</option>
                  <option value="ROOMMATE">Roommate</option>
                  <option value="OTHER">Other</option>
                </>
              )}
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="feed-status">Status</label>
            <select id="feed-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>
          <div className="field-group">
            <label htmlFor="feed-from">From date</label>
            <input id="feed-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field-group">
            <label htmlFor="feed-to">To date</label>
            <input id="feed-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
        <div className="row-actions" style={{ marginTop: '0.75rem' }}>
          <button type="submit" className="btn btn-primary">Apply filters</button>
          {feedback && <span role="status">{feedback}</span>}
        </div>
      </form>

      {visiblePosts.length === 0 ? (
        <div className="panel" role="status">No posts found</div>
      ) : (
        <div className="feed-grid">
          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} onReportClick={setReportPostId} />
          ))}
        </div>
      )}

      <nav className="row-actions" aria-label="Feed pagination" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>Page {page + 1} (20 posts per page)</span>
        <button type="button" className="btn" onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </nav>

      <ReportDialog
        postId={reportPostId}
        isOpen={reportPostId !== null}
        onClose={() => setReportPostId(null)}
        onSubmit={handleReportSubmit}
      />
    </div>
  );
}