import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function RecommendationPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    async function fetchRecommendations(u) {
      try {
        setLoading(true);
        setError("");

        // 🔹 CALL THE REAL BACKEND ROUTE
        const res = await api.get("/recommendations/home-summary", {
          params: u ? { user_id: u.id } : {},
        });

        const data = res.data || {};

        // data structure:
        // {
        //   user: {...} | null,
        //   has_history: bool,
        //   personal: { most_ordered: [...], highest_rated: [...] },
        //   global:   { most_popular: [...], highest_rated: [...] }
        // }

        const combinedMap = new Map();

        function addList(list) {
          if (!Array.isArray(list)) return;
          list.forEach((d) => {
            const key = d.dish_id ?? d.id ?? d.name;
            if (!key) return;

            if (!combinedMap.has(key)) {
              combinedMap.set(key, {
                id: d.dish_id ?? d.id ?? key,
                name: d.name,
                description: d.description,
                price: d.price,
                image_url: d.image_url,
                is_vip_only: d.is_vip_only,
                times_ordered: d.times_ordered,
                avg_rating: d.avg_rating,
                rating_count: d.rating_count,
                // you can add tags/cuisine later if you want
              });
            }
          });
        }

        addList(data.personal?.most_ordered);
        addList(data.personal?.highest_rated);
        addList(data.global?.most_popular);
        addList(data.global?.highest_rated);

        setRecommendations(Array.from(combinedMap.values()));
      } catch (err) {
        console.error(err);
        setError("Failed to load recommendations. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations(user);
  }, []);

  // Helper: keyword match across name + description
  const filteredRecommendations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recommendations;

    return recommendations.filter((dish) => {
      const fields = [
        dish.name,
        dish.description,
      ];

      return fields.some((value) =>
        value ? value.toLowerCase().includes(term) : false
      );
    });
  }, [recommendations, searchTerm]);

  return (
    <div
      style={{
        padding: "2rem 1.5rem",
        maxWidth: "1100px",
        margin: "0 auto",
      }}
    >
      {/* Hero header */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "18px",
          background:
            "linear-gradient(135deg, rgba(255, 111, 97, 0.12), rgba(82, 196, 255, 0.12))",
          border: "1px solid rgba(0,0,0,0.06)",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ marginBottom: "0.25rem" }}>AI Dish Recommendations</h2>
        <p style={{ margin: 0, color: "#555", maxWidth: "640px" }}>
          {currentUser
            ? `Hi ${currentUser.name}, here are dishes our AI thinks you'll enjoy based on your orders, ratings, and what other customers love.`
            : "Here are dishes our AI thinks are popular and well loved by customers."}
        </p>
      </div>

      {/* Search + info bar */}
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1, minWidth: "220px" }}>
          <label
            htmlFor="rec-search"
            style={{
              display: "block",
              fontSize: "0.8rem",
              textTransform: "uppercase",
              fontWeight: 600,
              letterSpacing: "0.04em",
              marginBottom: "0.25rem",
              color: "#666",
            }}
          >
            Filter by keyword
          </label>
          <input
            id="rec-search"
            type="text"
            placeholder="Search by name or description…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "0.55rem 0.75rem",
              borderRadius: "999px",
              border: "1px solid #ced4da",
              fontSize: "0.95rem",
              outline: "none",
              boxShadow: "0 0 0 0 rgba(0,0,0,0)",
            }}
            onFocus={(e) =>
              (e.target.style.boxShadow = "0 0 0 2px rgba(25, 135, 84, 0.25)")
            }
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>

        <div style={{ fontSize: "0.85rem", color: "#666" }}>
          {filteredRecommendations.length}{" "}
          {filteredRecommendations.length === 1 ? "match" : "matches"}{" "}
          {searchTerm ? `for “${searchTerm}”` : "from our AI recommendations"}
        </div>
      </div>

      {/* Loading / error states */}
      {loading && <p>Loading recommendations…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Grid of recommendation cards */}
      {!loading && !error && (
        <>
          {filteredRecommendations.length === 0 ? (
            <p style={{ color: "#555" }}>
              No dishes matched your search. Try a different keyword, like
              &ldquo;spicy&rdquo;, &ldquo;vegan&rdquo;, or &ldquo;pasta&rdquo;.
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "1rem",
              }}
            >
              {filteredRecommendations.map((dish) => (
                <RecommendationCard key={dish.id || dish.name} dish={dish} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecommendationCard({ dish }) {
  const {
    name,
    description,
    price,
    // image_url,
    // is_vip_only,
    avg_rating,
    rating_count,
  } = dish;

  return (
    <div
      style={{
        borderRadius: "16px",
        padding: "1rem 1rem 0.9rem",
        border: "1px solid rgba(0,0,0,0.06)",
        backgroundColor: "#fff",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow =
          "0 4px 12px rgba(15, 23, 42, 0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow =
          "0 2px 6px rgba(15, 23, 42, 0.06)";
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div>
          <h4 style={{ margin: 0, fontSize: "1.05rem" }}>{name}</h4>
        </div>
        {typeof price === "number" && (
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.95rem",
              color: "#198754",
              whiteSpace: "nowrap",
            }}
          >
            ${price.toFixed(2)}
          </div>
        )}
      </div>

      {description && (
        <p
          style={{
            margin: "0.35rem 0 0.25rem",
            fontSize: "0.9rem",
            color: "#495057",
          }}
        >
          {description}
        </p>
      )}

      {(avg_rating || rating_count) && (
        <p
          style={{
            marginTop: "0.25rem",
            fontSize: "0.82rem",
            color: "#6c757d",
          }}
        >
          {avg_rating ? `Avg rating: ${avg_rating.toFixed(1)}★` : "No rating"}{" "}
          {rating_count ? `(${rating_count} votes)` : ""}
        </p>
      )}
    </div>
  );
}

export default RecommendationPage;
