import { Link } from "react-router-dom";

const Sidebar = () => {
  return (
    <div
      style={{
        width: "250px",
        height: "100vh",
        background: "#0a0f1e",
        color: "white",
        padding: "20px",
      }}
    >
      <h2>SurgiConnect</h2>

      <div style={{ marginTop: "30px" }}>
        <p><Link to="/dashboard">Dashboard</Link></p>
        <p><Link to="/emergencies">Emergencies</Link></p>
        <p><Link to="/notifications">Notifications</Link></p>
        <p><Link to="/create-emergency">Create Emergency</Link></p>
      </div>
    </div>
  );
};

export default Sidebar;