import { useEffect, useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../context/AuthContext";

function DoctorDashboard() {
  const { user } = useAuth();

  const [emergencies, setEmergencies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssignedEmergencies();
  }, []);

  const fetchAssignedEmergencies = async () => {
    try {
      console.log("Logged in user:", user);

      const res = await API.get(
        `/assignments/doctor/${user._id}`
      );

      console.log("API Response:", res.data);

      setEmergencies(res.data.data || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load emergencies");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await API.patch(
        `/emergency-requests/${id}/status`,
        { status }
      );

      alert(`Marked as ${status}`);

      fetchAssignedEmergencies();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <h2>Loading...</h2>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <h1>Doctor Dashboard</h1>

      <br />

      {emergencies.length === 0 ? (
        <h3>No assigned emergencies</h3>
      ) : (
        emergencies.map((emergency) => (
          <div
            key={emergency._id}
            style={{
              border: "1px solid #ddd",
              padding: "20px",
              marginBottom: "20px",
              borderRadius: "10px",
            }}
          >
            <h2>{emergency.patientName}</h2>

            <p>
              <b>Emergency:</b>{" "}
              {emergency.emergencyType}
            </p>

            <p>
              <b>Severity:</b>{" "}
              {emergency.severity}
            </p>

            <p>
              <b>Status:</b>{" "}
              {emergency.status}
            </p>

            <p>
              <b>Notes:</b>{" "}
              {emergency.notes}
            </p>

            <button
              onClick={() =>
                updateStatus(
                  emergency._id,
                  "In Progress"
                )
              }
              style={{
                marginRight: "10px",
                padding: "8px 15px",
              }}
            >
              Start Treatment
            </button>

            <button
              onClick={() =>
                updateStatus(
                  emergency._id,
                  "Completed"
                )
              }
              style={{
                padding: "8px 15px",
              }}
            >
              Mark Completed
            </button>
          </div>
        ))
      )}
    </DashboardLayout>
  );
}

export default DoctorDashboard;