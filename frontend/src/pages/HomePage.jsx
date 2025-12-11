// src/pages/HomePage.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

import bgImg from "../../img/resto-welcome.jpg";

// Small reusable grid to show dishes
function DishGrid({ title, dishes }) {
  if (!dishes || dishes.length === 0) return null;

  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ marginBottom: "0.5rem" }}>{title}</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {dishes.map((d) => (
          <div
            key={d.dish_id}
            style={{
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "0.6rem",
              backgroundColor: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            {d.image_url && (
              <img
                src={d.image_url}
                alt={d.name}
                style={{
                  width: "100%",
                  height: "130px",
                  objectFit: "cover",
                  borderRadius: "6px",
                }}
              />
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.4rem",
                alignItems: "baseline",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  flexWrap: "wrap",
                }}
              >
                <strong>{d.name}</strong>
                {d.is_vip_only && (
                  <span
                    style={{
                      padding: "0.1rem 0.4rem",
                      borderRadius: "999px",
                      backgroundColor: "#fff3bf",
                      color: "#856404",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      border: "1px solid #ffe066",
                    }}
                  >
                    VIP
                  </span>
                )}
              </div>
              <span style={{ fontWeight: 600 }}>
                ${Number(d.price || 0).toFixed(2)}
              </span>
            </div>

            {d.description && (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#495057",
                  maxHeight: "3.3em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {d.description}
              </p>
            )}

            {/* Stats row */}
            <div
              style={{
                marginTop: "0.15rem",
                fontSize: "0.78rem",
                color: "#868e96",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              {d.times_ordered !== undefined && (
                <span>Ordered {d.times_ordered}×</span>
              )}
              {d.avg_rating !== undefined &&
                d.rating_count !== undefined &&
                d.rating_count > 0 && (
                  <span>
                    ⭐ {d.avg_rating.toFixed(1)} ({d.rating_count})
                  </span>
                )}
            </div>

            <div
              style={{
                marginTop: "0.45rem",
                display: "flex",
                justifyContent: "space-between",
                gap: "0.4rem",
              }}
            >
              <Link
                to="/menu"
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "999px",
                  border: "1px solid #0d6efd",
                  backgroundColor: "#e7f1ff",
                  color: "#0d6efd",
                  fontSize: "0.8rem",
                  textDecoration: "none",
                }}
              >
                View in menu
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HomePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchSummary(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchSummary(user) {
    setError("");
    setLoading(true);
    try {
      let url = "/recommendations/home-summary"; // axios baseURL already includes /api
      if (user && user.id) {
        url += `?user_id=${user.id}`;
      }
      const res = await api.get(url);
      setSummary(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  }

  const hasHistory = summary?.has_history;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Restaurant AI System</h1>

      {currentUser ? (
        <p style={{ color: "#555" }}>
          Hello, <strong>{currentUser.name}</strong>{" "}
          {currentUser.role === "vip" && (
            <span
              style={{
                marginLeft: "0.4rem",
                padding: "0.15rem 0.5rem",
                borderRadius: "999px",
                backgroundColor: "#fff3bf",
                color: "#856404",
                fontSize: "0.78rem",
                fontWeight: 600,
                border: "1px solid #ffe066",
              }}
            >
              ⭐ VIP
            </span>
          )}
          . Here’s what looks best for you right now.
        </p>
      ) : (
        <p style={{ color: "#555" }}>
          You&apos;re browsing as a visitor. We&apos;re showing{" "}
          <strong>most popular</strong> and <strong>highest-rated</strong>{" "}
          dishes from all customers.{" "}
          <Link to="/register">Create an account</Link> to get personalized
          recommendations based on your orders and ratings.
        </p>
      )}

      {error && (
        <p style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</p>
      )}

      {loading && <p>Loading recommendations...</p>}

      {!loading && summary && (
        <>
          {/* Personal section for logged-in users with history */}
          {hasHistory && (
            <>
              <DishGrid
                title="Your most ordered dishes"
                dishes={summary.personal?.most_ordered || []}
              />
              <DishGrid
                title="Your highest-rated dishes"
                dishes={summary.personal?.highest_rated || []}
              />
            </>
          )}

          {/* Global sections (for everyone) */}
          <DishGrid
            title={
              hasHistory
                ? "Popular with everyone"
                : "Most popular dishes right now"
            }
            dishes={summary.global?.most_popular || []}
          />
          <DishGrid
            title={
              hasHistory
                ? "Highest-rated dishes overall"
                : "Highest-rated dishes"
            }
            dishes={summary.global?.highest_rated || []}
          />

          <div
            style={{
              marginTop: "1rem",
              fontSize: "0.9rem",
              color: "#555",
            }}
          >
            <Link to="/menu">Browse full menu</Link> •{" "}
            <Link to="/recommendation">See more recommendations</Link>
          </div>
        </>
      )}

      {/* Auth shortcuts if not logged in */}
      {!currentUser && (
        <div style={{ marginTop: "1.5rem" }}>
          <Link to="/login" style={{ marginRight: "1rem" }}>
            Login
          </Link>
          <Link to="/register">Register</Link>
        </div>
      )}
    </div>
  );
}

export default HomePage;
