import { useState } from "react";
import api from "../api/client";
import { getCurrentUser, setCurrentUser as storeUser } from "../auth/user";
import { Navigate, Link } from "react-router-dom";

function DepositPage() {
  // ✅ Read user synchronously from localStorage
  const currentUser = getCurrentUser();

  const [amount, setAmount] = useState("");
  const [resultUser, setResultUser] = useState(null); // updated user from backend
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If not logged in, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const displayUser = resultUser || currentUser; // show updated balance if we have it

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!displayUser) {
      setError("You must be logged in to make a deposit.");
      return;
    }

    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid deposit amount greater than 0.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await api.post("/wallet/deposit", {
        user_id: displayUser.id,
        amount: parsed,
      });

      const updatedUser = res.data?.user;
      if (updatedUser) {
        setResultUser(updatedUser);
        storeUser(updatedUser); // update localStorage so navbar etc. stays in sync
      }

      setSuccess("Deposit successful! Your balance has been updated.");
      setAmount("");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          "Failed to complete deposit. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        padding: "2rem 1.5rem",
        maxWidth: "700px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1.25rem 1.5rem",
          borderRadius: "18px",
          background:
            "linear-gradient(135deg, rgba(25, 135, 84, 0.12), rgba(13, 110, 253, 0.06))",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ marginBottom: "0.25rem" }}>Deposit Funds</h2>
        <p style={{ margin: 0, color: "#555" }}>
          Add money to your restaurant wallet. Your balance is used to pay for
          orders instantly without re-entering payment details.
        </p>
      </div>

      {/* User summary card (no user ID shown) */}
      <div
        style={{
          marginBottom: "1.5rem",
          padding: "1rem 1.2rem",
          borderRadius: "14px",
          border: "1px solid rgba(0,0,0,0.06)",
          backgroundColor: "#fff",
          boxShadow: "0 2px 6px rgba(15, 23, 42, 0.06)",
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6c757d",
              marginBottom: "0.25rem",
            }}
          >
            Logged in as
          </div>
          <div style={{ fontWeight: 600 }}>{displayUser.name}</div>
          <div style={{ fontSize: "0.85rem", color: "#6c757d" }}>
            {displayUser.email}
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: "160px" }}>
          <div
            style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#6c757d",
              marginBottom: "0.25rem",
            }}
          >
            Current balance
          </div>
          <div
            style={{
              fontSize: "1.3rem",
              fontWeight: 700,
              color: "#198754",
            }}
          >
            $
            {typeof displayUser.deposit_balance === "number"
              ? displayUser.deposit_balance.toFixed(2)
              : "0.00"}
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <p style={{ color: "red", marginBottom: "0.75rem" }}>Error: {error}</p>
      )}
      {success && (
        <p style={{ color: "green", marginBottom: "0.75rem" }}>{success}</p>
      )}

      {/* Deposit form card */}
      <div
        style={{
          padding: "1.25rem 1.5rem 1.4rem",
          borderRadius: "16px",
          border: "1px solid rgba(0,0,0,0.06)",
          backgroundColor: "#fff",
          boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>
          Make a Deposit
        </h3>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              htmlFor="amount"
              style={{
                display: "block",
                fontSize: "0.85rem",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
            >
              Amount to deposit ($)
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 25.00"
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "10px",
                border: "1px solid #ced4da",
                fontSize: "0.95rem",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.boxShadow =
                  "0 0 0 2px rgba(25, 135, 84, 0.25)")
              }
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
            <p
              style={{
                fontSize: "0.8rem",
                color: "#6c757d",
                marginTop: "0.25rem",
              }}
            >
              Funds will be added to your wallet immediately and can be used to
              place orders.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "0.6rem 1.4rem",
              borderRadius: "999px",
              border: "none",
              backgroundColor: submitting ? "#6c757d" : "#198754",
              color: "#fff",
              fontWeight: 600,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: "0.95rem",
            }}
          >
            {submitting ? "Processing…" : "Deposit"}
          </button>
        </form>
      </div>

      {/* Small link back to menu */}
      <div style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
        <span style={{ color: "#6c757d" }}>Ready to order?</span>{" "}
        <Link to="/menu">Go back to the menu</Link>
      </div>
    </div>
  );
}

export default DepositPage;
