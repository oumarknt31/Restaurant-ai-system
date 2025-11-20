// Simple helpers to work with the "user" stored in localStorage

export function getCurrentUser() {
    if (typeof window === "undefined") return null;
  
    const raw = localStorage.getItem("user");
    if (!raw) return null;
  
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
      return null;
    }
  }
  
  export function setCurrentUser(user) {
    if (typeof window === "undefined") return;
    localStorage.setItem("user", JSON.stringify(user));
  }
  
  export function logoutUser() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("user");
  }
  