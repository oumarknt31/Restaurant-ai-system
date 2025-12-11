import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";


function MyOrdersPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  // Rating inputs
  const [foodRatings, setFoodRatings] = useState({}); // key: `${orderId}-${dishId}` -> value 1–5
  const [deliveryRatings, setDeliveryRatings] = useState({}); // key: orderId -> value 1–5
  const [ratingLoadingKey, setRatingLoadingKey] = useState(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    if (user) {
      fetchOrders(user.id);
    }
  }, []);

  async function fetchOrders(userId) {
    setError("");
    try {
      const res = await api.get(`/orders/user/${userId}`);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load your orders.");
    }
  }

  function handleFoodRatingChange(orderId, dishId, value) {
    setFoodRatings((prev) => ({
      ...prev,
      [`${orderId}-${dishId}`]: value,
    }));
  }

  function handleDeliveryRatingChange(orderId, value) {
    setDeliveryRatings((prev) => ({
      ...prev,
      [orderId]: value,
    }));
  }

  async function submitFoodRating(orderId, dishId) {
    if (!currentUser) return;
    const key = `${orderId}-${dishId}`;
    const rating = parseInt(foodRatings[key], 10);

    if (!rating) {
      setError("Please choose a star rating for the dish.");
      return;
    }

    setError("");
    setSuccess("");
    setRatingLoadingKey(key);

    try {
      const res = await api.post("/reputation/rate-dish", {
        customer_id: currentUser.id,
        order_id: orderId,
        dish_id: dishId,
        rating,
      });

      setSuccess(res.data.message || "Dish rating submitted.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit food rating.");
    } finally {
      setRatingLoadingKey(null);
    }
  }

  async function submitDeliveryRating(orderId) {
    if (!currentUser) return;
    const rating = parseInt(deliveryRatings[orderId], 10);

    if (!rating) {
      setError("Please choose a star rating for the delivery.");
      return;
    }

    setError("");
    setSuccess("");
    setRatingLoadingKey(`delivery-${orderId}`);

    try {
      const res = await api.post("/reputation/rate-delivery", {
        customer_id: currentUser.id,
        order_id: orderId,
        rating,
      });

      setSuccess(res.data.message || "Delivery rating submitted.");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to submit delivery rating."
      );
    } finally {
      setRatingLoadingKey(null);
    }
  }

  // ---- NEW: helpers for complaints/compliments + discussions ----

  async function fileComplaintAboutChef(order, item) {
    if (!currentUser || !item.chef_id) return;

    const reason = window.prompt(
      `Describe your complaint about Chef ${item.chef_name || ""} (optional):`
    );

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: item.chef_id,
        type: "complaint",
        order_id: order.id,
        reason,
      });
      setSuccess("Complaint about chef submitted for manager review.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit complaint.");
    }
  }

  async function fileComplimentAboutChef(order, item) {
    if (!currentUser || !item.chef_id) return;

    const reason = window.prompt(
      `Say something nice about Chef ${item.chef_name || ""} (optional):`
    );

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: item.chef_id,
        type: "compliment",
        order_id: order.id,
        reason,
        rating: 5,
      });
      setSuccess("Compliment for chef submitted. Thank you!");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit compliment.");
    }
  }

  async function fileComplaintAboutDelivery(order) {
    if (!currentUser || !order.delivery_job?.courier_id) return;

    const reason = window.prompt(
      `Describe your complaint about the delivery (optional):`
    );

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: order.delivery_job.courier_id,
        type: "complaint",
        order_id: order.id,
        reason,
      });
      setSuccess("Complaint about delivery submitted for manager review.");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit complaint.");
    }
  }

  async function fileComplimentAboutDelivery(order) {
    if (!currentUser || !order.delivery_job?.courier_id) return;

    const reason = window.prompt(
      `Say something nice about the delivery (optional):`
    );

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: order.delivery_job.courier_id,
        type: "compliment",
        order_id: order.id,
        reason,
        rating: 5,
      });
      setSuccess("Compliment for delivery submitted. Thank you!");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit compliment.");
    }
  }


    // ---- NEW: helpers for complaints/compliments via Feedback page ----

    function fileComplaintAboutChef(order, item) {
      if (!currentUser || !item.chef_id) return;
  
      navigate("/feedback", {
        state: {
          type: "complaint",
          targetUserId: item.chef_id,
          orderId: order.id,
          targetKind: "chef",
          displayName: item.chef_name || "the chef",
          dishName: item.dish_name || null,
        },
      });
    }
  
    function fileComplimentAboutChef(order, item) {
      if (!currentUser || !item.chef_id) return;
  
      navigate("/feedback", {
        state: {
          type: "compliment",
          targetUserId: item.chef_id,
          orderId: order.id,
          targetKind: "chef",
          displayName: item.chef_name || "the chef",
          dishName: item.dish_name || null,
        },
      });
    }
  
    function fileComplaintAboutDelivery(order) {
      if (!currentUser || !order.delivery_job?.courier_id) return;
  
      navigate("/feedback", {
        state: {
          type: "complaint",
          targetUserId: order.delivery_job.courier_id,
          orderId: order.id,
          targetKind: "delivery",
          displayName: order.delivery_job.courier_name || "the delivery person",
          dishName: null,
        },
      });
    }
  
    function fileComplimentAboutDelivery(order) {
      if (!currentUser || !order.delivery_job?.courier_id) return;
  
      navigate("/feedback", {
        state: {
          type: "compliment",
          targetUserId: order.delivery_job.courier_id,
          orderId: order.id,
          targetKind: "delivery",
          displayName: order.delivery_job.courier_name || "the delivery person",
          dishName: null,
        },
      });
    }
  

  // ---- render ----

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>My Orders</h2>
        <p>You must be logged in to view your orders.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>My Orders</h2>
      <p>
        Here you can review your past orders and rate both the{" "}
        <strong>food</strong> and the{" "}
        <strong>delivery quality / manners</strong> (1–5 stars) for delivered
        orders. You can also start discussions or file compliments/complaints
        about chefs, dishes, and delivery.
      </p>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      {orders.length === 0 ? (
        <p>You have no orders yet.</p>
      ) : (
        orders.map((order) => {
          const isDelivered = order.status === "delivered";

          return (
            <div
              key={order.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                marginBottom: "1rem",
                backgroundColor: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <h3 style={{ margin: 0 }}>Order #{order.id}</h3>
                <span
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color:
                      order.status === "delivered"
                        ? "#198754"
                        : order.status === "paid"
                        ? "#0d6efd"
                        : "#6c757d",
                  }}
                >
                  Status: {order.status}
                </span>
              </div>
              <p style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
                Placed on{" "}
                {new Date(order.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>

              <p style={{ marginTop: "0.25rem" }}>
                <strong>Total:</strong> ${order.total_price.toFixed(2)}{" "}
                {order.discount_applied > 0 && (
                  <span style={{ fontSize: "0.85rem", color: "#0b7285" }}>
                    (Discount applied: ${order.discount_applied.toFixed(2)})
                  </span>
                )}
              </p>

              {/* Order items */}
              <div style={{ marginTop: "0.5rem" }}>
                {order.items.map((item, idx) => {
                  const key = `${order.id}-${item.dish_id}`;

                  // rating previously stored in DB (from backend)
                  const existingRating = item.my_food_rating ?? null;
                  
                  // what shows in the select:
                  const currentRating =
                    foodRatings[key] !== undefined
                      ? foodRatings[key]
                      : existingRating
                      ? String(existingRating)
                      : "";
                  

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        padding: "0.4rem 0",
                        borderTop: idx === 0 ? "none" : "1px solid #eee",
                      }}
                    >
                      {/* Dish image if available */}
                      {item.dish_image_url && (
                        <img
                          src={item.dish_image_url}
                          alt={item.dish_name}
                          style={{
                            width: "64px",
                            height: "64px",
                            objectFit: "cover",
                            borderRadius: "6px",
                          }}
                        />
                      )}

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <strong>{item.dish_name}</strong>{" "}
                            <span style={{ fontSize: "0.85rem" }}>
                              ×{item.quantity}
                            </span>
                            {item.chef_name && (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "#495057",
                                }}
                              >
                                Chef: {item.chef_name}
                              </div>
                            )}
                          </div>
                          <span>
                            ${(item.unit_price * item.quantity).toFixed(2)}
                          </span>
                        </div>

                        {/* Food rating controls only when delivered */}
                        {isDelivered && (
                          <div
                            style={{
                              marginTop: "0.35rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.4rem",
                              flexWrap: "wrap",
                              fontSize: "0.85rem",
                            }}
                          >
                            <span>Rate food (1–5):</span>

                            <select
                              value={currentRating}
                              onChange={(e) =>
                                handleFoodRatingChange(
                                  order.id,
                                  item.dish_id,
                                  e.target.value
                                )
                              }
                              style={{ padding: "0.2rem 0.4rem" }}
                              disabled={existingRating !== null}   // 👈 disable if already rated
                            >
                              <option value="">Select</option>
                              <option value="1">1 ★</option>
                              <option value="2">2 ★★</option>
                              <option value="3">3 ★★★</option>
                              <option value="4">4 ★★★★</option>
                              <option value="5">5 ★★★★★</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => submitFoodRating(order.id, item.dish_id)}
                              disabled={existingRating !== null || ratingLoadingKey === key}
                              style={{
                                padding: "0.25rem 0.6rem",
                                borderRadius: "999px",
                                border: "1px solid #0d6efd",
                                backgroundColor: existingRating !== null ? "#e9ecef" : "#e7f1ff",
                                color: existingRating !== null ? "#6c757d" : "#0d6efd",
                                cursor: existingRating !== null ? "not-allowed" : "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              {existingRating !== null
                                ? `Already rated: ${existingRating}★`
                                : ratingLoadingKey === key
                                ? "Submitting..."
                                : "Rate food"}
                            </button>
                          </div>
                        )}


                        {/* Discussion + feedback buttons for this dish / chef */}
                        {isDelivered && (
                          <div
                            style={{
                              marginTop: "0.35rem",
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.4rem",
                              fontSize: "0.8rem",
                            }}
                          >
                            {/* Discuss this dish */}
                            <Link
                              to="/discussion"
                              state={{
                                initialCategory: "dish",
                                initialTitle: `Thoughts on ${item.dish_name}`,
                                targetType: "dish",
                                targetId: item.dish_id,
                              }}
                            >
                              <button
                                type="button"
                                style={{
                                  padding: "0.2rem 0.6rem",
                                  borderRadius: "999px",
                                  border: "1px solid #6c757d",
                                  backgroundColor: "#f8f9fa",
                                  color: "#343a40",
                                  cursor: "pointer",
                                }}
                              >
                                Discuss dish
                              </button>
                            </Link>


                            {/* Discuss / complain / compliment chef, if known */}
                            {item.chef_id && (
                              <>
                                <Link
                                  to="/discussion"
                                  state={{
                                    initialCategory: "chef",
                                    initialTitle: `Thoughts on Chef ${item.chef_name || ""}`,
                                    targetType: "chef",
                                    targetId: item.chef_id,
                                  }}
                                >
                                  <button
                                    type="button"
                                    style={{
                                      padding: "0.2rem 0.6rem",
                                      borderRadius: "999px",
                                      border: "1px solid #6c757d",
                                      backgroundColor: "#f8f9fa",
                                      color: "#343a40",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Discuss chef
                                  </button>
                                </Link>

                                <button
                                  type="button"
                                  onClick={() =>
                                    fileComplaintAboutChef(order, item)
                                  }
                                  style={{
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "999px",
                                    border: "1px solid #dc3545",
                                    backgroundColor: "#f8d7da",
                                    color: "#842029",
                                    cursor: "pointer",
                                  }}
                                >
                                  Complain about chef
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    fileComplimentAboutChef(order, item)
                                  }
                                  style={{
                                    padding: "0.2rem 0.6rem",
                                    borderRadius: "999px",
                                    border: "1px solid #198754",
                                    backgroundColor: "#d1f7e3",
                                    color: "#0f5132",
                                    cursor: "pointer",
                                  }}
                                >
                                  Compliment chef
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery rating block (once per order) */}
              {isDelivered && (
                <div
                  style={{
                    marginTop: "0.75rem",
                    paddingTop: "0.5rem",
                    borderTop: "1px dashed #ddd",
                    fontSize: "0.9rem",
                  }}
                >
                  <div style={{ marginBottom: "0.3rem" }}>
                    <strong>Rate delivery quality / manners (1–5):</strong>
                  </div>

                  {(() => {
                    const existingDelivery = order.my_delivery_rating ?? null;
                    const key = `delivery-${order.id}`;
                    const currentDelivery =
                      deliveryRatings[order.id] !== undefined
                        ? deliveryRatings[order.id]
                        : existingDelivery
                        ? String(existingDelivery)
                        : "";

                    return (
                      <>
                        {/* Rating controls */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            flexWrap: "wrap",
                            marginBottom: "0.5rem",
                          }}
                        >
                          <select
                            value={currentDelivery}
                            onChange={(e) =>
                              handleDeliveryRatingChange(order.id, e.target.value)
                            }
                            style={{ padding: "0.25rem 0.4rem" }}
                            disabled={existingDelivery !== null}  // 👈 disable if already rated
                          >
                            <option value="">Select</option>
                            <option value="1">1 ★</option>
                            <option value="2">2 ★★</option>
                            <option value="3">3 ★★★</option>
                            <option value="4">4 ★★★★</option>
                            <option value="5">5 ★★★★★</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => submitDeliveryRating(order.id)}
                            disabled={existingDelivery !== null || ratingLoadingKey === key}
                            style={{
                              padding: "0.25rem 0.6rem",
                              borderRadius: "999px",
                              border: "1px solid #20c997",
                              backgroundColor:
                                existingDelivery !== null ? "#e9ecef" : "#e6fcf5",
                              color: existingDelivery !== null ? "#6c757d" : "#087f5b",
                              cursor: existingDelivery !== null ? "not-allowed" : "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            {existingDelivery !== null
                              ? `Already rated: ${existingDelivery}★`
                              : ratingLoadingKey === key
                              ? "Submitting..."
                              : "Rate delivery"}
                          </button>
                        </div>

                        {/* ⬇️ Buttons: complain/compliment delivery */}
                        {order.delivery_job && order.delivery_job.courier_id && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.4rem",
                              fontSize: "0.85rem",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => fileComplaintAboutDelivery(order)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                borderRadius: "999px",
                                border: "1px solid #dc3545",
                                backgroundColor: "#f8d7da",
                                color: "#842029",
                                cursor: "pointer",
                              }}
                            >
                              Complain about delivery
                            </button>

                            <button
                              type="button"
                              onClick={() => fileComplimentAboutDelivery(order)}
                              style={{
                                padding: "0.25rem 0.6rem",
                                borderRadius: "999px",
                                border: "1px solid #198754",
                                backgroundColor: "#d1f7e3",
                                color: "#0f5132",
                                cursor: "pointer",
                              }}
                            >
                              Compliment delivery
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
    
            </div>
          );
        })
      )}
    </div>
  );
}

export default MyOrdersPage;
