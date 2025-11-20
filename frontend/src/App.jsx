

import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import MenuPage from "./pages/MenuPage.jsx";
import OrderPage from "./pages/OrderPage.jsx";
import DepositPage from "./pages/DepositPage.jsx";
import MyOrdersPage from "./pages/MyOrdersPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import AssistantPage from "./pages/AssistantPage.jsx";


import { getCurrentUser, logoutUser } from "./auth/user";

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

  function addToCart(dish) {
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
    <div>
      {/* Navbar */}
      <nav
        style={{
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid #ccc",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Link to="/" style={{ marginRight: "1rem" }}>
            Home
          </Link>
          <Link to="/menu" style={{ marginRight: "1rem" }}>
            Menu
          </Link>
          <Link to="/cart" style={{ marginRight: "1rem" }}>
            Cart ({cartCount})
          </Link>
          <Link to="/assistant" style={{ marginRight: "1rem" }}>
            Assistant
          </Link>
          <Link to="/orders" style={{ marginRight: "1rem" }}>
            Orders
          </Link>
          <Link to="/my-orders" style={{ marginRight: "1rem" }}>
            My Orders
          </Link>
          <Link to="/deposit" style={{ marginRight: "1rem" }}>
            Deposit
          </Link>
          <Link to="/admin" style={{ marginRight: "1rem" }}>
            Admin
          </Link>

        </div>

        <div>
          {currentUser ? (
            <>
              <span style={{ marginRight: "0.75rem" }}>
                Logged in as <strong>{currentUser.name}</strong>{" "}
                <span style={{ fontSize: "0.85rem" }}>
                  ({currentUser.role})
                </span>
              </span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ marginRight: "1rem" }}>
                Login
              </Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>

      {/* Routes */}
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
            />
          }
        />
        <Route path="/assistant" element={<AssistantPage />} />
        <Route path="/orders" element={<OrderPage />} />
        <Route path="/my-orders" element={<MyOrdersPage />} />
        <Route path="/deposit" element={<DepositPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="/login"
          element={<LoginPage onLogin={setCurrentUser} />}
        />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>

    </div>
  );
}

export default App;
