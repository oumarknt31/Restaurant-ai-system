import React from "react";

/**
 * Shows:
 *  - name + role
 *  - VIP chip (if role === "vip")
 *  - Warnings chip: "Warnings: X"
 */
function UserStatusBadge({ user }) {
  if (!user) return null;

  const warnings =
    typeof user.warnings === "number" ? user.warnings : 0;
  const isVip = user.role === "vip";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        fontSize: "0.8rem",
      }}
    >
      {/* Name + role */}
      <span>
       <span style={{ fontWeight: "700" }}>{user.name}</span> ({user.role})
      </span>

      {/* VIP badge (like your Menu page badge) */}
      {isVip && (
        <span
          style={{
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            backgroundColor: "#fff3bf",
            color: "#856404",
            fontSize: "0.75rem",
            fontWeight: 600,
            border: "1px solid #ffe066",
            textTransform: "uppercase",
          }}
        >
          ⭐ VIP
        </span>
      )}

      {/* Warnings badge – always shown, even if 0 */}
      <span
        style={{
          padding: "0.15rem 0.6rem",
          borderRadius: "999px",
          backgroundColor: warnings > 0 ? "#fff5f5" : "#e9ecef",
          color: warnings > 0 ? "#c92a2a" : "#495057",
          fontSize: "0.75rem",
          fontWeight: 600,
          border: warnings > 0 ? "1px solid #f03e3e" : "1px solid #ced4da",
          textTransform: "uppercase",
        }}
      >
        Warnings: {warnings}
      </span>
    </div>
  );
}

export default UserStatusBadge;
