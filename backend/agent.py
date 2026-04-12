import json
import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are simulating a social media KOL (Key Opinion Leader) deciding whether to engage with branded content.

Analyze the content and decide: repost, comment, or ignore.

Respond ONLY with valid JSON in this exact format:
{
  "action": "repost" | "comment" | "ignore",
  "reason": "brief explanation of decision",
  "content": "simulated post content if repost/comment, empty string if ignore",
  "reasoning_steps": [
    {"step": "Content Analysis", "result": "relevance assessment", "passed": true/false},
    {"step": "Brand Evaluation", "result": "brand reputation assessment", "passed": true/false},
    {"step": "Audience Match", "result": "overlap percentage and assessment", "passed": true/false},
    {"step": "Final Decision", "result": "decision summary", "passed": true/false}
  ]
}"""


def _parse_persona(persona: str | None) -> dict:
    """
    Parse persona field. Accepts JSON string (Digital Twin) or plain string.
    Always returns a dict with at least {"raw": <original>}.
    """
    if not persona:
        return {}
    try:
        parsed = json.loads(persona)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return {"raw": persona}


def _build_user_message(
    persona_dict: dict,
    community: str,
    brand_name: str,
    brand_content: str,
    network_sentiment: float,
    activated_neighbors: int,
    total_neighbors: int,
) -> str:
    """Build the user-turn prompt from structured persona + Layer C context."""

    # Layer A: rich profile if available, plain persona otherwise
    if persona_dict.get("bio"):
        profile_lines = (
            f"- Name: {persona_dict.get('name', 'Unknown')}\n"
            f"- Bio: {persona_dict['bio']}\n"
            f"- Topics: {', '.join(persona_dict.get('topics', [community]))}\n"
            f"- Tone: {persona_dict.get('tone', 'neutral')}\n"
            f"- Brand sensitivity: {persona_dict.get('brand_sensitivity', 0.5)}"
        )
    else:
        profile_lines = (
            f"- Community: {community}\n"
            f"- Persona: {persona_dict.get('raw', 'No description')}"
        )

    # Layer B: behaviour pattern
    behavior = persona_dict.get("behavior", {})
    behavior_lines = ""
    if behavior:
        behavior_lines = (
            f"\nBehaviour pattern:\n"
            f"- Bridge role (cross-community sharer): {behavior.get('bridge_role', False)}\n"
            f"- Community loyal (prefers intra-community): {behavior.get('community_loyal', False)}\n"
            f"- Engagement bias: {behavior.get('engagement_bias', 'medium')}"
        )

    # Layer C: network context (runtime)
    network_ctx = ""
    if total_neighbors > 0:
        pct = min(100, round(activated_neighbors / total_neighbors * 100))
        network_ctx = (
            f"\nNetwork context:\n"
            f"- {activated_neighbors}/{total_neighbors} of your connections ({pct}%) "
            f"have already engaged with this content."
        )

    return (
        f"You are a KOL with this profile:\n{profile_lines}"
        f"{behavior_lines}"
        f"\nBrand Campaign:\n"
        f"- Brand: {brand_name}\n"
        f"- Content: {brand_content}\n"
        f"- Network sentiment toward this brand: {network_sentiment:.2f} (0=negative, 1=positive)"
        f"{network_ctx}\n\n"
        f"Decide whether to repost, comment, or ignore this content."
    )


def get_kol_decision(
    node_id: str,
    persona: str | None,
    community: str,
    brand_name: str,
    brand_content: str,
    network_sentiment: float,
    activated_neighbors: int = 0,
    total_neighbors: int = 0,
) -> dict:
    """Call Claude API to get KOL decision. Returns dict with action, reason, content, reasoning_steps."""
    persona_dict = _parse_persona(persona)
    user_message = _build_user_message(
        persona_dict, community, brand_name, brand_content,
        network_sentiment, activated_neighbors, total_neighbors,
    )

    response = None
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        decision = json.loads(raw)
        decision["node_id"] = node_id
        return decision
    except Exception as e:
        import traceback
        print(f"[agent] ERROR for {node_id}: {type(e).__name__}: {e}")
        traceback.print_exc()
        try:
            print(f"[agent] raw response: {repr(response.content)}")
        except Exception:
            pass
        return {
            "node_id": node_id,
            "action": "ignore",
            "reason": f"Decision unavailable: {type(e).__name__}: {str(e)}",
            "content": "",
            "reasoning_steps": [
                {"step": "Content Analysis", "result": "Unable to analyze", "passed": False},
                {"step": "Brand Evaluation", "result": "Unable to evaluate", "passed": False},
                {"step": "Audience Match", "result": "Unable to assess", "passed": False},
                {"step": "Final Decision", "result": "Defaulting to ignore", "passed": False},
            ],
        }
