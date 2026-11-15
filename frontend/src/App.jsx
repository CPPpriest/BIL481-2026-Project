import React from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import FeedPage from './pages/FeedPage.jsx';
import PostDetailPage from './pages/PostDetailPage.jsx';
import PostFormPage from './pages/PostFormPage.jsx';
import ConversationPage from './pages/ConversationPage.jsx';
import AdminReportsPage from './pages/AdminReportsPage.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link to="/feed" className="brand-link">UniHelp</Link>
          <nav className="nav-links" aria-label="Main navigation">
            <Link to="/feed">Feed</Link>
            <Link to="/posts/new">Create Post</Link>
            <Link to="/conversations">Conversations</Link>
            <Link to="/admin/reports">Admin Queue</Link>
            <Link to="/login">Log In</Link>
            <Link to="/register">Register</Link>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/feed" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<RegisterPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/posts/new" element={<PostFormPage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/posts/:id/edit" element={<PostFormPage />} />
          <Route path="/conversations" element={<ConversationPage />} />
          <Route path="/conversations/:id" element={<ConversationPage />} />
          <Route path="/admin/reports" element={<AdminReportsPage />} />
        </Routes>
      </main>
    </div>
  );
}