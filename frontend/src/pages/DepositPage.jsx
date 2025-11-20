import { useEffect, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";
import { Link } from "react-router-dom";

function DepositPage() {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user) {
      setUserId(user.id);
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const uid = parseInt(userId, 10);
    if (!uid) {
      setError("Please enter a valid numeric user ID.");
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError("Please enter a valid deposit amount greater than 0.");
      return;
    }

    try {
      const res = await api.post("/wallet/deposit", {
        user_id: uid,
        amount: amt,
      });
      setResult(res.data.user);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError("Deposit failed. Please try again.");
      }
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Add Funds</h2>
        <p>You must be logged in to deposit funds.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Add Funds</h2>
      <p style={{ maxWidth: "600px" }}>
        Depositing funds into your own account ({currentUser.email}).
      </p>

      <form
        onSubmit={handleSubmit}
        style={{ maxWidth: "400px", marginTop: "1rem" }}
      >
        <div style={{ marginBottom: "0.75rem" }}>
          <label>User ID:</label>
          <br />
          <input
            type="number"
            value={userId}
            readOnly
            style={{ width: "100%", backgroundColor: "#f5f5f5" }}
          />
          <small>This is your own user ID.</small>
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label>Amount to deposit:</label>
          <br />
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: "100%" }}
            required
          />
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: "0.75rem" }}>Error: {error}</p>
        )}

        <button type="submit">Deposit</button>
      </form>

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Updated Balance</h3>
          <p>
            <strong>New Balance:</strong> ${result.deposit_balance.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}

export default DepositPage;
