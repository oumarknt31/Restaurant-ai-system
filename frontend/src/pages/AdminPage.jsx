import { useEffect, useState } from "react";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";
import { Link } from "react-router-dom";

function AdminPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorUsers, setErrorUsers] = useState("");
  const [errorOrders, setErrorOrders] = useState("");
  const [statusError, setStatusError] = useState("");
  const [orderStatusError, setOrderStatusError] = useState("");
  const [orderStatusDrafts, setOrderStatusDrafts] = useState({});
  const [roleError, setRoleError] = useState("");
  const [roleDrafts, setRoleDrafts] = useState({});


  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    async function fetchUsers() {
      try {
        const res = await api.get("/admin/users");
        setUsers(res.data.users || []);
      } catch (err) {
        console.error(err);
        setErrorUsers("Failed to load users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    async function fetchOrders() {
      try {
        const res = await api.get("/admin/orders");
        setOrders(res.data.orders || []);
      } catch (err) {
        console.error(err);
        setErrorOrders("Failed to load orders.");
      } finally {
        setLoadingOrders(false);
      }
    }

    fetchUsers();
    fetchOrders();
  }, []);

  const isManagerLike =
    currentUser && (currentUser.role === "manager" || currentUser.role === "chef");

  async function handleToggleActive(user) {
    setStatusError("");

    try {
      const res = await api.patch(`/admin/users/${user.id}/status`, {
        is_active: !user.is_active,
      });

      const updatedUser = res.data.user;

      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setStatusError(err.response.data.error);
      } else {
        setStatusError("Failed to update user status.");
      }
    }
  }

  async function handleToggleBlacklist(user) {
    setStatusError("");

    try {
      const res = await api.patch(`/admin/users/${user.id}/status`, {
        is_blacklisted: !user.is_blacklisted,
      });

      const updatedUser = res.data.user;

      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setStatusError(err.response.data.error);
      } else {
        setStatusError("Failed to update user status.");
      }
    }
  }


  function handleRoleDraftChange(userId, newRole) {
    setRoleDrafts((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  }

  async function handleUpdateRole(user) {
    setRoleError("");

    const draftRole = roleDrafts[user.id] || user.role;

    try {
      const res = await api.patch(`/admin/users/${user.id}/role`, {
        role: draftRole,
      });

      const updatedUser = res.data.user;

      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setRoleError(err.response.data.error);
      } else {
        setRoleError("Failed to update user role.");
      }
    }
  }


  const allowedStatuses = [
    "pending",
    "paid",
    "preparing",
    "on_the_way",
    "delivered",
    "cancelled",
  ];

  const allowedRoles = ["customer", "vip", "chef", "manager", "delivery"];


  function handleOrderStatusChange(orderId, newStatus) {
    setOrderStatusDrafts((prev) => ({
      ...prev,
      [orderId]: newStatus,
    }));
  }

  async function handleUpdateOrderStatus(order) {
    setOrderStatusError("");

    const draftStatus = orderStatusDrafts[order.id] || order.status;

    try {
      const res = await api.patch(`/admin/orders/${order.id}/status`, {
        status: draftStatus,
      });

      const updatedOrder = res.data.order;

      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.error) {
        setOrderStatusError(err.response.data.error);
      } else {
        setOrderStatusError("Failed to update order status.");
      }
    }
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Manager Dashboard</h2>

      {!currentUser && (
        <p style={{ color: "#b33939" }}>
          You are not logged in. This page is intended for managers/chefs.
          <br />
          <Link to="/login">Go to Login</Link>
        </p>
      )}

      {currentUser && !isManagerLike && (
        <p style={{ color: "#b33939" }}>
          You are logged in as <strong>{currentUser.role}</strong>. In a real
          app, only managers/chefs would see this page.
        </p>
      )}

      {statusError && (
        <p style={{ color: "red", marginTop: "0.5rem" }}>Error: {statusError}</p>
      )}

       {roleError && (
            <p style={{ color: "red", marginTop: "0.5rem" }}>
            Role error: {roleError}
            </p>
        )}

      {/* Users section */}
      <section style={{ marginTop: "1.5rem" }}>
        <h3>Users</h3>

        {loadingUsers ? (
          <p>Loading users...</p>
        ) : errorUsers ? (
          <p style={{ color: "red" }}>{errorUsers}</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                maxWidth: "1000px",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Balance</th>
                  <th style={thStyle}>Total Spent</th>
                  <th style={thStyle}>Orders</th>
                  <th style={thStyle}>Blacklisted</th>
                  <th style={thStyle}>Active</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={tdStyle}>{u.id}</td>
                    <td style={tdStyle}>{u.name}</td>
                    <td style={tdStyle}>{u.email}</td>
                    
                    {/* Role cell with select + Save */}
                    <td style={tdStyle}>
                        <select
                        value={roleDrafts[u.id] || u.role}
                        onChange={(e) => handleRoleDraftChange(u.id, e.target.value)}
                        style={{ marginRight: "0.5rem" }}
                        >
                        {allowedRoles.map((role) => (
                            <option key={role} value={role}>
                            {role}
                            </option>
                        ))}
                        </select>
                        <button onClick={() => handleUpdateRole(u)}>Save role</button>
                    </td>
                    
                    <td style={tdStyle}>${u.deposit_balance.toFixed(2)}</td>
                    <td style={tdStyle}>${u.total_spent.toFixed(2)}</td>
                    <td style={tdStyle}>{u.order_count}</td>
                    <td style={tdStyle}>{u.is_blacklisted ? "Yes" : "No"}</td>
                    <td style={tdStyle}>{u.is_active ? "Yes" : "No"}</td>
                    <td style={tdStyle}>
                        <button
                        onClick={() => handleToggleActive(u)}
                        style={{ marginRight: "0.5rem" }}
                        >
                        {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => handleToggleBlacklist(u)}>
                        {u.is_blacklisted ? "Unblacklist" : "Blacklist"}
                        </button>
                    </td>
                </tr>
                
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Orders section */}
      <section style={{ marginTop: "2rem" }}>
        <h3>All Orders</h3>

        {orderStatusError && (
          <p style={{ color: "red" }}>Order error: {orderStatusError}</p>
        )}

        {loadingOrders ? (
          <p>Loading orders...</p>
        ) : errorOrders ? (
          <p style={{ color: "red" }}>{errorOrders}</p>
        ) : orders.length === 0 ? (
          <p>No orders yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "1rem", maxWidth: "900px" }}>
            {orders.map((o) => {
              const draftStatus = orderStatusDrafts[o.id] || o.status;

              return (
                <div
                  key={o.id}
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
                      <strong>Order #{o.id}</strong>
                      <div style={{ fontSize: "0.85rem", color: "#555" }}>
                        Placed by user #{o.customer_id}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div>
                        <strong>Status:</strong> {o.status}
                      </div>
                      <div style={{ marginTop: "0.4rem" }}>
                        <label
                          style={{ fontSize: "0.85rem", marginRight: "0.25rem" }}
                        >
                          Update status:
                        </label>
                        <select
                          value={draftStatus}
                          onChange={(e) =>
                            handleOrderStatusChange(o.id, e.target.value)
                          }
                          style={{ marginRight: "0.5rem" }}
                        >
                          {allowedStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => handleUpdateOrderStatus(o)}>
                          Save
                        </button>
                      </div>
                      <div style={{ marginTop: "0.3rem" }}>
                        <strong>Total:</strong> ${o.total_price.toFixed(2)}
                        {o.discount_applied > 0 && (
                          <span
                            style={{
                              fontSize: "0.85rem",
                              marginLeft: "0.3rem",
                            }}
                          >
                            (discount: ${o.discount_applied.toFixed(2)})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#555" }}>
                        {new Date(o.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div>
                    <strong>Items:</strong>
                    <ul style={{ marginTop: "0.25rem" }}>
                      {o.items.map((item, idx) => (
                        <li key={idx}>
                          Dish #{item.dish_id} — qty {item.quantity} @ $
                          {item.unit_price.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

const thStyle = {
  borderBottom: "1px solid #ccc",
  textAlign: "left",
  padding: "0.5rem",
  fontSize: "0.9rem",
};

const tdStyle = {
    borderBottom: "1px solid #eee",
    padding: "0.5rem",
    fontSize: "0.9rem",
  };
  

export default AdminPage;
