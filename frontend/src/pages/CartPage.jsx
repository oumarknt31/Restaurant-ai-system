import { useEffect, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";
import { Link, useNavigate } from "react-router-dom";

function CartPage({ cartItems, removeFromCart, clearCart }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [lastOrderResult, setLastOrderResult] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  async function handlePlaceOrder() {
    setError("");
    setLastOrderResult(null);

    if (!currentUser) {
      setError("You must be logged in to place an order.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    const itemsPayload = cartItems.map((item) => ({
      dish_id: item.dish_id,
      quantity: item.quantity,
    }));

    setPlacing(true);
    try {
      const res = await api.post("/orders/", {
        user_id: currentUser.id,
        items: itemsPayload,
      });

      setLastOrderResult(res.data);
      clearCart();
      alert("Order placed successfully!");
      // Optional: navigate to My Orders
      // navigate("/my-orders");
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data) {
        setError(
          err.response.data.error ||
            JSON.stringify(err.response.data, null, 2)
        );
      } else {
        setError("Order failed. Please try again.");
      }
    } finally {
      setPlacing(false);
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Your Cart</h2>
        <p>You must be logged in to place an order.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Your Cart</h2>

      {cartItems.length === 0 ? (
        <p>
          Your cart is empty. <Link to="/menu">Browse the menu</Link>.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              maxWidth: "600px",
              marginBottom: "1rem",
            }}
          >
            {cartItems.map((item) => (
              <div
                key={item.dish_id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div>
                    <strong>{item.name}</strong>
                    {item.is_vip_only && (
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
                  <div style={{ fontSize: "0.9rem", color: "#555" }}>
                    ${item.price.toFixed(2)} × {item.quantity} = $
                    {(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.dish_id)}>
                  − Remove one
                </button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <strong>Total: ${total.toFixed(2)}</strong>
          </div>

          {error && (
            <p style={{ color: "red", marginBottom: "0.75rem" }}>
              Error: {error}
            </p>
          )}

          <button onClick={handlePlaceOrder} disabled={placing}>
            {placing ? "Placing order..." : "Place Order"}
          </button>

          <button
            onClick={clearCart}
            style={{ marginLeft: "0.75rem" }}
            disabled={placing}
          >
            Clear Cart
          </button>
        </>
      )}

      {lastOrderResult && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>Last Order Result</h3>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "8px",
              maxWidth: "600px",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(lastOrderResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default CartPage;
