import { useEffect, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";
import { Link } from "react-router-dom";

function OrderPage() {
  const [userId, setUserId] = useState("");
  const [itemsInput, setItemsInput] = useState("1:1");
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

  function parseItems(input) {
    return input
      .split(",")
      .map((pair) => pair.trim())
      .filter((pair) => pair.length > 0)
      .map((pair) => {
        const [dishIdStr, qtyStr] = pair.split(":");
        const dish_id = parseInt(dishIdStr, 10);
        const quantity = parseInt(qtyStr || "1", 10);
        return { dish_id, quantity };
      });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setResult(null);

    const uid = parseInt(userId, 10);
    if (!uid) {
      setError("Invalid user id.");
      return;
    }

    let items;
    try {
      items = parseItems(itemsInput);
    } catch (err) {
      console.error(err);
      setError("Items format invalid. Use e.g. 1:2,2:1");
      return;
    }

    try {
      const res = await api.post("/orders/", {
        user_id: uid,
        items,
      });

      setResult(res.data);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        setError(
          err.response.data.error ||
            JSON.stringify(err.response.data, null, 2)
        );
      } else {
        setError("Order failed.");
      }
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Place Order</h2>
        <p>You must be logged in to place an order.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  const vipStatus = result?.vip_status;

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Place Test Order</h2>
      <p style={{ maxWidth: "600px" }}>
        Placing an order as <strong>{currentUser.email}</strong>. Make sure you
        have funds in your wallet.
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
        </div>

        <div style={{ marginBottom: "0.75rem" }}>
          <label>
            Items (format: <code>dishId:qty,dishId:qty</code>):
          </label>
          <br />
          <input
            type="text"
            value={itemsInput}
            onChange={(e) => setItemsInput(e.target.value)}
            style={{ width: "100%" }}
          />
          <small>Example: 1:2,2:1 → dish 1 ×2, dish 2 ×1</small>
        </div>

        {error && (
          <p style={{ color: "red", marginBottom: "0.75rem" }}>
            Error: {error}
          </p>
        )}

        <button type="submit">Place Order</button>
      </form>

      {/* VIP message */}
      {vipStatus && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            backgroundColor: vipStatus.just_promoted
              ? "#ffe08a"
              : "#f5f5f5",
          }}
        >
          {vipStatus.just_promoted ? (
            <strong>
              🎉 Congratulations! You have just been promoted to VIP status.
            </strong>
          ) : vipStatus.role === "vip" ? (
            <span>You are currently a VIP customer.</span>
          ) : null}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Order Result</h3>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "8px",
              maxWidth: "600px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default OrderPage;
