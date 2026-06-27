import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/axios";

function AssignDoctor() {
  const { id } = useParams();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await API.get("/doctors");
      setDoctors(res.data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch doctors");
    } finally {
      setLoading(false);
    }
  };

  const assignDoctor = async (doctorUserId) => {
    try {
      const res = await API.post(
        `/assignments/${id}/assign`,
        {
          doctors: [
            {
              doctorId: doctorUserId,
            },
          ],
        }
      );

      console.log(res.data);

      alert("Doctor assigned successfully");

      window.location.href = "/emergencies";
    } catch (err) {
      console.error(err);

      alert(
        err.response?.data?.message ||
        "Assignment failed"
      );
    }
  };

  if (loading) {
    return <h2>Loading doctors...</h2>;
  }

  return (
    <div style={{ padding: "30px" }}>
      <h1>Assign Doctor</h1>

      <p>
        Emergency ID:
        <b> {id}</b>
      </p>

      <br />

      <div
        style={{
          display: "flex",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        {doctors.map((doctor) => (
          <div
            key={doctor._id}
            style={{
              width: "280px",
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "20px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}
          >
            <h3>{doctor.userId?.name}</h3>

            <p>
              <b>Email:</b> {doctor.userId?.email}
            </p>

            <p>
              <b>Specialization:</b>{" "}
              {doctor.specialization}
            </p>

            <p>
              <b>Availability:</b>{" "}
              {doctor.availability}
            </p>

            <p>
              <b>Fee:</b> ₹{doctor.fee}
            </p>

            <button
              onClick={() =>
                assignDoctor(doctor.userId._id)
              }
              style={{
                marginTop: "10px",
                padding: "10px 15px",
                cursor: "pointer",
              }}
            >
              Assign Doctor
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AssignDoctor;