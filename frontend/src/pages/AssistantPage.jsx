import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function AssistantPage() {
  const [currentUser, setCurrentUser] = useState(null);

  // For rule-based recommend endpoint
  const [maxPrice, setMaxPrice] = useState("");
  const [preference, setPreference] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // For LLM-based chat endpoint
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  // Rule-based recommendation handler (uses /assistant/recommend)
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setRecommendations([]);
    setMessage("");

    if (!currentUser) {
      setError("You must be logged in to use the assistant.");
      return;
    }

    const payload = {
      user_id: currentUser.id,
      preference,
      max_results: Number(maxResults) || 5,
    };

    if (maxPrice !== "") {
      payload.max_price = parseFloat(maxPrice);
    }

    setLoading(true);
    try {
      const res = await api.post("/assistant/recommend", payload);
      setRecommendations(res.data.recommendations || []);
      setMessage(res.data.message || "");
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Failed to get recommendations. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // LLM-based handler (uses /assistant/chat)
  async function handleAskAI(e) {
    e.preventDefault();
    setAiError("");
    setAiAnswer("");

    if (!currentUser) {
      setAiError("You must be logged in to use the AI assistant.");
      return;
    }

    // Build a natural-language message for the backend from the same inputs
    let parts = [];
    if (maxPrice) {
      parts.push(`My maximum budget is $${maxPrice}.`);
    }
    if (preference) {
      parts.push(`I'm in the mood for: ${preference}.`);
    }
    if (parts.length === 0) {
      parts.push("I don't know what I want, just suggest something popular.");
    }

    const fullMessage = parts.join(" ");

    setAiLoading(true);
    try {
      const res = await api.post("/assistant/chat", {
        user_id: currentUser.id,
        message: fullMessage,
      });

      setAiAnswer(res.data.answer || "");
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setAiError(err.response.data.error);
      } else {
        setAiError("Failed to contact AI assistant.");
      }
    } finally {
      setAiLoading(false);
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Menu Assistant</h2>
        <p>You must be logged in to use the assistant.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Menu Assistant</h2>
      <p style={{ maxWidth: "600px" }}>
        Tell me your budget and what you&apos;re in the mood for, and I&apos;ll
        help you pick something from the menu.
        <br />
        The assistant supports both a{" "}
        <strong>rule-based recommender</strong> and an{" "}
        <strong>LLM-based AI assistant</strong>.
        <br />
        Example preferences:{" "}
        <code>spicy</code>, <code>vegan</code>, <code>fish</code>,{" "}
        <code>rice</code>, <code>meat</code>.
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: "420px", marginTop: "1rem" }}
      >
        <div style={{ marginBottom: "0.75rem" }}>
          <label>Max price (optional):</label>
          <br />
          <input
            type="number"
            step="0.01"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            style={{ width: "100%" }}
            placeholder="e.g. 20"
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label>What are you in the mood for?</label>
          <br />
          <input
            type="text"
            value={preference}
            onChange={(e) => setPreference(e.target.value)}
            style={{ width: "100%" }}
            placeholder='e.g. "spicy fish", "vegan rice"'
          />
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label>How many suggestions? (rule-based)</label>
          <br />
          <input
            type="number"
            min="1"
            max="10"
            value={maxResults}
            onChange={(e) => setMaxResults(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: "0.75rem" }}>
            Error: {error}
          </p>
        )}

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button type="submit" disabled={loading}>
            {loading ? "Finding dishes..." : "Rule-based recommendations"}
          </button>

          <button
            type="button"
            onClick={handleAskAI}
            disabled={aiLoading}
          >
            {aiLoading ? "Asking AI..." : "Ask AI (LLM)"}
          </button>
        </div>
      </form>

      {message && (
        <p style={{ marginTop: "1.5rem", fontWeight: "bold" }}>{message}</p>
      )}

      {recommendations.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Suggested Dishes (Rule-based)</h3>
          <div style={{ display: "grid", gap: "0.75rem", maxWidth: "600px" }}>
            {recommendations.map((dish) => (
              <div
                key={dish.id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "0.75rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong>{dish.name}</strong>{" "}
                    <span style={{ fontSize: "0.9rem" }}>
                      (${dish.price.toFixed(2)})
                    </span>
                    {dish.is_vip_only && (
                      <span
                        style={{
                          marginLeft: "0.5rem",
                          fontSize: "0.8rem",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "999px",
                          backgroundColor: "#ffe08a",
                        }}
                      >
                        VIP ONLY
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.8rem", color: "#555" }}>
                    score: {dish.score}
                  </span>
                </div>
                <p style={{ marginTop: "0.25rem" }}>{dish.description}</p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: "1rem" }}>
            You can add these from the <Link to="/menu">Menu</Link> to your cart.
          </p>
        </div>
      )}

      {aiError && (
        <p style={{ color: "red", marginTop: "1.5rem" }}>
          AI error: {aiError}
        </p>
      )}

      {aiAnswer && (
        <div style={{ marginTop: "1.5rem", maxWidth: "700px" }}>
          <h3>AI Assistant Response (LLM-based)</h3>
          <div
            style={{
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
            }}
          >
            {aiAnswer}
          </div>
        </div>
      )}
    </div>
  );
}

export default AssistantPage;
