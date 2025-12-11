import { useState, useEffect } from "react";
import { getCurrentUser } from "../auth/user";
import api from "../api/client";
import { Link, useNavigate } from "react-router-dom";


function DeliveryJobsPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [openJobs, setOpenJobs] = useState([]);
  const [myJobs, setMyJobs] = useState([]);
  const [myCustomerFeedback, setMyCustomerFeedback] = useState([]); // NEW
  const [feedbackListLoading, setFeedbackListLoading] = useState(false); // NEW

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [acceptLoading, setAcceptLoading] = useState({});
  const [statusLoading, setStatusLoading] = useState({});
  const [feedbackLoading, setFeedbackLoading] = useState({}); // for submit buttons
  const navigate = useNavigate();


  const [activeTab, setActiveTab] = useState("jobs"); // "jobs" | "feedback"

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);

    fetchOpenJobs();
    if (user) {
      fetchMyJobs(user.id);
      fetchMyCustomerFeedback(user.id);
    }
  }, []);

  async function fetchOpenJobs() {
    setError("");
    try {
      const res = await api.get("/delivery/open-jobs");
      setOpenJobs(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load open delivery jobs.");
    }
  }

  async function fetchMyJobs(userId) {
    setError("");
    try {
      const res = await api.get(`/delivery/my-jobs/${userId}`);
      setMyJobs(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load your assigned jobs.");
    }
  }

  // NEW: load courier's feedback about customers
  async function fetchMyCustomerFeedback(userId) {
    setError("");
    setFeedbackListLoading(true);
    try {
      const res = await api.get(
        `/reputation/my-customer-feedback/${userId}`
      );
      setMyCustomerFeedback(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load your feedback about customers.");
    } finally {
      setFeedbackListLoading(false);
    }
  }

  async function handleAccept(job) {
    setError("");
    setSuccess("");

    if (!currentUser) {
      setError("You must be logged in.");
      return;
    }

    if (currentUser.role !== "courier" && currentUser.role !== "delivery") {
      setError("Only couriers can accept jobs.");
      return;
    }

    setAcceptLoading((prev) => ({ ...prev, [job.id]: true }));

    try {
      await api.post("/delivery/accept-job", {
        user_id: currentUser.id,
        delivery_job_id: job.id,
        fee: job.suggested_fee,
        eta_minutes: job.estimated_minutes,
      });

      setSuccess(`You accepted job #${job.id}.`);
      await fetchOpenJobs();
      await fetchMyJobs(currentUser.id);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Failed to accept job.");
    } finally {
      setAcceptLoading((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  function handleSkip(jobId) {
    // Just hide this job from the list (refuse for this courier)
    setOpenJobs((prev) => prev.filter((j) => j.id !== jobId));
  }

  async function handleUpdateStatus(jobId, newStatus) {
    if (!currentUser) return;

    setError("");
    setSuccess("");
    setStatusLoading((prev) => ({ ...prev, [jobId]: true }));

    try {
      await api.post("/delivery/update-status", {
        user_id: currentUser.id,
        delivery_job_id: jobId,
        status: newStatus,
      });

      setSuccess(`Job #${jobId} marked as ${newStatus}.`);
      await fetchMyJobs(currentUser.id);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Failed to update delivery status.");
    } finally {
      setStatusLoading((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  function handleCustomerFeedbackNavigate(job, feedbackType) {
    if (!currentUser) {
      setError("You must be logged in.");
      return;
    }

    // Only allow feedback once the order is delivered
    const isDelivered =
      job.status === "delivered" || job.order_status === "delivered";

    if (!isDelivered) {
      setError("You can only file feedback for orders you've delivered.");
      return;
    }

    if (!job.customer_id) {
      setError("No customer is associated with this job.");
      return;
    }

    setError("");
    setSuccess("");

    // Navigate to FeedbackPage with pre-filled context
    navigate("/feedback", {
      state: {
        // what they clicked
        type: feedbackType, // "complaint" or "compliment"

        // who it's about
        targetUserId: job.customer_id,
        targetKind: "customer",
        displayName: job.customer_name,

        // which order this concerns
        orderId: job.order_id,

        // optional debug/trace info
        from: "courier-delivery-jobs",
      },
    });
  }



  

  // NEW: delivery person files compliment/complaint about the customer
  async function handleCustomerFeedback(job, type) {
    if (!currentUser) return;

    setError("");
    setSuccess("");

    if (!job.customer_id) {
      setError("No customer is associated with this delivery job.");
      return;
    }

    if (job.status !== "delivered") {
      setError(
        "You can only file feedback about customers for jobs that are delivered."
      );
      return;
    }

    const prettyType =
      type === "compliment" ? "compliment" : "complaint";

    const reason = window.prompt(
      `Enter a short ${prettyType} reason about customer ${
        job.customer_name || "(unknown)"
      } (optional):`
    );

    setFeedbackLoading((prev) => ({ ...prev, [job.id]: true }));

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: job.customer_id,
        type,
        order_id: job.order_id,
        reason: reason || undefined,
      });

      setSuccess(
        `${
          prettyType.charAt(0).toUpperCase() + prettyType.slice(1)
        } submitted about customer ${
          job.customer_name || job.customer_id
        }.`
      );

      // Refresh list of feedback in the "My feedback" tab
      await fetchMyCustomerFeedback(currentUser.id);
    } catch (err) {
      console.error(err);
      if (err.response?.data?.error) setError(err.response.data.error);
      else setError("Failed to submit feedback about the customer.");
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [job.id]: false }));
    }
  }

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Delivery Jobs</h2>
        <p>You must be logged in.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (currentUser.role !== "courier" && currentUser.role !== "delivery") {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Delivery Jobs</h2>
        <p>You must be a courier to view this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <h2>Delivery Jobs</h2>
      <p style={{ color: "#555" }}>
        Logged in as courier: <strong>{currentUser.name}</strong>
      </p>

      {/* Tab buttons */}
      <div
        style={{
          margin: "0.75rem 0 1rem",
          display: "inline-flex",
          borderRadius: "999px",
          border: "1px solid #dee2e6",
          overflow: "hidden",
          backgroundColor: "#f8f9fa",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("jobs")}
          style={{
            padding: "0.35rem 0.9rem",
            border: "none",
            backgroundColor:
              activeTab === "jobs" ? "#0d6efd" : "transparent",
            color: activeTab === "jobs" ? "#fff" : "#495057",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          Delivery jobs
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("feedback");
            if (currentUser) {
              fetchMyCustomerFeedback(currentUser.id);
            }
          }}
          style={{
            padding: "0.35rem 0.9rem",
            border: "none",
            backgroundColor:
              activeTab === "feedback" ? "#0d6efd" : "transparent",
            color: activeTab === "feedback" ? "#fff" : "#495057",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          My feedback about customers
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {success && <p style={{ color: "green" }}>{success}</p>}

      {activeTab === "jobs" ? (
        <>
          {/* OPEN JOBS SECTION */}
          <section style={{ marginBottom: "2rem" }}>
            <h3>Open Jobs</h3>
            {openJobs.length === 0 ? (
              <p>No open jobs.</p>
            ) : (
              openJobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #ccc",
                    padding: "1rem",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    backgroundColor: "#fff",
                  }}
                >
                  <h4>Job #{job.id}</h4>
                  <p>
                    <strong>Address:</strong> {job.delivery_address}
                  </p>
                  {job.delivery_notes && (
                    <p>
                      <strong>Notes:</strong> {job.delivery_notes}
                    </p>
                  )}
                  <p>
                    <strong>Estimated time:</strong> ~
                    {job.estimated_minutes} minutes
                  </p>
                  <p>
                    <strong>Delivery fee:</strong> $
                    {job.suggested_fee.toFixed(2)}
                  </p>

                  <div
                    style={{
                      marginTop: "0.75rem",
                      display: "flex",
                      gap: "0.5rem",
                    }}
                  >
                    <button
                      onClick={() => handleAccept(job)}
                      disabled={!!acceptLoading[job.id]}
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #20c997",
                        backgroundColor: "#e6fcf5",
                        color: "#087f5b",
                        cursor: acceptLoading[job.id]
                          ? "not-allowed"
                          : "pointer",
                      }}
                    >
                      {acceptLoading[job.id]
                        ? "Accepting..."
                        : "Accept job"}
                    </button>

                    <button
                      onClick={() => handleSkip(job.id)}
                      style={{
                        padding: "0.4rem 0.9rem",
                        borderRadius: "999px",
                        border: "1px solid #ced4da",
                        backgroundColor: "#f8f9fa",
                        color: "#495057",
                        cursor: "pointer",
                      }}
                    >
                      Skip / Refuse
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* MY JOBS SECTION */}
          <section>
            <h3>My Accepted Jobs</h3>
            {myJobs.length === 0 ? (
              <p>You have no assigned jobs yet.</p>
            ) : (
              myJobs.map((job) => {
                const isDone =
                  job.status === "delivered" ||
                  job.status === "cancelled";
                const loading = !!statusLoading[job.id];
                const isFeedbackLoading = !!feedbackLoading[job.id];

                return (
                  <div
                    key={job.id}
                    style={{
                      border: "1px solid #bbb",
                      padding: "1rem",
                      borderRadius: "8px",
                      marginBottom: "1rem",
                      backgroundColor: "#f8f9fa",
                    }}
                  >
                    <h4>
                      Job #{job.id} —{" "}
                      <span style={{ textTransform: "capitalize" }}>
                        {job.status}
                      </span>
                    </h4>
                    {job.customer_name && (
                      <p>
                        <strong>Customer:</strong> {job.customer_name} (id:{" "}
                        {job.customer_id})
                      </p>
                    )}
                    <p>
                      <strong>Address:</strong> {job.delivery_address}
                    </p>
                    {job.delivery_notes && (
                      <p>
                        <strong>Notes:</strong> {job.delivery_notes}
                      </p>
                    )}
                    <p>
                      <strong>Delivery fee:</strong>{" "}
                      {job.agreed_fee != null
                        ? `$${job.agreed_fee.toFixed(2)}`
                        : job.suggested_fee
                        ? `$${job.suggested_fee.toFixed(2)} (suggested)`
                        : "N/A"}
                    </p>

                    {job.customer_name && (
                      <p>
                        <strong>Customer:</strong> {job.customer_name} (id: {job.customer_id})
                      </p>
                    )}

                    {/* Status update buttons */}
                    {!isDone && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {job.status === "assigned" && (
                          <button
                            onClick={() =>
                              handleUpdateStatus(job.id, "picked_up")
                            }
                            disabled={loading}
                            style={{
                              padding: "0.35rem 0.9rem",
                              borderRadius: "999px",
                              border: "1px solid #0d6efd",
                              backgroundColor: "#e7f1ff",
                              color: "#0d6efd",
                              cursor: loading
                                ? "not-allowed"
                                : "pointer",
                            }}
                          >
                            {loading ? "Updating..." : "Mark as picked up"}
                          </button>
                        )}

                        {job.status === "picked_up" && (
                          <button
                            onClick={() =>
                              handleUpdateStatus(job.id, "delivered")
                            }
                            disabled={loading}
                            style={{
                              padding: "0.35rem 0.9rem",
                              borderRadius: "999px",
                              border: "1px solid #198754",
                              backgroundColor: "#d1e7dd",
                              color: "#0f5132",
                              cursor: loading
                                ? "not-allowed"
                                : "pointer",
                            }}
                          >
                            {loading ? "Updating..." : "Mark as delivered"}
                          </button>
                        )}
                      </div>
                    )}

                     {/* Feedback about customers */}
                      {job.status === "delivered" && (
                        <div
                          style={{
                            marginTop: "0.75rem",
                            paddingTop: "0.75rem",
                            borderTop: "1px dashed #ccc",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.9rem",
                              marginBottom: "0.4rem",
                              color: "#495057",
                            }}
                          >
                            <strong>Feedback about customer</strong>{" "}
                            {job.customer_name && (
                              <span>(Customer: {job.customer_name})</span>
                            )}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "0.4rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleCustomerFeedbackNavigate(job, "compliment")
                              }
                              style={{
                                padding: "0.35rem 0.9rem",
                                borderRadius: "999px",
                                border: "1px solid #20c997",
                                backgroundColor: "#e6fcf5",
                                color: "#087f5b",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                              }}
                            >
                              Compliment customer
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleCustomerFeedbackNavigate(job, "complaint")
                              }
                              style={{
                                padding: "0.35rem 0.9rem",
                                borderRadius: "999px",
                                border: "1px solid #f03e3e",
                                backgroundColor: "#ffe3e3",
                                color: "#c92a2a",
                                cursor: "pointer",
                                fontSize: "0.85rem",
                                fontWeight: 500,
                              }}
                            >
                              Complain about customer
                            </button>

                          </div>
                        </div>
                      )}

                  </div>
                );
              })
            )}
          </section>
        </>
      ) : (
        // --- TAB: My feedback about customers ---
        <section>
          <h3>My feedback about customers</h3>
          {feedbackListLoading ? (
            <p>Loading your feedback...</p>
          ) : myCustomerFeedback.length === 0 ? (
            <p>
              You have not submitted any compliments or complaints about
              customers yet.
            </p>
          ) : (
            myCustomerFeedback.map((f) => {
              const dateStr = f.created_at
                ? new Date(f.created_at).toLocaleString()
                : "";
              const isComplaint = f.type === "complaint";
              return (
                <div
                  key={f.id}
                  style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    marginBottom: "0.75rem",
                    backgroundColor: isComplaint ? "#fff5f5" : "#f3fff7",
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
                        color: isComplaint ? "#842029" : "#087f5b",
                        textTransform: "capitalize",
                      }}
                    >
                      {f.type} &middot;{" "}
                      {f.target_user_name || `Customer #${f.target_user_id}`}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>
                      {dateStr}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                    <strong>Order:</strong>{" "}
                    {f.order_id != null ? `#${f.order_id}` : "N/A"}
                    {"  "}
                    <strong>Status:</strong> {f.status}
                    {typeof f.rating === "number" && (
                      <>
                        {"  "}
                        <strong>Rating:</strong> {f.rating} / 5
                      </>
                    )}
                  </div>

                  {f.reason && (
                    <p
                      style={{
                        marginTop: "0.25rem",
                        fontSize: "0.85rem",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {f.reason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}

export default DeliveryJobsPage;
