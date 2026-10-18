'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Check,
  Eye,
  EyeOff,
  GitBranch,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { Button } from './ui';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register';
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  useEffect(() => {
    const theme = localStorage.getItem('nexus-theme');
    if (theme) document.documentElement.dataset.theme = theme;
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'alter_auth_failed') {
      const reason = params.get('reason');
      setError(reason === 'profile' ? 'Alter One did not return a verified email.' : reason === 'token' ? 'Alter One authorization could not be exchanged. Please try again.' : 'Alter One login was not completed. Please try again.');
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setFields({});
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.details) {
          const errors: Record<string, string> = {};
          for (const issue of result.details as { path: string[]; message: string }[])
            if (issue.path[0]) errors[issue.path[0]] = issue.message;
          setFields(errors);
        }
        setError(
          result.error === 'Invalid request'
            ? 'Please check the highlighted fields.'
            : (result.error ?? 'Unable to sign in. Please try again.'),
        );
        setBusy(false);
        return;
      }
      sessionStorage.removeItem('nexus-token');
      window.location.replace('/');
    } catch {
      setError('Could not connect. Check your connection and try again.');
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <Link href="/login" className="auth-brand">
          <NexusMark />
          <span>
            Nexus<span>Ops</span>
          </span>
          <i />
        </Link>
        <div className="auth-story-main">
          <span className="auth-orbit">
            <GitBranch size={31} />
          </span>
          <h1>
            Your team.
            <br />
            In good hands.
          </h1>
          <p>
            Human work. External worker queues.
            <br />
            One project workspace to move forward.
          </p>
          <div className="auth-relay" aria-label="Projects route tasks to workers and human review">
            <span className="auth-agent">
              <Terminal size={16} />
              <span>Project</span>
            </span>
            <motion.span
              initial={{ opacity: 0.4 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <ArrowRight size={18} />
            </motion.span>
            <span className="auth-agent qa">
              <Bot size={16} />
              <span>Worker queue</span>
            </span>
            <ArrowRight size={18} />
            <span className="auth-human">
              <Check size={14} />
              <span>You</span>
            </span>
          </div>
          <div className="auth-story-note">
            <ShieldCheck size={16} />
            <span>
              Agent work. Human judgment.
              <br />
              <strong>You’re always in control.</strong>
            </span>
          </div>
        </div>
        <footer>
          <span className="breathing-dot" />
          Built for the next way of working.
        </footer>
      </aside>
      <main className="auth-main">
        <div className="auth-switch">
          <span>{registering ? 'Already part of the team?' : 'New to NexusOps?'}</span>
          <Link href={registering ? '/login' : '/register'}>
            {registering ? 'Sign in' : 'Create an account'}
            <ArrowRight size={13} />
          </Link>
        </div>
        <motion.section
          className="auth-form-section"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          aria-labelledby="auth-title"
        >
          <span className="auth-form-icon">
            <LockKeyhole size={21} />
          </span>
          <h2 id="auth-title">{registering ? 'Make yourself at home.' : 'Welcome back.'}</h2>
          <p>
            {registering
              ? 'Create your account and start with an empty workspace.'
              : 'Sign in to your NexusOps workspace.'}
          </p>
          <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            {registering && (
              <label htmlFor="name">
                Full name
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Your name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                  aria-invalid={!!fields.name}
                  aria-describedby={fields.name ? 'name-error' : undefined}
                />
                {fields.name && (
                  <small id="name-error" className="auth-field-error">
                    {fields.name}
                  </small>
                )}
              </label>
            )}
            <label htmlFor="email">
              Email address
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
                maxLength={254}
                autoFocus={!registering}
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? 'email-error' : undefined}
              />
              {fields.email && (
                <small id="email-error" className="auth-field-error">
                  {fields.email}
                </small>
              )}
            </label>
            <label htmlFor="password">
              Password
              <div className="auth-password">
                <input
                  id="password"
                  aria-label="Password"
                  name="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  placeholder={registering ? 'At least 12 characters' : 'Enter your password'}
                  required
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  aria-invalid={!!fields.password}
                  aria-describedby={
                    fields.password ? 'password-error' : registering ? 'password-hint' : undefined
                  }
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  aria-pressed={visible}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {fields.password ? (
                <small id="password-error" className="auth-field-error">
                  {fields.password}
                </small>
              ) : (
                registering && (
                  <small id="password-hint">
                    Use at least 12 characters. A memorable phrase works well.
                  </small>
                )
              )}
            </label>
            {registering && (
              <label htmlFor="confirm_password">
                Confirm password
                <input
                  id="confirm_password"
                  aria-label="Confirm password"
                  name="confirm_password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  required
                  minLength={12}
                  maxLength={128}
                  aria-invalid={!!fields.confirm_password}
                  aria-describedby={fields.confirm_password ? 'confirm-error' : undefined}
                />
                {fields.confirm_password && (
                  <small id="confirm-error" className="auth-field-error">
                    {fields.confirm_password}
                  </small>
                )}
              </label>
            )}
            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" className="primary auth-submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  {registering ? 'Creating your account…' : 'Signing you in…'}
                </>
              ) : (
                <>
                  {registering ? 'Create account' : 'Sign in'}
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
          {!registering && <a className="alter-one-button" href={typeof window !== 'undefined' && window.location.hostname === '0.0.0.0' ? 'http://localhost:3000/api/auth/alter/start' : '/api/auth/alter/start'}><span className="alter-one-brand"><img src="https://one.alterindonesia.com/logo-alter.webp" alt="Alter One" />Continue with Alter One</span><ArrowRight size={15} /></a>}
          <div className="auth-form-footer">
            <LockKeyhole size={12} />
            <span>Your people. Your projects. Your workspace.</span>
          </div>
        </motion.section>
        <footer className="auth-main-footer">
          NEXUSOPS<span>Human by default.</span>
        </footer>
      </main>
    </div>
  );
}
function NexusMark() {
  return (
    <svg viewBox="0 0 32 32" width="29" height="29" fill="none" aria-hidden="true">
      <path d="M4 9.5 16 3l12 6.5v13L16 29 4 22.5v-13Z" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="m4 9.5 12 7 12-7M16 16.5V29M10 6.3l12 7v13M4 16l12 7 12-7M10 26V13l12-7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
