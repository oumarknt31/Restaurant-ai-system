import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function ReputationManagementPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingComplaints, setPendingComplaints] = useState([]);
  const [chefSummary, setChefSummary] = useState([]);
  const [complaintsAgainstMe, setComplaintsAgainstMe] = useState([]);
  const [disputeLoadingId, setDisputeLoadingId] = useState(null);

  const [feedbackByMe, setFeedbackByMe] = useState([]);
  const [feedbackByMeLoading, setFeedbackByMeLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  // Helper: is this user staff/manager/admin?
  const isManager = ["staff", "manager", "admin"].includes(
    currentUser?.role || ""
  );

  // Load current user once
  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  // After we know who the user is, load data
  useEffect(() => {
    if (!currentUser) return;

    // Everyone: complaints about themselves
    fetchComplaintsAgainstMe();

    // Manager / Staff / Admin can review ALL pending complaints
  if (["manager", "admin", "staff"].includes(currentUser.role)) {
    fetchPendingComplaints();   // << ⭐ THIS is the important part
    fetchChefSummary();         // (optional but your page already includes it)
  }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Everyone: complaints about themselves
    fetchComplaintsAgainstMe();

    // NEW: everyone can see what THEY filed about others
    fetchFeedbackByMe();

    // Manager / Staff / Admin can review ALL pending complaints
  if (["manager", "admin", "staff"].includes(currentUser.role)) {
    fetchPendingComplaints();   // << ⭐ THIS is the important part
    fetchChefSummary();         // (optional but your page already includes it)
  }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);


  // ---------- API helpers ----------

  async function fetchComplaintsAgainstMe() {
    try {
      const res = await api.get(`/reputation/about-me/${currentUser.id}`);
      setComplaintsAgainstMe(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchFeedbackByMe() {
    if (!currentUser) return;
    setFeedbackByMeLoading(true);
    try {
      const res = await api.get(`/reputation/by-me/${currentUser.id}`);
      setFeedbackByMe(res.data || []);
    } catch (err) {
      console.error(err);
      // We won't surface this as a blocking error, just log
    } finally {
      setFeedbackByMeLoading(false);
    }
  }


  async function handleDispute(feedbackId) {
    if (!currentUser) return;

    const reason = window.prompt(
      "Explain why you dispute this complaint (optional):"
    );
    if (reason === null) return; // user hit Cancel

    setDisputeLoadingId(feedbackId);
    setError("");
    setSuccess("");

    try {
      const res = await api.post("/reputation/dispute", {
        user_id: currentUser.id,
        feedback_id: feedbackId,
        reason,
      });

      setSuccess(res.data.message || "Dispute submitted.");
      await fetchComplaintsAgainstMe();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to dispute complaint.");
    } finally {
      setDisputeLoadingId(null);
    }
  }

  async function fetchPendingComplaints() {
    try {
      const res = await api.get("/reputation/pending-complaints");
      setPendingComplaints(res.data || []);
    } catch (err) {
      console.error(err);
    }
  }
  
  
  async function fetchPendingComplaints() {
    setError("");
    try {
      const res = await api.get("/reputation/pending-complaints");
      setPendingComplaints(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load pending complaints.");
    }
  }

  async function fetchChefSummary() {
    setError("");
    try {
      const res = await api.get("/reputation/chef-summary");
      setChefSummary(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load chef rating summary.");
    }
  }

  async function handleReview(complaintId, decision) {
    setLoading(true);
    setError("");
    setSuccess("");
  
    try {
      const res = await api.post("/reputation/review-complaint", {
        complaint_id: complaintId,
        decision, // "upheld" or "dismissed"
      });
  
      setSuccess(res.data?.message || "Decision recorded.");
  
      // Remove this complaint from the pending list
      setPendingComplaints((prev) =>
        prev.filter((c) => c.id !== complaintId)
      );
  
      // Optionally refresh "complaintsAgainstMe" / chefSummary if needed
      fetchComplaintsAgainstMe();
      fetchChefSummary();
    } catch (err) {
      console.error(err);
      setError("Failed to submit review decision.");
    } finally {
      setLoading(false);
    }
  }
  

  // ---------- Render ----------

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Reputation & HR</h2>
        <p>You must be logged in.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px" }}>
      <h2>Reputation & HR</h2>
      <p style={{ maxWidth: "650px" }}>
        View complaints about you, and (if you are staff/manager/admin) review
        pending complaints and chef performance according to HR rules.
      </p>
  
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}
  
      {/* ▶ SECTION 1 — Complaints Filed Against YOU (everyone can see) */}
      <section style={{ marginTop: "1.5rem" }}>
        <h3>Complaints Filed Against You</h3>
        <p style={{ fontSize: "0.8rem", color: "#6c757d" }}>
          <span style={{ color: "#842029" }}>Red</span> = upheld (counts as a
          warning),{" "}
          <span style={{ color: "#0f5132" }}>Green</span> = dismissed / cancelled,
          Yellow = pending.
        </p>
        {complaintsAgainstMe.length === 0 ? (
          <p>No complaints about you.</p>
        ) : (
          complaintsAgainstMe.map((c) => {
            let bgColor = "#fff";
            let borderColor = "#ccc";
            let statusTextColor = "#212529";
  
            if (c.status === "upheld") {
              // Warning against you
              bgColor = "#fde2e1"; // light red
              borderColor = "#f5c2c7";
              statusTextColor = "#842029";
            } else if (
              c.status === "dismissed" ||
              c.status === "cancelled_by_compliment"
            ) {
              // You were effectively cleared
              bgColor = "#e6ffed"; // light green
              borderColor = "#b7f0c8";
              statusTextColor = "#0f5132";
            } else if (c.status === "pending") {
              bgColor = "#fff9db"; // light yellow
              borderColor = "#ffe08a";
              statusTextColor = "#856404";
            }
  
            return (
              <div
                key={c.id}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.75rem",
                  backgroundColor: bgColor,
                }}
              >
                <p>
                  <strong>Complaint #{c.id}</strong> — filed{" "}
                  {new Date(c.created_at).toLocaleString()}
                </p>
                <p>
                  <strong>From:</strong>{" "}
                  {c.accuser_name || `User ${c.accuser_id}`} (ID: {c.accuser_id})
                </p>
                {c.order_id && (
                  <p>
                    <strong>Order ID:</strong> {c.order_id}
                  </p>
                )}
                {c.reason && (
                  <p>
                    <strong>Reason:</strong> {c.reason}
                  </p>
                )}
                <p>
                  <strong>Status:</strong>{" "}
                  <span style={{ color: statusTextColor }}>{c.status}</span>
                </p>
  
                {c.status === "upheld" && (
                  <p style={{ fontSize: "0.85rem", color: "#842029" }}>
                    Outcome: <strong>Upheld</strong>. This counts toward your
                    warnings.
                  </p>
                )}
                {(c.status === "dismissed" ||
                  c.status === "cancelled_by_compliment") && (
                  <p style={{ fontSize: "0.85rem", color: "#0f5132" }}>
                    Outcome: <strong>Cleared</strong>. This complaint does{" "}
                    <em>not</em> give you a new warning.
                  </p>
                )}
  
                {c.status === "pending" && (
                  <button
                    onClick={() => handleDispute(c.id)}
                    disabled={disputeLoadingId === c.id}
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: "999px",
                      border: "1px solid #fd7e14",
                      backgroundColor:
                        disputeLoadingId === c.id ? "#fff4e6" : "#ffe8cc",
                      color: "#d9480f",
                      cursor: disputeLoadingId === c.id ? "wait" : "pointer",
                      fontSize: "0.85rem",
                      marginTop: "0.4rem",
                    }}
                  >
                    {disputeLoadingId === c.id
                      ? "Submitting..."
                      : "Dispute Complaint"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>
  
      {/* ▶ SECTION 2 — Your own complaints & compliments about others */}
      <section style={{ marginTop: "2rem" }}>
        <h3>Your Complaints &amp; Compliments About Others</h3>
        <p style={{ fontSize: "0.85rem", color: "#6c757d" }}>
          Complaints you filed are shown in{" "}
          <span style={{ color: "#842029" }}>red</span>. Compliments are shown in{" "}
          <span style={{ color: "#087f5b" }}>green</span>. This includes feedback
          about chefs, delivery staff, and customers.
        </p>
  
        {feedbackByMeLoading ? (
          <p>Loading your feedback history…</p>
        ) : feedbackByMe.length === 0 ? (
          <p>You have not filed any complaints or compliments yet.</p>
        ) : (
          feedbackByMe.map((f) => {
            const isComplaint = f.type === "complaint";
            const dateStr = f.created_at
              ? new Date(f.created_at).toLocaleString()
              : "";
  
            const bgColor = isComplaint ? "#fff5f5" : "#f3fff7";
            const borderColor = isComplaint ? "#f5c2c7" : "#b7f0c8";
            const titleColor = isComplaint ? "#842029" : "#087f5b";
  
            return (
              <div
                key={f.id}
                style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.75rem",
                  backgroundColor: bgColor,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: titleColor,
                      textTransform: "capitalize",
                    }}
                  >
                    {f.type} ·{" "}
                    {f.target_user_name || `User #${f.target_user_id}`}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                    {dateStr}
                  </span>
                </div>
  
                <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                  <strong>Order:</strong>{" "}
                  {f.order_id != null ? `#${f.order_id}` : "N/A"}{" "}
                  <strong>Status:</strong> {f.status}
                  {typeof f.rating === "number" && (
                    <>
                      {"  "}
                      <strong>Rating:</strong> {f.rating} / 5
                    </>
                  )}
                </div>
  
                {f.reason && (
                  <p style={{ fontSize: "0.85rem" }}>
                    <strong>Notes:</strong> {f.reason}
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>
  
      {/* ▶ SECTION 3 — Manager-only HR Controls */}
      {isManager && (
        <>
          {/* Pending Complaints for Manager */}
          <section style={{ marginTop: "2rem" }}>
            <h3>Pending Complaints (Manager View)</h3>
            {pendingComplaints.length === 0 ? (
              <p>No pending complaints.</p>
            ) : (
              pendingComplaints.map((c) => (
                <div
                  key={c.id}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    marginBottom: "0.75rem",
                    backgroundColor: "#fff",
                  }}
                >
                  <p>
                    <strong>Complaint #{c.id}</strong> &mdash; Filed on{" "}
                    {new Date(c.created_at).toLocaleString()}
                  </p>
                  <p>
                    <strong>Accuser:</strong>{" "}
                    {c.accuser_name || `User ${c.accuser_id}`} (ID:{" "}
                    {c.accuser_id})
                  </p>
                  <p>
                    <strong>Target User:</strong>{" "}
                    {c.target_user_name || `User ${c.target_user_id}`} (ID:{" "}
                    {c.target_user_id})
                  </p>
                  {c.order_id && (
                    <p>
                      <strong>Order ID:</strong> {c.order_id}
                    </p>
                  )}
                  {c.rating && (
                    <p>
                      <strong>Rating:</strong> {c.rating}/5
                    </p>
                  )}
                  {c.reason && (
                    <p>
                      <strong>Reason:</strong> {c.reason}
                    </p>
                  )}
  
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      marginTop: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      onClick={() => handleReview(c.id, "upheld")}
                      disabled={loading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        border: "1px solid #198754",
                        backgroundColor: "#d1f7e3",
                        color: "#0f5132",
                        cursor: "pointer",
                      }}
                    >
                      Uphold
                    </button>
                    <button
                      onClick={() => handleReview(c.id, "dismissed")}
                      disabled={loading}
                      style={{
                        padding: "0.4rem 0.8rem",
                        borderRadius: "6px",
                        border: "1px solid #dc3545",
                        backgroundColor: "#f8d7da",
                        color: "#842029",
                        cursor: "pointer",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
  
          {/* Chef Summary */}
          <section style={{ marginTop: "2rem" }}>
            <h3>Chef Rating Summary</h3>
            {chefSummary.length === 0 ? (
              <p>No chefs found in the system.</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                {chefSummary.map((chef) => (
                  <div
                    key={chef.chef_id}
                    style={{
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      backgroundColor: "#fff",
                    }}
                  >
                    <p>
                      <strong>{chef.chef_name}</strong> (ID: {chef.chef_id})
                    </p>
                    <p>
                      <strong>Role:</strong> {chef.role}
                    </p>
                    <p>
                      <strong>Average Rating:</strong>{" "}
                      {chef.average_rating !== null
                        ? chef.average_rating.toFixed(2)
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Total Compliments:</strong>{" "}
                      {chef.total_compliments}
                    </p>
                    <p>
                      <strong>Upheld Complaints:</strong>{" "}
                      {chef.upheld_complaints}
                    </p>
                    <p>
                      <strong>Warnings:</strong>{" "}
                      {chef.warnings !== null ? chef.warnings : 0}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      {chef.is_active ? "Active" : "Inactive"}{" "}
                      {chef.is_blacklisted && "(Blacklisted)"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );  
}

export default ReputationManagementPage;
