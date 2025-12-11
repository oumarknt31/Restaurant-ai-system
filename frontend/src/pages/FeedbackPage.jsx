// src/pages/FeedbackPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function FeedbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  const [type, setType] = useState("complaint"); // complaint | compliment
  const [rating, setRating] = useState("");      // 1–5 (optional)
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Hidden context from My Orders
  const fromState = location.state || {};
  const {
    targetUserId,
    orderId,
    targetKind,   // "chef" | "delivery" | "customer" | "user"
    displayName,
    dishName,
    type: initialType,
    context,
    topicId,
    topicTitle,
  } = fromState;

const isDiscussionContext =
  context === "discussion" || context === "discussion-topic";
  

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    // If My Orders passed in an initial type, use it
    if (initialType === "complaint" || initialType === "compliment") {
      setType(initialType);
    }
  }, [initialType]);

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>File Feedback</h2>
        <p>You must be logged in to file feedback.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  // If user came here directly (navbar) and we have no context,
  // show an instruction instead of a form.
  const hasValidContext = targetUserId && (orderId || isDiscussionContext);

  if (!hasValidContext) {
    return (
      <div style={{ padding: "1.5rem", maxWidth: "700px", margin: "0 auto" }}>
        <h2>File Feedback</h2>
        <p style={{ color: "#555" }}>
          To file a complaint or compliment about a <strong>chef</strong> or a{" "}
          <strong>delivery person</strong>, please go to{" "}
          <Link to="/my-orders">My Orders</Link> and use the
          <strong> “Complain about …”</strong> or{" "}
          <strong>“Compliment …”</strong> buttons for the specific order.
        </p>
        <p style={{ marginTop: "0.75rem" }}>
          You can also be redirected here automatically from a{" "}
          <strong>discussion topic</strong> when reporting another user's post.
        </p>
      </div>
    );
  }


  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!type) {
      setError("Please choose a feedback type.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        accuser_id: currentUser.id,
        target_user_id: targetUserId,
        type,                       // "complaint" or "compliment"
        order_id: orderId,
        reason: reason || undefined,
      };

      if (rating) {
        payload.rating = parseInt(rating, 10);
      }

      const res = await api.post("/reputation/file", payload);

      setSuccess(res.data.message || "Feedback submitted successfully.");
      setReason("");
      setRating("");

      // Optionally, go back to My Orders after a short delay:
      // setTimeout(() => navigate("/my-orders"), 1200);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit feedback.");
    } finally {
      setSubmitting(false);
    }
  }

  // Friendly label describing what this is about
  const subjectLabel =
  targetKind === "chef"
    ? `Chef${displayName ? ` ${displayName}` : ""}`
    : targetKind === "delivery"
    ? `Delivery person${displayName ? ` ${displayName}` : ""}`
    : targetKind === "customer"
    ? `Customer${displayName ? ` ${displayName}` : ""}`
    : displayName || "Staff member";


    return (
      <div style={{ padding: "1.5rem", maxWidth: "700px", margin: "0 auto" }}>
        <h2>File Feedback</h2>
    
        <p style={{ color: "#555", fontSize: "0.95rem" }}>
          You are submitting feedback about{" "}
          <strong>{subjectLabel}</strong>{" "}
          {dishName && (
            <>
              for the dish <strong>{dishName}</strong>{" "}
            </>
          )}
          {!isDiscussionContext && orderId && <> (Order #{orderId}).</>}
        </p>
    
        {isDiscussionContext && topicTitle && (
          <p
            style={{
              color: "#666",
              fontSize: "0.85rem",
              marginTop: "0.25rem",
            }}
          >
            This complaint relates to the discussion topic{" "}
            <strong>&ldquo;{topicTitle}&rdquo;</strong>.
          </p>
        )}
    

      {error && (
        <p style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</p>
      )}
      {success && (
        <p style={{ color: "green", marginBottom: "0.5rem" }}>{success}</p>
      )}

      <form onSubmit={handleSubmit}>
        {/* Type */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
            Feedback type
          </label>
          <br />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ padding: "0.3rem 0.5rem", marginTop: "0.2rem" }}
          >
            <option value="complaint">Complaint</option>
            <option value="compliment">Compliment</option>
          </select>
        </div>

        {/* Rating */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
            Rating (1–5) <span style={{ fontWeight: 400 }}>optional</span>
          </label>
          <br />
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            style={{ padding: "0.3rem 0.5rem", marginTop: "0.2rem" }}
          >
            <option value="">No rating</option>
            <option value="1">1 ★</option>
            <option value="2">2 ★★</option>
            <option value="3">3 ★★★</option>
            <option value="4">4 ★★★★</option>
            <option value="5">5 ★★★★★</option>
          </select>
        </div>

        {/* Reason / Comment */}
        <div style={{ marginBottom: "0.75rem" }}>
          <label style={{ fontSize: "0.9rem", fontWeight: 600 }}>
            Reason / Comment
          </label>
          <br />
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem",
              marginTop: "0.2rem",
              fontSize: "0.9rem",
            }}
            placeholder={
              type === "complaint"
                ? "Explain what went wrong so the manager can review the situation…"
                : "Share what you appreciated about this experience…"
            }
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.45rem 1rem",
            borderRadius: "999px",
            border: "1px solid #0d6efd",
            backgroundColor: "#0d6efd",
            color: "#fff",
            cursor: submitting ? "wait" : "pointer",
            fontWeight: 500,
          }}
        >
          {submitting ? "Submitting..." : "Submit feedback"}
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            marginLeft: "0.5rem",
            padding: "0.45rem 1rem",
            borderRadius: "999px",
            border: "1px solid #ced4da",
            backgroundColor: "#f8f9fa",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

export default FeedbackPage;
