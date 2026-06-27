import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Login from "./pages/Login";
import Unauthorized from "./pages/Unauthorized";
import ProtectedRoute from "./routes/ProtectedRoute";

import ManagerDashboard from "./pages/ManagerDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import Emergencies from "./pages/Emergencies";
import AssignDoctor from "./pages/AssignDoctor";
import CreateEmergency from "./pages/CreateEmergency";

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* Manager Routes */}
      <Route element={<ProtectedRoute roles={["manager"]} />}>
  <Route path="/dashboard" element={<ManagerDashboard />} />

  <Route
    path="/emergencies"
    element={<Emergencies />}
  />

  <Route
    path="/create-emergency"
    element={<CreateEmergency />}
  />

  <Route
    path="/assign-doctor/:id"
    element={<AssignDoctor />}
  />
</Route>

      {/* Doctor Routes */}
      <Route element={<ProtectedRoute roles={["doctor"]} />}>
        <Route
          path="/doctor-dashboard"
          element={<DoctorDashboard />}
        />
      </Route>

      <Route
        path="/"
        element={
          user?.role === "manager" ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/doctor-dashboard" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;