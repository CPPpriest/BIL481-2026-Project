import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { register, verifyEmail } from '../api/unihelpApi.js';

export default function RegisterPage({ onRegistered }) {
  const [searchParams] = useSearchParams();
  const verificationToken = searchParams.get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState('');

  async function handleRegister(event) {
    event.preventDefault();
    setFeedback('');
    try {
      const response = await register({ email: email.trim(), password });
      setFeedback(response.message);
      onRegistered?.(response);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  async function handleVerifyToken() {
    if (!verificationToken) return;
    setFeedback('');
    try {
      const response = await verifyEmail(verificationToken);
      setFeedback(response.message);
    } catch (error) {
      setFeedback(error.message);
    }
  }

  if (verificationToken) {
    return (
      <section className="panel" aria-labelledby="verify-heading">
        <h1 id="verify-heading">Verify University E-mail</h1>
        <p>Confirm your 24-hour verification link to activate your campus account (FR-03).</p>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={handleVerifyToken}>
            Confirm verification link
          </button>
          <Link to="/login">Proceed to login</Link>
        </div>
        {feedback && <p role="status">{feedback}</p>}
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="register-heading">
      <h1 id="register-heading">Register with University E-mail</h1>
      <p style={{ color: 'var(--muted)' }}>
        Only allowed university domains (initially <code>@etu.edu.tr</code>) are accepted. A unique display alias is assigned automatically (FR-01, FR-04).
      </p>
      <form className="form-stack" onSubmit={handleRegister}>
        <div className="field-group">
          <label htmlFor="register-email">University e-mail</label>
          <input
            id="register-email"
            type="email"
            maxLength={254}
            placeholder="student@etu.edu.tr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field-group">
          <label htmlFor="register-password">Password (8–72 chars, at least 1 uppercase and 1 digit)</label>
          <input
            id="register-password"
            type="password"
            minLength={8}
            maxLength={72}
            pattern="^(?=.*[A-Z])(?=.*\d).+$"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {feedback && <p role="status">{feedback}</p>}
        <div className="row-actions">
          <button type="submit" className="btn btn-primary">Register</button>
          <Link to="/login">Already verified? Log in</Link>
        </div>
      </form>
    </section>
  );
}