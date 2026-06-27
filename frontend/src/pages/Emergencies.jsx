import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import DashboardLayout from "../components/DashboardLayout";

const Emergencies = () => {
  const [emergencies, setEmergencies] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmergencies();
  }, []);

  const fetchEmergencies = async () => {
    try {
      const { data } = await API.get("/emergency-requests");
      setEmergencies(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <h1>Emergency Requests</h1>

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {emergencies.map((e) => (
            <tr key={e._id}>
              <td>{e.patientName}</td>
              <td>{e.emergencyType}</td>
              <td>{e.severity}</td>
              <td>{e.status}</td>

              <td>
                <button
                  onClick={() =>
                    alert(`Emergency ID: ${e._id}`)
                  }
                >
                  View
                </button>

                <button
                  style={{ marginLeft: "10px" }}
                  onClick={() =>
                    navigate(`/assign-doctor/${e._id}`)
                  }
                >
                  Assign Doctor
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardLayout>
  );
};

export default Emergencies;