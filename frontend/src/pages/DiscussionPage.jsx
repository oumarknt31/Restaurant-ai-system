// src/pages/DiscussionPage.jsx
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/client";
import { getCurrentUser } from "../auth/user";

function DiscussionPage() {
  const [currentUser, setCurrentUser] = useState(null);

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // creating a new topic
  const [newCategory, setNewCategory] = useState("dish"); // "dish" | "chef" | "delivery"
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [bodyPlaceholder, setBodyPlaceholder] = useState(
    "Share your thoughts about this dish, chef, or delivery experience..."
  );
  const [creating, setCreating] = useState(false);

  // target (who/what the topic is about)
  const [targetType, setTargetType] = useState(null); // "dish" | "chef" | "delivery"
  const [targetId, setTargetId] = useState(null);     // number

  // replying
  const [replyText, setReplyText] = useState({});
  const [replyLoadingId, setReplyLoadingId] = useState(null);

  const location = useLocation();

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    fetchTopics();
  }, []);

  // Prefill when coming from Menu or My Orders
  useEffect(() => {
    const state = location.state;

    // From MenuPage.handleDiscussDish:
    //   state = { fromDish: { id, name } }
    if (state?.fromDish) {
      const { id, name } = state.fromDish;
      setNewCategory("dish");
      setTargetType("dish");
      setTargetId(id);
      setNewTitle(`Thoughts on ${name}`);
      setBodyPlaceholder(
        `Share your experience with "${name}" – flavor, portion, spice level, etc.`
      );
      return;
    }

    // From MyOrdersPage:
    //   state = { initialCategory, initialTitle, targetType, targetId }
    if (state?.initialCategory || state?.initialTitle || state?.targetType) {
      if (state.initialCategory) {
        setNewCategory(state.initialCategory);
      }
      if (state.targetType) {
        setTargetType(state.targetType);
      } else if (state.initialCategory) {
        setTargetType(state.initialCategory);
      }
      if (state.targetId != null) {
        setTargetId(state.targetId);
      }

      if (state.initialTitle) {
        setNewTitle(state.initialTitle);
        setBodyPlaceholder(
          `Share your thoughts about: ${state.initialTitle}`
        );
      }
    }
  }, [location.state]);

  async function fetchTopics() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // 1) Get ALL topics (from all users)
      const res = await api.get("/discussion/topics");
      const rawTopics = res.data || [];

      // 2) For each topic, fetch its posts
      const topicsWithPosts = await Promise.all(
        rawTopics.map(async (t) => {
          try {
            const postsRes = await api.get(`/discussion/topics/${t.id}/posts`);
            const payload = postsRes.data || {};
            return {
              ...t,
              posts: payload.posts || [],
            };
          } catch (err) {
            console.error("Failed to load posts for topic", t.id, err);
            return {
              ...t,
              posts: [],
            };
          }
        })
      );

      setTopics(topicsWithPosts);
    } catch (err) {
      console.error(err);
      setError("Failed to load discussion topics.");
    } finally {
      setLoading(false);
    }
  }

  function canPost() {
    if (!currentUser) return false;
    return ["customer", "vip", "delivery", "courier"].includes(
      currentUser.role
    );
  }

  function categoryLabel(type) {
    switch (type) {
      case "chef":
        return "Chef";
      case "dish":
        return "Dish";
      case "delivery":
        return "Delivery";
      default:
        return "General";
    }
  }

  async function handleCreateTopic(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentUser) {
      setError("You must be logged in to start a discussion.");
      return;
    }
    if (!canPost()) {
      setError("Your role is not allowed to start topics.");
      return;
    }
    if (!newTitle.trim()) {
      setError("Please provide a title.");
      return;
    }

    // Decide which target we are using
    const effectiveTargetType = targetType || newCategory;
    const effectiveTargetId = targetId;

    if (!effectiveTargetType || effectiveTargetId == null) {
      setError(
        "This demo expects you to start discussions from a specific dish/chef/delivery (e.g., via Menu or My Orders)."
      );
      return;
    }

    setCreating(true);
    try {
      // Match your backend: POST /api/discussion/topics
      await api.post("/discussion/topics", {
        user_id: currentUser.id,
        title: newTitle.trim(),
        body: newBody.trim(), 
        target_type: effectiveTargetType, // "dish" | "chef" | "delivery"
        target_id: effectiveTargetId,
      });

      // Clear the content box only; keep category/title targeted if user wants more threads
      setNewBody("");
      setSuccess("Topic created successfully.");
      await fetchTopics();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to create discussion topic.");
    } finally {
      setCreating(false);
    }
  }

  async function handleReply(topicId) {
    if (!currentUser) {
      setError("You must be logged in to reply.");
      return;
    }
    if (!canPost()) {
      setError("Your role is not allowed to reply.");
      return;
    }

    const text = (replyText[topicId] || "").trim();
    if (!text) {
      setError("Please write a reply before submitting.");
      return;
    }

    setError("");
    setSuccess("");
    setReplyLoadingId(topicId);

    try {
      await api.post(`/discussion/topics/${topicId}/posts`, {
        user_id: currentUser.id,
        content: text,
      });

      setReplyText((prev) => ({ ...prev, [topicId]: "" }));
      await fetchTopics();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to submit reply.");
    } finally {
      setReplyLoadingId(null);
    }
  }

  async function handleComplaintAboutComment(topicId, comment) {
    if (!currentUser) {
      setError("You must be logged in to file a complaint.");
      return;
    }

    if (!comment.author_id) {
      setError("Cannot identify the author of this comment.");
      return;
    }

    const previewText = comment.content || comment.body || "";
    const reason = window.prompt(
      `Describe your complaint about this comment by ${
        comment.author_name || "this user"
      } (optional):`,
      previewText ? `"${previewText}"` : ""
    );

    setError("");
    setSuccess("");

    try {
      await api.post("/reputation/file", {
        accuser_id: currentUser.id,
        target_user_id: comment.author_id,
        type: "complaint",
        order_id: null,         // discussion-based complaint, not tied to an order
        reason: reason || undefined,
      });

      setSuccess("Complaint about this comment has been submitted for manager review.");
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error || "Failed to submit complaint about this comment."
      );
    }
  }

  // ---- render ----

  if (!currentUser) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h2>Discussion Forum</h2>
        <p>You must be logged in to view and participate in discussions.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      <h2>Discussion Forum</h2>
      <p style={{ maxWidth: "650px", color: "#555" }}>
        Registered customers and VIPs can start or participate in discussion
        topics about <strong>chefs</strong>, <strong>dishes</strong>, and{" "}
        <strong>delivery people</strong>. Delivery staff can also share their
        perspective about customers they&apos;ve served.
      </p>

      {error && (
        <p style={{ color: "red", marginBottom: "0.5rem" }}>Error: {error}</p>
      )}
      {success && (
        <p style={{ color: "green", marginBottom: "0.5rem" }}>{success}</p>
      )}

      {/* New topic form */}
      {canPost() && (
        <section
          style={{
            marginTop: "1rem",
            marginBottom: "1.5rem",
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #dee2e6",
            backgroundColor: "#f8f9fa",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Start a new topic</h3>
          <form onSubmit={handleCreateTopic}>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                flexWrap: "wrap",
                marginBottom: "0.5rem",
              }}
            >
              <div>
                <label style={{ fontSize: "0.85rem" }}>Category</label>
                <br />
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ padding: "0.25rem 0.5rem" }}
                >
                  <option value="dish">Dish</option>
                  <option value="chef">Chef</option>
                  <option value="delivery">Delivery</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ fontSize: "0.85rem" }}>Title</label>
                <br />
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: "100%", padding: "0.3rem" }}
                  placeholder="e.g., Thoughts on Spicy Ramen"
                />
              </div>
            </div>

            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem" }}>Content</label>
              <br />
              <textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "0.4rem" }}
                placeholder={bodyPlaceholder}
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "999px",
                border: "1px solid #0d6efd",
                backgroundColor: "#0d6efd",
                color: "#fff",
                cursor: creating ? "wait" : "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              {creating ? "Creating..." : "Post topic"}
            </button>
          </form>
        </section>
      )}

      {/* Topic list */}
      <section>
        <h3>Topics</h3>
        {loading ? (
          <p>Loading topics...</p>
        ) : topics.length === 0 ? (
          <p>No topics yet. Be the first to start one!</p>
        ) : (
          topics.map((topic) => {
            const posts = topic.posts || [];
            return (
              <div
                key={topic.id}
                style={{
                  border: "1px solid #dee2e6",
                  borderRadius: "8px",
                  padding: "0.75rem 1rem",
                  marginBottom: "0.8rem",
                  backgroundColor: "#ffffff",
                }}
              >

                {/* Header: title + author + date + replies + Report */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    marginBottom: "0.35rem",
                  }}
                >
                  {/* LEFT SIDE */}
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: "1.05rem",
                      }}
                    >
                      {topic.title}
                    </h3>

                    <p
                      style={{
                        margin: "0.2rem 0 0",
                        fontSize: "0.8rem",
                        color: "#6c757d",
                      }}
                    >
                      Started by <strong>{topic.created_by_name || "Unknown user"}</strong>
                      {topic.created_at && (
                        <>
                          {" "}on{" "}
                          {new Date(topic.created_at).toLocaleString()}
                        </>
                      )}
                    </p>
                  </div>

                  {/* RIGHT SIDE */}
                  <div style={{ textAlign: "right", fontSize: "0.8rem" }}>
                    <div>
                      <strong>{posts.length}</strong> replies
                    </div>

                    {currentUser && currentUser.id !== topic.created_by_id && (
                      <Link
                        to="/feedback"
                        state={{
                          targetUserId: topic.created_by_id,
                          targetKind: "customer",
                          displayName: topic.created_by_name || "this user",
                          orderId: null,
                          context: "discussion",
                          topicId: topic.id,
                          topicTitle: topic.title,
                          type: "complaint",
                        }}
                        style={{
                          marginTop: "0.35rem",
                          display: "inline-block",
                          padding: "0.18rem 0.7rem",
                          borderRadius: "999px",
                          border: "1px solid #dc3545",
                          backgroundColor: "#f8d7da",
                          color: "#842029",
                          textDecoration: "none",
                          fontSize: "0.75rem",
                        }}
                      >
                        Report topic
                      </Link>
                    )}
                  </div>
                </div>

                {/* Topic body */}
                {topic.body && (
                  <div
                    style={{
                      marginTop: "0.25rem",
                      padding: "0.4rem 0.6rem",
                      borderLeft: "3px solid #e9ecef",
                      backgroundColor: "#f8f9fa",
                      fontSize: "0.9rem",
                    }}
                  >
                    {topic.body}
                  </div>
                )}

                {/* Replies */}
                {posts.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.4rem",
                      paddingTop: "0.4rem",
                      borderTop: "1px solid #f1f3f5",
                    }}
                  >
                    {posts.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          marginBottom: "0.35rem",
                          fontSize: "0.85rem",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>
                          {p.author_name || "User"}:
                        </span>{" "}
                        <span>
                          {p.content || p.body || "[no content]"}
                        </span>

                        {p.created_at && (
                          <span
                            style={{
                              marginLeft: "0.4rem",
                              fontSize: "0.75rem",
                              color: "#868e96",
                            }}
                          >
                            {new Date(p.created_at).toLocaleString()}
                          </span>
                        )}

                        {/* Complain about comment */}
                        {currentUser && currentUser.id !== p.author_id && (
                          <button
                            type="button"
                            onClick={() => handleComplaintAboutComment(topic.id, p)}
                            style={{
                              marginLeft: "0.5rem",
                              padding: "0.15rem 0.6rem",
                              borderRadius: "999px",
                              border: "1px solid #dc3545",
                              backgroundColor: "#f8d7da",
                              color: "#842029",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Complain about comment
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply box */}
                {canPost() && (
                  <div
                    style={{
                      marginTop: "0.6rem",
                      paddingTop: "0.4rem",
                      borderTop: "1px dashed #dee2e6",
                    }}
                  >
                    <textarea
                      rows={2}
                      value={replyText[topic.id] || ""}
                      onChange={(e) =>
                        setReplyText((prev) => ({
                          ...prev,
                          [topic.id]: e.target.value,
                        }))
                      }
                      style={{
                        width: "100%",
                        padding: "0.35rem 0.45rem",
                        fontSize: "0.85rem",
                      }}
                      placeholder="Write a reply..."
                    />
                    <button
                      type="button"
                      onClick={() => handleReply(topic.id)}
                      disabled={replyLoadingId === topic.id}
                      style={{
                        marginTop: "0.35rem",
                        padding: "0.3rem 0.8rem",
                        borderRadius: "999px",
                        border: "1px solid #20c997",
                        backgroundColor: "#e6fcf5",
                        color: "#087f5b",
                        cursor:
                          replyLoadingId === topic.id ? "wait" : "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      {replyLoadingId === topic.id ? "Posting..." : "Reply"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

    </div>
  );
}

export default DiscussionPage;
