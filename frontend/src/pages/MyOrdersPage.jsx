import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function MyOrdersPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchOrders() {
      try {
        const res = await api.get(`/orders/user/${user.id}`);
        setOrders(res.data.orders || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load your orders.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>My Orders</h2>
        <p>You must be logged in to view your orders.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "1.5rem" }}>Loading your orders...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem", color: "red" }}>Error: {error}</div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>My Orders</h2>
      {orders.length === 0 ? (
        <p>You have not placed any orders yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem", maxWidth: "700px" }}>
          {orders.map((order) => (
            <div
              key={order.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem",
                }}
              >
                <div>
                  <strong>Order #{order.id}</strong>
                  <div style={{ fontSize: "0.85rem", color: "#555" }}>
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>
                    <strong>Status:</strong> {order.status}
                  </div>
                  <div>
                    <strong>Total:</strong> ${order.total_price.toFixed(2)}
                    {order.discount_applied > 0 && (
                      <span style={{ fontSize: "0.85rem", marginLeft: "0.3rem" }}>
                        (discount: ${order.discount_applied.toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <strong>Items:</strong>
                <ul style={{ marginTop: "0.25rem" }}>
                  {order.items.map((item, idx) => (
                    <li key={idx}>
                      Dish #{item.dish_id} — qty {item.quantity} @ $
                      {item.unit_price.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyOrdersPage;
