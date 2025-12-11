import "./App.css";

import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import DepositPage from "./pages/DepositPage.jsx";
import MyOrdersPage from "./pages/MyOrdersPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import RecommendationPage from "./pages/RecommendationPage.jsx";
import ChatbotPage from "./pages/ChatbotPage.jsx";
import DeliveryJobsPage from "./pages/DeliveryJobsPage.jsx";
import ReputationManagementPage from "./pages/ReputationManagementPage.jsx";
import ManagerPage from "./pages/ManagerPage.jsx";
import FeedbackPage from "./pages/FeedbackPage.jsx";
import DiscussionPage from "./pages/DiscussionPage.jsx";
import PerformanceDashboardPage from "./pages/PerformanceDashboardPage.jsx";


import { getCurrentUser, logoutUser } from "./auth/user";

import UserStatusBadge from "./components/UserStatusBadge.jsx";


function App() {
  const [currentUser, setCurrentUser] = useState(null);

  // Cart items: [{ dish_id, name, price, quantity, is_vip_only }]
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
  }, []);

  function handleLogout() {
    logoutUser();
    setCurrentUser(null);
    alert("Logged out.");
  }

  // Small reusable VIP pill (navbar)
  const VipPill = () => (
    <span
      style={{
        marginLeft: "0.5rem",
        padding: "0.15rem 0.6rem",
        borderRadius: "999px",
        backgroundColor: "#fff3bf",
        color: "#856404",
        fontSize: "0.75rem",
        fontWeight: 600,
        border: "1px solid #ffe066",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
      }}
    >
      <span>⭐ VIP</span>
    </span>
  );

  function addToCart(dish) {
    // 1) VIP guard: non-VIPs cannot add VIP-only dishes
    if (dish.is_vip_only && (!currentUser || currentUser.role !== "vip")) {
      alert("This dish is VIP-only. You must be a VIP customer to order it.");
      return;
    }

    const imageUrl = dish.image_url || dish.imageUrl || null;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.dish_id === dish.id);
      if (existing) {
        return prev.map((item) =>
          item.dish_id === dish.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          dish_id: dish.id,
          name: dish.name,
          price: dish.price,
          quantity: 1,
          is_vip_only: dish.is_vip_only,
          image_url: imageUrl,
        },
      ];
    });
  }

  function removeFromCart(dishId) {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.dish_id === dishId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function clearCart() {
    setCartItems([]);
  }

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="app-shell">
      {/* === Top Navbar === */}
      <header className="app-header">
        {/* Brand */}
        <div className="app-brand">
          <span className="app-brand-dot" />
          <span>Restaurant AI</span>
        </div>

        {/* Nav links */}
        <nav className="nav-links">
          <Link to="/" className="nav-link">
            Home
          </Link>
          <Link to="/menu" className="nav-link">
            Menu
          </Link>
          <Link to="/cart" className="nav-link">
            Cart ({cartCount})
          </Link>
          <Link to="/recommendation" className="nav-link">
            Recommendation
          </Link>
          <Link to="/chatbot" className="nav-link">
            AI Chatbot
          </Link>
          {currentUser &&
            ["manager", "admin", "staff"].includes(currentUser.role) && (
              <Link to="/performance" className="nav-link">
                Performance Dashboard
              </Link>
            )}
          <Link to="/my-orders" className="nav-link">
            My Orders
          </Link>
          <Link to="/deposit" className="nav-link">
            Deposit
          </Link>
          <Link to="/manager" className="nav-link">
            Manager
          </Link>
          <Link to="/delivery-jobs" className="nav-link">
            Delivery Jobs
          </Link>
          <Link
            to="/reputation-management"
            className="nav-link"
          >
            HR &amp; Reputation
          </Link>
          {/*<Link to="/feedback" className="nav-link">
            File Feedback
          </Link>*/}
          <Link to="/discussion" className="nav-link">
            Discussion
          </Link>
        </nav>

        {/* Right side: user / login / logout */}
        <div className="nav-right">
          {currentUser ? (
            <>
              <span style={{ marginRight: "0.4rem" }}>
                <UserStatusBadge user={currentUser} />
              </span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="nav-link">
                Register
              </Link>
            </>
          )}
        </div>
      </header>

      {/* === Main content area === */}
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route
              path="/menu"
              element={<MenuPage onAddToCart={addToCart} />}
            />
            <Route
              path="/cart"
              element={
                <CartPage
                  cartItems={cartItems}
                  removeFromCart={removeFromCart}
                  clearCart={clearCart}
                  addToCart={addToCart} // <-- REQUIRED
                />
              }
            />
            <Route
              path="/recommendation"
              element={<RecommendationPage onAddToCart={addToCart} />}
            />
            <Route
              path="/chatbot"
              element={<ChatbotPage onAddToCart={addToCart} />}
            />
            <Route path="/my-orders" element={<MyOrdersPage />} />
            <Route path="/deposit" element={<DepositPage />} />
            <Route
              path="/login"
              element={<LoginPage onLogin={setCurrentUser} />}
            />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/delivery-jobs" element={<DeliveryJobsPage />} />
            <Route
              path="/reputation-management"
              element={<ReputationManagementPage />}
            />
            <Route path="/manager" element={<ManagerPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/discussion" element={<DiscussionPage />} />
            <Route
              path="/performance"
              element={<PerformanceDashboardPage />}
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
