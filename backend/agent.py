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


def get_kol_decision(
    node_id: str,
    persona: str,
    community: str,
    brand_name: str,
    brand_content: str,
    network_sentiment: float,
) -> dict:
    """Call Claude API to get KOL decision. Returns dict with action, reason, content, reasoning_steps."""
    user_message = f"""You are a KOL with this profile:
- Community: {community}
- Persona: {persona}

Brand Campaign:
- Brand: {brand_name}
- Content: {brand_content}
- Current network sentiment toward this brand: {network_sentiment:.2f} (0=negative, 1=positive)

Decide whether to repost, comment, or ignore this content."""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = response.content[0].text.strip()
        # Strip markdown code block wrapping if present
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
        # Fallback on error
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
