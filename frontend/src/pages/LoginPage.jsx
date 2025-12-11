// src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { setCurrentUser } from "../auth/user";

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      const user = res.data?.user;
      if (!user) {
        setError("Login failed: no user returned from server.");
        return;
      }

      // Save user in localStorage and lift to App
      setCurrentUser(user);
      if (onLogin) {
        onLogin(user);
      }

      navigate("/");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1.5rem",
      }}
    >
      {/* Glass card */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "18px",
          padding: "1.8rem 2rem 2rem",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.94))",
          border: "1px solid rgba(148,163,184,0.5)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.85)",
          color: "#e5e7eb",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: "0.4rem",
            fontSize: "1.4rem",
          }}
        >
          Welcome back
        </h2>
        <p
          style={{
            marginTop: 0,
            marginBottom: "1.2rem",
            fontSize: "0.9rem",
            color: "#9ca3af",
          }}
        >
          Sign in to manage your orders, wallet, and AI-powered
          recommendations.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "10px",
                border: "1px solid #64748b",
                backgroundColor: "rgba(15,23,42,0.75)",
                color: "#e5e7eb",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.boxShadow =
                  "0 0 0 2px rgba(59,130,246,0.45)")
              }
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "10px",
                border: "1px solid #64748b",
                backgroundColor: "rgba(15,23,42,0.75)",
                color: "#e5e7eb",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.boxShadow =
                  "0 0 0 2px rgba(59,130,246,0.45)")
              }
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>

          {error && (
            <p
              style={{
                color: "#fca5a5",
                backgroundColor: "rgba(127,29,29,0.25)",
                borderRadius: "8px",
                padding: "0.45rem 0.6rem",
                fontSize: "0.82rem",
                marginTop: "0.2rem",
                marginBottom: "0.75rem",
                border: "1px solid rgba(248,113,113,0.6)",
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              padding: "0.6rem 1rem",
              borderRadius: "999px",
              border: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: submitting ? "not-allowed" : "pointer",
              background:
                "linear-gradient(135deg, #22c55e, #16a34a)",
              color: "#0b1120",
              marginTop: "0.35rem",
              boxShadow: "0 12px 30px rgba(21,128,61,0.55)",
              transition:
                "transform 80ms ease, box-shadow 80ms ease, filter 80ms ease",
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(1px)";
              e.currentTarget.style.boxShadow =
                "0 8px 20px rgba(21,128,61,0.5)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 12px 30px rgba(21,128,61,0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 12px 30px rgba(21,128,61,0.55)";
            }}
          >
            {submitting ? "Signing you in…" : "Login"}
          </button>
        </form>

        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.85rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            style={{
              color: "#38bdf8",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            Register here
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
