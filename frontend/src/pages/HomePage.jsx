import { Link } from "react-router-dom";

function HomePage() {
  return (
    <div style={{ padding: "1.5rem" }}>
      <h1>Restaurant AI System</h1>
      <p>Welcome! This is the home page.</p>

      <div style={{ marginTop: "1rem" }}>
        <Link to="/login" style={{ marginRight: "1rem" }}>
          Login
        </Link>
        <Link to="/register">Register</Link>
      </div>
    </div>
  );
}

export default HomePage;
