import { useState } from "react";
import API from "../api/axios";
import DashboardLayout from "../components/DashboardLayout";

const CreateEmergency = () => {
  const [form, setForm] = useState({
    patientName: "",
    patientAge: "",
    gender: "Male",
    emergencyType: "",
    severity: "Low",
    symptoms: "",
    notes: "",
    hospital: "6a267c1af681af78208830ab" // Apollo Hospital ID
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await API.post("/emergency-requests", {
        ...form,
        symptoms: form.symptoms.split(","),
      });

      alert("Emergency Created Successfully");
    } catch (err) {
      console.error(err);
      alert("Failed");
    }
  };

  return (
    <DashboardLayout>
      <h1>Create Emergency</h1>

      <form onSubmit={handleSubmit}>
        <input
          name="patientName"
          placeholder="Patient Name"
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="patientAge"
          placeholder="Age"
          onChange={handleChange}
        />

        <br /><br />

        <input
          name="emergencyType"
          placeholder="Emergency Type"
          onChange={handleChange}
        />

        <br /><br />

        <textarea
          name="symptoms"
          placeholder="Chest Pain, Fever"
          onChange={handleChange}
        />

        <br /><br />

        <button type="submit">
          Create Emergency
        </button>
      </form>
    </DashboardLayout>
  );
};

export default CreateEmergency;