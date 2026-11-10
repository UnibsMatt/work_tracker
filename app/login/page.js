'use client';

import { useState } from 'react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Login failed');
      window.location.replace('/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="wrap login-wrap">
      <form className={`card login ${error ? 'shake' : ''}`} onSubmit={submit} key={error}>
        <div className="login-bunny" aria-hidden>
          <span className="peek">🐰</span>
          <span className="cup">☕</span>
        </div>
        <h1>Bunny Shifts</h1>
        <p className="sub">Clock in, clock out, count the carrots.</p>

        <label>
          Username
          <input
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label>
          Password
          <div className="pw">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? '🙈' : '👀'}
            </button>
          </div>
        </label>

        {error && <p className="error">{error}</p>}

        <button className="big start" disabled={busy}>{busy ? 'Hopping in…' : 'Hop in 🥕'}</button>
      </form>
    </main>
  );
}
