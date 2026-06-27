import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Login = () => {
  const { login, isAuthenticated, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  // If already logged in, redirect immediately
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectByRole(user.role);
    }
  }, [isAuthenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const redirectByRole = (role) => {
    const from = location.state?.from?.pathname;
    if (from && from !== "/login") {
      navigate(from, { replace: true });
      return;
    }
    navigate(role === "manager" ? "/dashboard" : "/emergencies", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(email.trim().toLowerCase(), password);
      redirectByRole(loggedInUser.role);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Invalid credentials. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="sc-root">
        {/* Left panel — brand */}
        <div className="sc-brand">
          <div className="sc-brand-inner">
            <div className="sc-logo">
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <rect width="44" height="44" rx="12" fill="#38bdf8" fillOpacity="0.12" />
                <path d="M22 10v24M10 22h24" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="22" cy="22" r="5" fill="#38bdf8" fillOpacity="0.3"/>
              </svg>
              <span className="sc-logo-text">SurgiConnect</span>
            </div>

            <div className="sc-tagline">
              <h1 className="sc-headline">Emergency coordination.<br />Zero delay.</h1>
              <p className="sc-sub">
                AI-powered specialist matching and real-time surgical team
                coordination — from the moment the emergency arrives.
              </p>
            </div>

            <div className="sc-stats">
              <div className="sc-stat">
                <span className="sc-stat-num">98%</span>
                <span className="sc-stat-label">Assignment accuracy</span>
              </div>
              <div className="sc-stat-divider" />
              <div className="sc-stat">
                <span className="sc-stat-num">&lt;90s</span>
                <span className="sc-stat-label">Avg. doctor notified</span>
              </div>
              <div className="sc-stat-divider" />
              <div className="sc-stat">
                <span className="sc-stat-num">24/7</span>
                <span className="sc-stat-label">Live monitoring</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="sc-form-panel">
          <div className="sc-form-card">
            <div className="sc-form-header">
              <h2 className="sc-form-title">Sign in</h2>
              <p className="sc-form-sub">Access your SurgiConnect workspace</p>
            </div>

            {error && (
              <div className="sc-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 11h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="sc-field">
                <label className="sc-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="sc-input"
                  placeholder="you@hospital.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div className="sc-field">
                <label className="sc-label" htmlFor="password">Password</label>
                <div className="sc-input-wrap">
                  <input
                    id="password"
                    type={showPass ? "text" : "password"}
                    className="sc-input sc-input-padded"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="sc-eye"
                    onClick={() => setShowPass((p) => !p)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`sc-btn${loading ? " sc-btn-loading" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  <><span className="sc-btn-spinner" /> Signing in…</>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            <p className="sc-footer-note">
              Access is restricted to authorised hospital staff.
              <br />Contact your administrator for an account.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const Eye = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Sora:wght@600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .sc-root {
    min-height: 100vh;
    display: flex;
    font-family: 'Inter', sans-serif;
    background: #0a0f1e;
    color: #e2e8f0;
  }

  /* ── Left brand panel ── */
  .sc-brand {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 48px;
    background: linear-gradient(135deg, #0a0f1e 0%, #0d1a2e 60%, #0a1628 100%);
    border-right: 1px solid rgba(56,189,248,0.08);
    position: relative;
    overflow: hidden;
  }
  .sc-brand::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 60% 50% at 30% 40%, rgba(56,189,248,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .sc-brand-inner {
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 48px;
    position: relative;
    z-index: 1;
  }
  .sc-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sc-logo-text {
    font-family: 'Sora', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #f0f9ff;
    letter-spacing: -0.3px;
  }
  .sc-headline {
    font-family: 'Sora', sans-serif;
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 700;
    line-height: 1.18;
    color: #f0f9ff;
    letter-spacing: -0.5px;
  }
  .sc-sub {
    margin-top: 16px;
    font-size: 15px;
    line-height: 1.7;
    color: #7ea6c4;
  }
  .sc-stats {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 24px;
    background: rgba(56,189,248,0.05);
    border: 1px solid rgba(56,189,248,0.12);
    border-radius: 14px;
  }
  .sc-stat { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .sc-stat-num {
    font-family: 'Sora', sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: #38bdf8;
  }
  .sc-stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.6px; }
  .sc-stat-divider { width: 1px; height: 36px; background: rgba(56,189,248,0.12); flex-shrink: 0; }

  /* ── Right form panel ── */
  .sc-form-panel {
    width: 480px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
    background: #0d1117;
  }
  .sc-form-card { width: 100%; max-width: 380px; }
  .sc-form-header { margin-bottom: 32px; }
  .sc-form-title {
    font-family: 'Sora', sans-serif;
    font-size: 26px;
    font-weight: 700;
    color: #f0f9ff;
    letter-spacing: -0.3px;
  }
  .sc-form-sub { margin-top: 6px; font-size: 14px; color: #64748b; }

  /* Error banner */
  .sc-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.25);
    border-radius: 8px;
    font-size: 13.5px;
    color: #fca5a5;
    margin-bottom: 24px;
  }

  /* Form fields */
  .sc-field { margin-bottom: 20px; }
  .sc-label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 7px;
    letter-spacing: 0.2px;
  }
  .sc-input {
    width: 100%;
    padding: 11px 14px;
    background: #161d2e;
    border: 1px solid rgba(56,189,248,0.14);
    border-radius: 8px;
    color: #e2e8f0;
    font-size: 14.5px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .sc-input:focus {
    border-color: rgba(56,189,248,0.5);
    box-shadow: 0 0 0 3px rgba(56,189,248,0.08);
  }
  .sc-input::placeholder { color: #334155; }
  .sc-input:disabled { opacity: 0.5; cursor: not-allowed; }
  .sc-input-wrap { position: relative; }
  .sc-input-padded { padding-right: 44px; }
  .sc-eye {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #475569;
    display: flex;
    align-items: center;
    padding: 2px;
    transition: color 0.15s;
  }
  .sc-eye:hover { color: #94a3b8; }

  /* Submit button */
  .sc-btn {
    width: 100%;
    margin-top: 8px;
    padding: 12px;
    background: #38bdf8;
    color: #0a0f1e;
    font-family: 'Sora', sans-serif;
    font-size: 14.5px;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.18s, opacity 0.18s;
  }
  .sc-btn:hover:not(:disabled) { background: #7dd3fc; }
  .sc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .sc-btn-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(10,15,30,0.3);
    border-top-color: #0a0f1e;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .sc-footer-note {
    margin-top: 28px;
    font-size: 12.5px;
    color: #334155;
    line-height: 1.6;
    text-align: center;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Responsive */
  @media (max-width: 820px) {
    .sc-root { flex-direction: column; }
    .sc-brand { display: none; }
    .sc-form-panel { width: 100%; min-height: 100vh; padding: 48px 24px; }
  }
`;

export default Login;
