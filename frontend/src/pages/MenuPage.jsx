import { useEffect, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function MenuPage({ onAddToCart }) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    async function fetchMenu() {
      try {
        const res = await api.get("/menu/");
        setDishes(res.data.dishes || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load menu.");
      } finally {
        setLoading(false);
      }
    }

    fetchMenu();
  }, []);

  if (loading) {
    return <div style={{ padding: "1.5rem" }}>Loading menu...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "1.5rem", color: "red" }}>
        Error: {error}
      </div>
    );
  }

  const isVip = currentUser?.role === "vip";

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Menu</h2>
      {isVip ? (
        <p style={{ color: "#0b7285" }}>
          You are a VIP customer. VIP-only dishes are unlocked for you.
        </p>
      ) : (
        <p style={{ color: "#555" }}>
          Some dishes are <strong>VIP-only</strong>. Place more orders or reach
          the spending threshold to get promoted to VIP.
        </p>
      )}

      {dishes.length === 0 ? (
        <p>No dishes yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          {dishes.map((dish) => {
            const locked = dish.is_vip_only && !isVip;

            return (
              <div
                key={dish.id}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  opacity: locked ? 0.6 : 1,
                }}
              >
                <h3 style={{ marginBottom: "0.25rem" }}>
                  {dish.name}{" "}
                  <span style={{ fontWeight: "normal" }}>
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
                </h3>
                <p style={{ marginBottom: "0.5rem" }}>{dish.description}</p>

                {locked && (
                  <p
                    style={{
                      fontSize: "0.85rem",
                      color: "#b33939",
                      marginBottom: "0.5rem",
                    }}
                  >
                    You must be VIP to order this dish.
                  </p>
                )}

                <button
                  onClick={() => onAddToCart && onAddToCart(dish)}
                  disabled={locked}
                >
                  {locked ? "Locked for VIP only" : "Add to Cart"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MenuPage;
