import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { logout, user } = useAuth();

  return (
    <div
      style={{
        height: "70px",
        background: "white",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
      }}
    >
      <h3>Welcome, {user?.name}</h3>

      <button onClick={logout}>
        Logout
      </button>
    </div>
  );
};

export default Navbar;