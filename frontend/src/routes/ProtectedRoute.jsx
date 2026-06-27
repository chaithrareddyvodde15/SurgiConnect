import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute
 *
 * Usage:
 *   <Route element={<ProtectedRoute />}>               — any authenticated user
 *   <Route element={<ProtectedRoute roles={["manager"]} />}>  — manager only
 *   <Route element={<ProtectedRoute roles={["doctor"]}  />}>  — doctor only
 */
const ProtectedRoute = ({ roles = [] }) => {
  const { isAuthenticated, hasRole, loading } = useAuth();
  const location = useLocation();

  // Wait for localStorage hydration before making any redirect decision
  if (loading) {
    return (
      <div style={styles.splash}>
        <div style={styles.spinner} />
      </div>
    );
  }

  // Not logged in → send to /login, preserve intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but wrong role → send to /unauthorized
  if (roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

const styles = {
  splash: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    minHeight:      "100vh",
    background:     "#0a0f1e",
  },
  spinner: {
    width:        "36px",
    height:       "36px",
    borderRadius: "50%",
    border:       "3px solid rgba(56,189,248,0.2)",
    borderTop:    "3px solid #38bdf8",
    animation:    "spin 0.8s linear infinite",
  },
};

export default ProtectedRoute;
