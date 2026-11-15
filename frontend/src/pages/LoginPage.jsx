import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { login } from '../api/unihelpApi.js';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatusMessage('');
    try {
      const account = await login({ email: email.trim(), password });
      setStatusMessage(`Signed in as ${account.displayAlias}`);
      onLoginSuccess?.(account);
    } catch (error) {
      setStatusMessage(error.message);
    }
  }

  return (
    <section className="panel" aria-labelledby="login-heading">
      <h1 id="login-heading">Log In with University E-mail</h1>
      <p style={{ color: 'var(--muted)' }}>
        Sign in with your verified campus account. Accounts lock for 15 minutes after 5 consecutive failed attempts (FR-05).
      </p>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="login-email">University e-mail</label>
          <input
            id="login-email"
            type="email"
            maxLength={254}
            placeholder="student@etu.edu.tr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field-group">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {statusMessage && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{statusMessage}</p>}
        <div className="row-actions">
          <button type="submit" className="btn btn-primary">Log in</button>
          <Link to="/register">Need an account? Register</Link>
        </div>
      </form>
    </section>
  );
}