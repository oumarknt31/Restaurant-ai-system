import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

function PerformanceDashboardPage() {
  // ❗ Read user synchronously from localStorage
  const currentUser = getCurrentUser();

  const [data, setData] = useState({ chefs: [], couriers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // If not logged in at all -> redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const isManagerLike = ["staff", "manager", "admin"].includes(
    currentUser.role
  );

  // Logged in but not staff/manager/admin -> show message
  if (!isManagerLike) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Performance Dashboard</h2>
        <p>You must be staff/manager/admin to view this page.</p>
      </div>
    );
  }

  // Only fetch data if we know the user and they have access
  useEffect(() => {
    async function fetchPerformance() {
      setError("");
      setLoading(true);
      try {
        const res = await api.get("/reputation/performance-summary");
        setData(res.data || { chefs: [], couriers: [] });
      } catch (err) {
        console.error(err);
        setError("Failed to load performance data.");
      } finally {
        setLoading(false);
      }
    }

    fetchPerformance();
  }, []);

  const { chefs, couriers } = data;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1100px", margin: "0 auto" }}>
      <h2>Chef &amp; Courier Performance Dashboard</h2>
      <p style={{ maxWidth: "700px", color: "#555" }}>
        Visual overview of how chefs and delivery staff are performing based on
        ratings, compliments, complaints, and warnings.
      </p>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {loading && <p>Loading performance data...</p>}

      {!loading && (
        <>
          {/* ===== CHEF CHARTS ===== */}
          <section style={{ marginTop: "1.5rem" }}>
            <h3>Chefs — Ratings & HR Signals</h3>
            {chefs.length === 0 ? (
              <p>No chefs found.</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={chefs}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="average_rating"
                      name="Average rating"
                      fill="#8884d8"
                    />
                    <Bar
                      dataKey="total_compliments"
                      name="Compliments"
                      fill="#82ca9d"
                    />
                    <Bar
                      dataKey="upheld_complaints"
                      name="Upheld complaints"
                      fill="#ff7f7f"
                    />
                    <Bar dataKey="warnings" name="Warnings" fill="#ffa726" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* ===== COURIER CHARTS ===== */}
          <section style={{ marginTop: "2rem" }}>
            <h3>Couriers — Deliveries & HR Signals</h3>
            {couriers.length === 0 ? (
              <p>No couriers found.</p>
            ) : (
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={couriers}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="deliveries_completed"
                      name="Completed deliveries"
                      fill="#8884d8"
                    />
                    <Bar
                      dataKey="average_delivery_rating"
                      name="Average delivery rating"
                      fill="#82ca9d"
                    />
                    <Bar
                      dataKey="total_compliments"
                      name="Compliments"
                      fill="#8dd1e1"
                    />
                    <Bar
                      dataKey="upheld_complaints"
                      name="Upheld complaints"
                      fill="#ff7f7f"
                    />
                    <Bar dataKey="warnings" name="Warnings" fill="#ffa726" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {/* Simple numeric summary below charts */}
          <section style={{ marginTop: "2rem" }}>
            <h3>Quick Table View</h3>
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "260px" }}>
                <h4>Chefs</h4>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Avg ★</th>
                      <th>Compliments</th>
                      <th>Upheld comp.</th>
                      <th>Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chefs.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.average_rating.toFixed(2)}</td>
                        <td>{c.total_compliments}</td>
                        <td>{c.upheld_complaints}</td>
                        <td>{c.warnings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ flex: 1, minWidth: "260px" }}>
                <h4>Couriers</h4>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.9rem",
                  }}
                >
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Delivered</th>
                      <th>Avg ★</th>
                      <th>Compliments</th>
                      <th>Upheld comp.</th>
                      <th>Warnings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couriers.map((u) => (
                      <tr key={u.id}>
                        <td>{u.name}</td>
                        <td>{u.deliveries_completed}</td>
                        <td>{u.average_delivery_rating.toFixed(2)}</td>
                        <td>{u.total_compliments}</td>
                        <td>{u.upheld_complaints}</td>
                        <td>{u.warnings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default PerformanceDashboardPage;
