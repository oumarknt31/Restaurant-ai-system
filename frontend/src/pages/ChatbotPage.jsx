// src/pages/ChatbotPage.jsx
import AssistantChatBox from "../components/AssistantChatBox";

/**
 * Full-page AI Chatbot view.
 * Still supports onAddToCart for suggested orders.
 */
function ChatbotPage({ onAddToCart }) {
  return (
    <div style={{ padding: "1.5rem" }}>
      <AssistantChatBox onAddToCart={onAddToCart} compact={false} />
    </div>
  );
}

export default ChatbotPage;
