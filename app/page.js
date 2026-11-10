'use client';

import { useCallback, useEffect, useState } from 'react';
import Bunny from '@/components/Bunny';
import { computePay, paidMs, roundTime } from '@/lib/pay';

const START_LINES = ["Let's brew some money! ☕", 'Apron on, ears up! 🐰', 'Espresso mode: ON ⚡', 'Table 4 needs carrots! 🥕'];
const WORK_LINES = ['Hop hop, serving tables…', 'Cappuccino for table 7!', 'Tips go in the carrot jar 🥕', 'Smile, you are on shift 😄'];
const STOP_LINES = ['Shift done! Feet up! 🎉', 'Money in the burrow! 💶', 'Bye bye coffee machine! 👋', 'Nap time, well deserved 😴'];
const IDLE_LINES = ['Zzz… wake me for the next shift', 'Off duty. Dreaming of carrots.'];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const pad = (n) => String(n).padStart(2, '0');

function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
}
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
const fmtTime = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const fmtDay = (ms) => new Date(ms).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
const toInput = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromInput = (v) => (v ? new Date(v).getTime() : null);

async function api(url, opts = {}) {
  // absolute URL from origin, so it also works if the page was opened as https://user:pass@host
  const res = await fetch(new URL(url, window.location.origin), { cache: 'no-store', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 401) {
    window.location.replace('/login');
    throw new Error('Not logged in');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export default function Home() {
  const today = new Date();
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [data, setData] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState('idle');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // {id|null, start, end}
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const from = new Date(month.y, month.m, 1).getTime();
    const to = new Date(month.y, month.m + 1, 1).getTime();
    try {
      setData(await api(`/api/shifts?from=${from}&to=${to}`));
    } catch (e) {
      setError(e.message);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // set bunny mode on first load
  useEffect(() => {
    if (!data || mode === 'starting' || mode === 'stopping') return;
    const next = data.active ? 'working' : 'idle';
    if (next !== mode) {
      setMode(next);
      setMessage(pick(next === 'working' ? WORK_LINES : IDLE_LINES));
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // change the bunny's chatter every so often while working
  useEffect(() => {
    if (mode !== 'working') return;
    const t = setInterval(() => setMessage(pick(WORK_LINES)), 12000);
    return () => clearInterval(t);
  }, [mode]);

  async function start() {
    setBusy(true); setError('');
    try {
      await api('/api/shifts/start', { method: 'POST' });
      if (navigator.vibrate) navigator.vibrate(60);
      setMode('starting'); setMessage(pick(START_LINES));
      setTimeout(() => { setMode('working'); }, 2600);
      setMonth({ y: new Date().getFullYear(), m: new Date().getMonth() });
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function stop() {
    setBusy(true); setError('');
    try {
      await api('/api/shifts/stop', { method: 'POST' });
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      setMode('stopping'); setMessage(pick(STOP_LINES));
      setTimeout(() => { setMode('idle'); setMessage(pick(IDLE_LINES)); }, 3500);
      await load();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function saveEdit(e) {
    e.preventDefault();
    setError('');
    const body = JSON.stringify({ start_at: fromInput(editing.start), end_at: fromInput(editing.end) });
    try {
      if (editing.id) await api(`/api/shifts/${editing.id}`, { method: 'PATCH', body });
      else await api('/api/shifts', { method: 'POST', body });
      setEditing(null);
      await load();
    } catch (err) { setError(err.message); }
  }

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.replace('/login');
  }

  async function remove(id) {
    if (!confirm('Delete this shift? 🐰💔')) return;
    await api(`/api/shifts/${id}`, { method: 'DELETE' });
    await load();
  }

  const active = data?.active;
  const pay = data?.pay;
  const shifts = data?.shifts || [];
  const durationOf = (s) => paidMs(s, now); // rounded to the half hour
  const totalMs = shifts.reduce((acc, s) => acc + durationOf(s), 0);
  const totals = pay ? computePay(totalMs / 3600000, pay) : null;
  const monthLabel = new Date(month.y, month.m, 1).toLocaleDateString([], { month: 'long', year: 'numeric' });
  const shiftMonth = (d) => setMonth(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  return (
    <main className="wrap">
      <header className="top">
        <button className="logout" onClick={logout} aria-label="Log out">🚪 Log out</button>
        <h1>Bunny Shifts <span aria-hidden>🐰</span></h1>
        <p className="sub">{active ? 'On shift — hop hop!' : 'Off duty'}</p>
      </header>

      <section className="card hero">
        <Bunny mode={mode} message={message} />

        {active ? (
          <div className="timer">
            <div className="clock">{fmtClock(now - active.start_at)}</div>
            <div className="since">paid from {fmtTime(roundTime(active.start_at))} · {eur.format(computePay(paidMs(active, now) / 3600000, pay).money)} so far</div>
          </div>
        ) : (
          <div className="timer"><div className="since">Ready when you are ☕</div></div>
        )}

        {active ? (
          <button className="big stop" onClick={stop} disabled={busy}>🛑 Stop shift</button>
        ) : (
          <button className="big start" onClick={start} disabled={busy || !data}>☕ Start shift</button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <div className="month-nav">
          <button onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
          <h2>{monthLabel}</h2>
          <button onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
        </div>

        {totals && (
          <>
            <div className="stats">
              <div className="stat"><span className="label">Hours</span><span className="value">{fmtDuration(totalMs)}</span></div>
              <div className="stat"><span className="label">Shifts</span><span className="value">{shifts.length}</span></div>
              <div className="stat money"><span className="label">Expected</span><span className="value">{eur.format(totals.money)}</span></div>
            </div>
            <div className="split">
              <div>
                <b>{Math.round(totals.shareA * 100)}%</b> @ {eur.format(pay.rateA)}/h
                <small>{totals.hA.toFixed(2)} h → {eur.format(totals.moneyA)}</small>
              </div>
              <div>
                <b>{100 - Math.round(totals.shareA * 100)}%</b> @ {eur.format(pay.rateB)}/h
                <small>{totals.hB.toFixed(2)} h → {eur.format(totals.moneyB)}</small>
              </div>
            </div>
          </>
        )}
      </section>

      <details className="card shifts-box">
        <summary>
          <span className="sum-title">Shifts of {monthLabel}</span>
          <span className="sum-info">
            <b>{fmtDuration(totalMs)}</b>
            <b className="sum-money">{totals ? eur.format(totals.money) : '—'}</b>
          </span>
          <span className="chev" aria-hidden>▾</span>
        </summary>

        <div className="list-head">
          <span className="muted">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</span>
          <button className="ghost" onClick={() => setEditing({ id: null, start: toInput(Date.now() - 4 * 3600000), end: toInput(Date.now()) })}>+ Add</button>
        </div>

        {editing && (
          <form className="edit" onSubmit={saveEdit}>
            <label>Start<input type="datetime-local" value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} required /></label>
            <label>End<input type="datetime-local" value={editing.end} onChange={(e) => setEditing({ ...editing, end: e.target.value })} required={!editing.running} /></label>
            <div className="row">
              <button type="submit" className="small start">Save</button>
              <button type="button" className="small ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}

        {shifts.length === 0 && <p className="empty">No shifts this month. The bunny is bored. 🥱</p>}

        <ul className="shifts">
          {shifts.map((s) => (
            <li key={s.id} className={s.end_at ? '' : 'live'}>
              <div className="when">
                <b>{fmtDay(s.start_at)}</b>
                <span>{fmtTime(roundTime(s.start_at))} – {s.end_at ? fmtTime(roundTime(s.end_at)) : 'now'}</span>
                {(roundTime(s.start_at) !== s.start_at || (s.end_at && roundTime(s.end_at) !== s.end_at)) && (
                  <small className="clocked">clocked {fmtTime(s.start_at)} – {s.end_at ? fmtTime(s.end_at) : 'now'}</small>
                )}
              </div>
              <div className="dur">
                <b>{fmtDuration(durationOf(s))}</b>
                <span>{eur.format(computePay(durationOf(s) / 3600000, pay).money)}</span>
              </div>
              <div className="acts">
                <button aria-label="Edit" onClick={() => setEditing({ id: s.id, running: !s.end_at, start: toInput(s.start_at), end: s.end_at ? toInput(s.end_at) : '' })}>✏️</button>
                <button aria-label="Delete" onClick={() => remove(s.id)}>🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      </details>

      <footer className="foot">Made with 🥕 for the best waitress in town</footer>
    </main>
  );
}
