import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Unauthorized = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleBack = () => {
  if (user?.role === "manager") {
    navigate("/dashboard", { replace: true });
  } else if (user?.role === "doctor") {
    navigate("/doctor-dashboard", { replace: true });
  } else {
    navigate("/login", { replace: true });
  }
};

  return (
    <>
      <style>{css}</style>
      <div className="ua-root">
        <div className="ua-card">
          {/* Shield icon */}
          <div className="ua-icon">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path
                d="M26 4L6 13v13c0 11.05 8.56 21.38 20 23.87C37.44 47.38 46 37.05 46 26V13L26 4z"
                fill="rgba(248,113,113,0.1)"
                stroke="#f87171"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M26 20v8M26 32h.01"
                stroke="#f87171"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="ua-code">403</div>
          <h1 className="ua-title">Access restricted</h1>
          <p className="ua-desc">
            Your account role{user?.role ? ` (${user.role})` : ""} does not
            have permission to view this page. If you believe this is a mistake,
            contact your administrator.
          </p>

          <div className="ua-actions">
            {user ? (
              <button className="ua-btn ua-btn-primary" onClick={handleBack}>
                Go to my dashboard
              </button>
            ) : (
              <button
                className="ua-btn ua-btn-primary"
                onClick={() => navigate("/login", { replace: true })}
              >
                Back to sign in
              </button>
            )}
            {user && (
              <button
                className="ua-btn ua-btn-ghost"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Sora:wght@600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ua-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0f1e;
    font-family: 'Inter', sans-serif;
    padding: 24px;
  }
  .ua-card {
    max-width: 420px;
    width: 100%;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .ua-icon {
    width: 80px; height: 80px;
    border-radius: 50%;
    background: rgba(248,113,113,0.06);
    border: 1px solid rgba(248,113,113,0.15);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 8px;
  }
  .ua-code {
    font-family: 'Sora', sans-serif;
    font-size: 64px;
    font-weight: 700;
    color: rgba(248,113,113,0.25);
    line-height: 1;
    letter-spacing: -2px;
  }
  .ua-title {
    font-family: 'Sora', sans-serif;
    font-size: 24px;
    font-weight: 700;
    color: #f0f9ff;
    letter-spacing: -0.3px;
  }
  .ua-desc {
    font-size: 14.5px;
    color: #64748b;
    line-height: 1.7;
    max-width: 340px;
  }
  .ua-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 8px;
  }
  .ua-btn {
    width: 100%;
    padding: 11px;
    border-radius: 8px;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.18s, color 0.18s;
  }
  .ua-btn-primary { background: #38bdf8; color: #0a0f1e; }
  .ua-btn-primary:hover { background: #7dd3fc; }
  .ua-btn-ghost {
    background: transparent;
    color: #475569;
    border: 1px solid rgba(255,255,255,0.07);
  }
  .ua-btn-ghost:hover { color: #94a3b8; border-color: rgba(255,255,255,0.14); }
`;

export default Unauthorized;
