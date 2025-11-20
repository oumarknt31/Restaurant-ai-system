from flask import Blueprint, request, jsonify
import os
import requests

from extensions import db
from models import User, Dish

assistant_bp = Blueprint("assistant", __name__, url_prefix="/api/assistant")

# Ollama config – you can override these in .env
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "phi3")  # or "mistral", "llama3", etc.


def call_ollama_llm(prompt: str) -> str:
    """
    Call a local Ollama model via its HTTP API.
    """

    url = f"{OLLAMA_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
    }

    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()

    # Ollama /api/chat returns: {"model": "...", "message": {"role": "...", "content": "..."}, ...}
    try:
        return data["message"]["content"]
    except Exception:
        return str(data)


@assistant_bp.route("/chat", methods=["POST"])
def chat_with_assistant():
    """
    LLM-based assistant using Ollama.

    Expected JSON body:
    {
      "user_id": 1,
      "message": "I want something spicy under $20"
    }
    """

    data = request.get_json() or {}

    user_id = data.get("user_id")
    user_message = (data.get("message") or "").strip()

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400
    if not user_message:
        return jsonify({"error": "message is required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_blacklisted or not user.is_active:
        return jsonify({"error": "User is not allowed to use the assistant"}), 403

    # Fetch some menu context for the model
    dishes = Dish.query.order_by(Dish.price.asc()).limit(20).all()

    menu_lines = []
    for d in dishes:
        vip_tag = " (VIP only)" if d.is_vip_only else ""
        menu_lines.append(f"- {d.name}{vip_tag}: ${d.price:.2f} — {d.description}")

    menu_text = "\n".join(menu_lines) if menu_lines else "No dishes available."

    # Build the prompt for the LLM
    prompt = f"""
You are an AI assistant for a restaurant ordering system.
You see the following menu (including VIP-only dishes):

{menu_text}

The user has the following role: {user.role}.
If the user is not 'vip', do NOT recommend VIP-only dishes.

The user says:
\"\"\"{user_message}\"\"\".

Based on the menu and their role, recommend 2-5 dishes that fit their request.
Explain your reasoning in a friendly way, and clearly mention dish names and prices
so the frontend can show them. Keep the answer concise.
"""

    try:
        llm_answer = call_ollama_llm(prompt)
    except Exception as e:
        return jsonify(
            {
                "error": "LLM call failed (Ollama). Check that Ollama is running, the URL, and the model name.",
                "details": str(e),
            }
        ), 500

    return jsonify(
        {
            "answer": llm_answer,
            "user_role": user.role,
        }
    )


@assistant_bp.route("/recommend", methods=["POST"])
def recommend_dishes():
    """
    Simple non-LLM recommendation endpoint.

    Expected JSON body:
    {
      "user_id": 1,
      "max_price": 20.0,          # optional
      "preference": "spicy fish", # optional free text
      "max_results": 5            # optional
    }
    """

    data = request.get_json() or {}

    user_id = data.get("user_id")
    max_price = data.get("max_price")
    preference = (data.get("preference") or "").lower()
    max_results = data.get("max_results", 5)

    if not user_id:
        return jsonify({"error": "user_id is required"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if user.is_blacklisted or not user.is_active:
        return jsonify({"error": "User is not allowed to place orders"}), 403

    # Base query: all dishes
    query = Dish.query

    # Filter by VIP if user is not VIP
    if user.role != "vip":
        query = query.filter_by(is_vip_only=False)

    dishes = query.all()

    # In-memory filtering / scoring
    recommendations = []

    for d in dishes:
        # Filter by budget if provided
        if max_price is not None:
            try:
                if d.price > float(max_price):
                    continue
            except ValueError:
                pass  # ignore bad number, just don't filter

        score = 0

        # Simple scoring based on preference keywords in name/description
        text = f"{d.name} {d.description or ''}".lower()

        if "spicy" in preference and "spicy" in text:
            score += 2
        if "vegan" in preference and "vegan" in text:
            score += 2
        if "fish" in preference and "fish" in text:
            score += 2
        if "meat" in preference and ("beef" in text or "chicken" in text or "meat" in text):
            score += 2
        if "rice" in preference and "rice" in text:
            score += 2

        # Slight preference for cheaper dishes
        score += max(0, 5 - int(d.price // 5))

        recommendations.append((score, d))

    # Sort by score desc, then by price asc
    recommendations.sort(key=lambda pair: (-pair[0], pair[1].price))

    # Take top N
    recommendations = recommendations[: max_results or 5]

    result_dishes = []
    for score, d in recommendations:
        result_dishes.append(
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "price": d.price,
                "is_vip_only": d.is_vip_only,
                "score": score,
            }
        )

    message_parts = []
    if max_price is not None:
        message_parts.append(f"under ${max_price}")
    if preference:
        message_parts.append(f"matching '{preference}'")

    summary = "Recommendations"
    if message_parts:
        summary += " " + " and ".join(message_parts)

    return jsonify(
        {
            "message": summary,
            "user_role": user.role,
            "recommendations": result_dishes,
        }
    )
