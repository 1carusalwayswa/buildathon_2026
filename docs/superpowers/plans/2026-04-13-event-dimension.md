# Event Dimension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Event simulation mode — when a company-related event occurs, auto-select seed KOLs, run organic reaction simulation, and display sentiment evolution + community reaction breakdown.

**Architecture:** New `POST /simulate/event` endpoint uses `select_event_seeds()` for auto-seeding, routes KOL decisions through a new `get_kol_event_decision()` that returns sentiment scores, and aggregates per-step sentiment snapshots. Frontend adds a Campaign/Event tab toggle; Event mode shows `EventPanel`, `SentimentTimeline`, and `CommunityReactionPanel`.

**Tech Stack:** FastAPI + Pydantic (backend), React + TypeScript + d3 v7 (frontend), pytest (tests)

---

## File Map

**Create:**
- `backend/event_seeder.py` — `select_event_seeds(nodes, event_type, n_seeds) -> list[str]`
- `backend/tests/test_event_seeder.py`
- `frontend/src/components/EventPanel.tsx` — event input form
- `frontend/src/components/SentimentTimeline.tsx` — d3 SVG line chart
- `frontend/src/components/CommunityReactionPanel.tsx` — stacked bar chart

**Modify:**
- `backend/models.py` — add `EventType`, `EventSimRequest`, `SentimentSnapshot`, `EventSimResult`; add `sentiment_score` to `AgentDecision`
- `backend/agent.py` — add `get_kol_event_decision()`
- `backend/simulation.py` — add `decision_fn` parameter to `run_simulation()`
- `backend/main.py` — add `POST /simulate/event` route
- `frontend/src/types.ts` — add event types
- `frontend/src/api/client.ts` — add `simulateEvent()`
- `frontend/src/App.tsx` — add `simMode` state, tab toggle, event result rendering

---

## Task 1: Backend data models

**Files:**
- Modify: `backend/models.py`

- [ ] **Step 1: Add `sentiment_score` to `AgentDecision` and add new event models**

Replace the `AgentDecision` class and add new classes at the end of `backend/models.py`:

```python
# Replace AgentDecision (add sentiment_score field):
class AgentDecision(BaseModel):
    node_id: str
    action: str  # "repost" | "comment" | "ignore"
    reason: str
    content: str
    reasoning_steps: list[ReasoningStep]
    sentiment_score: Optional[float] = None  # -1.0 to 1.0, event mode only

# Add after SimResult:
from enum import Enum

class EventType(str, Enum):
    positive = "positive"
    negative = "negative"
    neutral = "neutral"

class EventSimRequest(BaseModel):
    company_name: str
    event_description: str
    event_type: EventType
    n_steps: int = 20
    graph_id: Optional[str] = None
    n_seeds: int = 3

class SentimentSnapshot(BaseModel):
    t: int
    overall: float  # -1.0 to 1.0
    by_community: dict[str, float]

class EventSimResult(BaseModel):
    steps: list[SimStep]
    analytics: Analytics
    sentiment_timeline: list[SentimentSnapshot]
    community_reactions: dict[str, dict]
    # community_reactions shape: {community_id: {repost_pct, comment_pct, ignore_pct, avg_sentiment}}
```

- [ ] **Step 2: Verify models import cleanly**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -c "from models import EventSimRequest, EventSimResult, SentimentSnapshot, EventType; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add backend/models.py && git commit -m "feat: add event models to models.py"
```

---

## Task 2: Event seeder

**Files:**
- Create: `backend/event_seeder.py`
- Create: `backend/tests/test_event_seeder.py`

- [ ] **Step 1: Write failing tests**

Create `backend/tests/test_event_seeder.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from event_seeder import select_event_seeds

def _make_nodes(specs):
    """specs: list of (id, type, community, influence, activity, sentiment)"""
    return [
        {"id": s[0], "type": s[1], "community": s[2],
         "influence": s[3], "activity": s[4], "sentiment": s[5],
         "name": s[0], "followers": 100}
        for s in specs
    ]


def test_returns_kols_only():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("normal1", "normal", "A", 0.9, 0.9, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=2)
    assert "normal1" not in seeds
    assert "kol1" in seeds


def test_respects_n_seeds():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("kol2", "kol", "B", 0.8, 0.8, 0.5),
        ("kol3", "kol", "C", 0.7, 0.7, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=2)
    assert len(seeds) == 2


def test_community_spread():
    # With 3 KOLs in same community and 1 in different, n_seeds=2 should pick
    # at most 1 from community A
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("kol2", "kol", "A", 0.85, 0.85, 0.5),
        ("kol3", "kol", "A", 0.8, 0.8, 0.5),
        ("kol4", "kol", "B", 0.7, 0.7, 0.5),
    ])
    seeds = select_event_seeds(nodes, "neutral", n_seeds=2)
    assert len(seeds) == 2
    communities = [n["community"] for n in nodes if n["id"] in seeds]
    assert len(set(communities)) == 2  # must span 2 communities


def test_negative_event_downweights_optimists():
    # kol1 has high sentiment (optimist), kol2 has low sentiment
    # For negative events, kol2 should be preferred
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.95, 0.95, 0.95),  # very optimistic
        ("kol2", "kol", "B", 0.90, 0.90, 0.20),  # pessimistic
    ])
    seeds = select_event_seeds(nodes, "negative", n_seeds=1)
    assert seeds == ["kol2"]


def test_n_seeds_exceeds_kols_returns_all():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=5)
    assert seeds == ["kol1"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -m pytest tests/test_event_seeder.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'event_seeder'`

- [ ] **Step 3: Implement `event_seeder.py`**

Create `backend/event_seeder.py`:

```python
def select_event_seeds(nodes: list[dict], event_type: str, n_seeds: int = 3) -> list[str]:
    """
    Auto-select KOL seed nodes for event simulation.

    Rules:
    - Only KOL nodes are eligible
    - Ranked by influence * activity (descending)
    - At most 1 seed per community (for spread diversity)
    - For 'negative' events: downweight KOLs with sentiment > 0.8
    - If n_seeds exceeds available KOLs, return all KOLs
    """
    kols = [n for n in nodes if n["type"] == "kol"]
    if not kols:
        return []

    def score(node: dict) -> float:
        base = node["influence"] * node["activity"]
        if event_type == "negative" and node["sentiment"] > 0.8:
            base *= 0.3
        return base

    kols_sorted = sorted(kols, key=score, reverse=True)

    selected = []
    seen_communities: set[str] = set()

    for kol in kols_sorted:
        if len(selected) >= n_seeds:
            break
        community = kol["community"]
        if community not in seen_communities:
            selected.append(kol["id"])
            seen_communities.add(community)

    # If we still need more seeds (fewer communities than n_seeds),
    # fill from remaining KOLs not yet selected
    if len(selected) < min(n_seeds, len(kols)):
        remaining = [k for k in kols_sorted if k["id"] not in selected]
        for kol in remaining:
            if len(selected) >= n_seeds:
                break
            selected.append(kol["id"])

    return selected
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -m pytest tests/test_event_seeder.py -v
```

Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add backend/event_seeder.py backend/tests/test_event_seeder.py && git commit -m "feat: add event_seeder with auto KOL selection"
```

---

## Task 3: KOL event decision (agent.py)

**Files:**
- Modify: `backend/agent.py`

- [ ] **Step 1: Add event system prompt constant and `get_kol_event_decision()`**

Add the following to `backend/agent.py` after the existing `SYSTEM_PROMPT` constant:

```python
EVENT_SYSTEM_PROMPT = """You are simulating a social media KOL (Key Opinion Leader) who has just heard about a company-related event.

Decide whether to publicly discuss it: repost (share as a new post), comment (reply/quote with commentary), or ignore.

Respond ONLY with valid JSON in this exact format:
{
  "action": "repost" | "comment" | "ignore",
  "reason": "brief explanation of decision",
  "content": "simulated post content if repost/comment, empty string if ignore",
  "sentiment_score": <float from -1.0 (very negative) to 1.0 (very positive)>,
  "reasoning_steps": [
    {"step": "Event Assessment", "result": "relevance and impact of event to this KOL", "passed": true/false},
    {"step": "Brand Stance", "result": "KOL's existing relationship with this company", "passed": true/false},
    {"step": "Audience Fit", "result": "whether KOL's audience cares about this event", "passed": true/false},
    {"step": "Final Decision", "result": "decision summary", "passed": true/false}
  ]
}"""
```

Then add this function after `get_kol_decision()`:

```python
def get_kol_event_decision(
    node_id: str,
    persona: str | None,
    community: str,
    company_name: str,
    event_description: str,
    event_type: str,
    network_sentiment: float,
    activated_neighbors: int = 0,
    total_neighbors: int = 0,
) -> dict:
    """Call Claude API to get KOL reaction to a company event."""
    persona_dict = _parse_persona(persona)

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

    behavior = persona_dict.get("behavior", {})
    behavior_lines = ""
    if behavior:
        behavior_lines = (
            f"\nBehaviour pattern:\n"
            f"- Bridge role: {behavior.get('bridge_role', False)}\n"
            f"- Community loyal: {behavior.get('community_loyal', False)}\n"
            f"- Engagement bias: {behavior.get('engagement_bias', 'medium')}"
        )

    network_ctx = ""
    if total_neighbors > 0:
        pct = min(100, round(activated_neighbors / total_neighbors * 100))
        network_ctx = (
            f"\nNetwork context:\n"
            f"- {activated_neighbors}/{total_neighbors} of your connections ({pct}%) "
            f"are already discussing this event."
        )

    event_tone = {"positive": "positive/celebratory", "negative": "negative/crisis", "neutral": "neutral/informational"}
    user_message = (
        f"You are a KOL with this profile:\n{profile_lines}"
        f"{behavior_lines}"
        f"\nCompany Event:\n"
        f"- Company: {company_name}\n"
        f"- Event type: {event_tone.get(event_type, 'neutral')}\n"
        f"- Event: {event_description}\n"
        f"- Overall network sentiment toward this event: {network_sentiment:.2f} (0=negative, 1=positive)"
        f"{network_ctx}\n\n"
        f"Decide whether to repost, comment, or ignore. Include your sentiment_score."
    )

    response = None
    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=EVENT_SYSTEM_PROMPT,
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
        if "sentiment_score" not in decision:
            decision["sentiment_score"] = 0.0
        decision["sentiment_score"] = max(-1.0, min(1.0, float(decision["sentiment_score"])))
        return decision
    except Exception as e:
        import traceback
        print(f"[agent/event] ERROR for {node_id}: {type(e).__name__}: {e}")
        traceback.print_exc()
        return {
            "node_id": node_id,
            "action": "ignore",
            "reason": f"Decision unavailable: {type(e).__name__}: {str(e)}",
            "content": "",
            "sentiment_score": 0.0,
            "reasoning_steps": [
                {"step": "Event Assessment", "result": "Unable to analyze", "passed": False},
                {"step": "Brand Stance", "result": "Unable to evaluate", "passed": False},
                {"step": "Audience Fit", "result": "Unable to assess", "passed": False},
                {"step": "Final Decision", "result": "Defaulting to ignore", "passed": False},
            ],
        }
```

- [ ] **Step 2: Verify agent imports cleanly**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -c "from agent import get_kol_event_decision; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add backend/agent.py && git commit -m "feat: add get_kol_event_decision to agent.py"
```

---

## Task 4: Simulation event mode

**Files:**
- Modify: `backend/simulation.py`

- [ ] **Step 1: Add `decision_fn` parameter to `run_simulation()`**

Replace the signature and the KOL decision block in `backend/simulation.py`:

```python
import random
import concurrent.futures
from typing import Callable, Optional
from agent import get_kol_decision


def run_simulation(
    nodes: list[dict],
    edges: list[dict],
    seed_nodes: list[str],
    brand_name: str,
    brand_content: str,
    max_steps: int = 20,
    decision_fn: Optional[Callable] = None,
    decision_fn_kwargs: Optional[dict] = None,
) -> list[dict]:
    """Run IC model simulation. Returns list of SimStep dicts.

    decision_fn: callable with signature (node_id, persona, community, brand_name, brand_content,
                 network_sentiment, activated_neighbors, total_neighbors) -> dict
                 Defaults to get_kol_decision.
    decision_fn_kwargs: extra keyword arguments passed to decision_fn (e.g. event_type).
    """
    if decision_fn is None:
        decision_fn = get_kol_decision
    if decision_fn_kwargs is None:
        decision_fn_kwargs = {}

    # Build adjacency: node_id -> list of (neighbor_id, weight)
    adjacency: dict[str, list[tuple[str, float]]] = {n["id"]: [] for n in nodes}
    for edge in edges:
        adjacency[edge["source"]].append((edge["target"], edge["weight"]))
        adjacency[edge["target"]].append((edge["source"], edge["weight"]))

    node_map = {n["id"]: n for n in nodes}

    activated = set(seed_nodes)
    tried: set[tuple[str, str]] = set()
    agent_decision_map: dict[str, dict] = {}

    steps = []

    steps.append({
        "t": 0,
        "activated": list(activated),
        "new_activated": list(seed_nodes),
        "agent_decisions": [],
    })

    for t in range(1, max_steps + 1):
        new_activated = []
        agent_decisions = []

        prev_new = steps[-1]["new_activated"]

        kols_to_decide = [
            activator_id for activator_id in prev_new
            if node_map[activator_id]["type"] == "kol" and activator_id not in agent_decision_map
        ]

        if kols_to_decide:
            avg_sentiment = sum(node_map[n]["sentiment"] for n in activated) / len(activated)

            def call_kol(activator_id: str) -> dict:
                activator = node_map[activator_id]
                nb_ids = [nb for nb, _ in adjacency[activator_id]]
                activated_nb = sum(1 for nb in nb_ids if nb in activated)
                return decision_fn(
                    activator_id,
                    activator.get("persona", ""),
                    activator["community"],
                    brand_name,
                    brand_content,
                    avg_sentiment,
                    activated_neighbors=activated_nb,
                    total_neighbors=len(nb_ids),
                    **decision_fn_kwargs,
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=len(kols_to_decide)) as executor:
                futures = {executor.submit(call_kol, aid): aid for aid in kols_to_decide}
                for future in concurrent.futures.as_completed(futures):
                    decision = future.result()
                    agent_decision_map[decision["node_id"]] = decision

        decisions_added: set[str] = set()
        for activator_id in prev_new:
            activator = node_map[activator_id]

            if activator["type"] == "kol" and activator_id in agent_decision_map:
                decision = agent_decision_map[activator_id]
                if activator_id not in decisions_added:
                    agent_decisions.append(decision)
                    decisions_added.add(activator_id)

                if decision["action"] == "repost":
                    spread_mult = 0.9
                elif decision["action"] == "comment":
                    spread_mult = 0.4
                else:
                    continue

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        if random.random() < weight * spread_mult:
                            activated.add(neighbor_id)
                            new_activated.append(neighbor_id)

            elif activator["type"] == "normal":
                inf = activator["influence"]
                act = activator["activity"]
                sent = activator["sentiment"]

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        p = weight * inf * act * sent
                        if random.random() < p:
                            activated.add(neighbor_id)
                            new_activated.append(neighbor_id)

        steps.append({
            "t": t,
            "activated": list(activated),
            "new_activated": new_activated,
            "agent_decisions": agent_decisions,
        })

        if not new_activated:
            break

    return steps
```

- [ ] **Step 2: Verify simulation imports cleanly**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -c "from simulation import run_simulation; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add backend/simulation.py && git commit -m "feat: add decision_fn parameter to run_simulation"
```

---

## Task 5: Event simulation route

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add imports and helper, then add the route**

Add to the imports at the top of `backend/main.py`:

```python
from models import (
    GraphData, Node, Edge, SimRequest, SimResult, SimStep,
    AgentDecision, ReasoningStep, Analytics, NodeContribution,
    CompareRequest, CompareResult, NodeDetailResponse,
    EventSimRequest, EventSimResult, SentimentSnapshot,  # add these
)
from event_seeder import select_event_seeds  # add this
from agent import get_kol_event_decision    # add this
```

Add a helper function before the route definitions (after `_SNAP_DIR`):

```python
def _aggregate_sentiment(steps_raw: list[dict], node_map: dict) -> tuple[list[dict], dict]:
    """
    Compute sentiment_timeline and community_reactions from simulation steps.

    Returns:
        timeline: list of SentimentSnapshot dicts
        community_reactions: dict of {community: {repost_pct, comment_pct, ignore_pct, avg_sentiment}}
    """
    timeline = []
    # community -> list of (action, sentiment_score)
    community_data: dict[str, list[tuple[str, float]]] = {}

    for step in steps_raw:
        decisions = step["agent_decisions"]
        if not decisions:
            continue

        scores = []
        by_community: dict[str, list[float]] = {}

        for d in decisions:
            score = d.get("sentiment_score", 0.0) or 0.0
            community = node_map.get(d["node_id"], {}).get("community", "unknown")
            scores.append(score)
            by_community.setdefault(community, []).append(score)
            community_data.setdefault(community, []).append((d["action"], score))

        overall = sum(scores) / len(scores) if scores else 0.0
        snapshot = {
            "t": step["t"],
            "overall": round(overall, 3),
            "by_community": {c: round(sum(v) / len(v), 3) for c, v in by_community.items()},
        }
        timeline.append(snapshot)

    # Build community_reactions
    community_reactions = {}
    for community, entries in community_data.items():
        total = len(entries)
        repost_cnt = sum(1 for a, _ in entries if a == "repost")
        comment_cnt = sum(1 for a, _ in entries if a == "comment")
        ignore_cnt = sum(1 for a, _ in entries if a == "ignore")
        avg_sent = sum(s for _, s in entries) / total if total else 0.0
        community_reactions[community] = {
            "repost_pct": round(repost_cnt / total, 3),
            "comment_pct": round(comment_cnt / total, 3),
            "ignore_pct": round(ignore_cnt / total, 3),
            "avg_sentiment": round(avg_sent, 3),
        }

    return timeline, community_reactions
```

Add the new route at the end of `backend/main.py`:

```python
@app.post("/simulate/event", response_model=EventSimResult)
def simulate_event(req: EventSimRequest):
    if req.graph_id is not None:
        if req.graph_id not in _graph_cache:
            raise HTTPException(status_code=400, detail=f"graph_id '{req.graph_id}' not found")
        graph = _graph_cache[req.graph_id]
    elif _last_graph_id is not None:
        graph = _graph_cache[_last_graph_id]
    else:
        raise HTTPException(status_code=400, detail="Call GET /graph first")

    nodes = graph["nodes"]
    edges = graph["edges"]
    node_map = {n["id"]: n for n in nodes}

    seed_ids = select_event_seeds(nodes, req.event_type.value, req.n_seeds)
    if not seed_ids:
        raise HTTPException(status_code=400, detail="No KOL nodes available for event seeding")

    def event_decision_fn(
        node_id, persona, community, company_name, event_description,
        network_sentiment, activated_neighbors=0, total_neighbors=0,
        event_type="neutral",
    ):
        return get_kol_event_decision(
            node_id, persona, community, company_name, event_description,
            event_type, network_sentiment, activated_neighbors, total_neighbors,
        )

    steps_raw = run_simulation(
        nodes, edges, seed_ids,
        req.company_name, req.event_description, req.n_steps,
        decision_fn=event_decision_fn,
        decision_fn_kwargs={"event_type": req.event_type.value},
    )

    analytics_raw = compute_analytics(nodes, edges, steps_raw, seed_ids)
    sentiment_timeline, community_reactions = _aggregate_sentiment(steps_raw, node_map)

    steps = []
    for s in steps_raw:
        decisions = []
        for d in s["agent_decisions"]:
            decisions.append(AgentDecision(
                node_id=d["node_id"],
                action=d["action"],
                reason=d["reason"],
                content=d["content"],
                reasoning_steps=[
                    ReasoningStep(step=r["step"], result=r["result"], passed=r["passed"])
                    for r in d["reasoning_steps"]
                ],
                sentiment_score=d.get("sentiment_score"),
            ))
        steps.append(SimStep(
            t=s["t"],
            activated=s["activated"],
            new_activated=s["new_activated"],
            agent_decisions=decisions,
        ))

    analytics = Analytics(
        coverage=analytics_raw["coverage"],
        max_depth=analytics_raw["max_depth"],
        peak_step=analytics_raw["peak_step"],
        total_activated=analytics_raw["total_activated"],
        community_penetration=analytics_raw["community_penetration"],
        node_contributions=[NodeContribution(**nc) for nc in analytics_raw["node_contributions"]],
        bottleneck_nodes=analytics_raw["bottleneck_nodes"],
        critical_paths=analytics_raw["critical_paths"],
    )

    return EventSimResult(
        steps=steps,
        analytics=analytics,
        sentiment_timeline=[SentimentSnapshot(**s) for s in sentiment_timeline],
        community_reactions=community_reactions,
    )
```

- [ ] **Step 2: Verify server starts without errors**

```bash
cd /Users/lyon/buildathon_2026/backend && python3 -c "import main; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add backend/main.py && git commit -m "feat: add POST /simulate/event route"
```

---

## Task 6: Frontend types

**Files:**
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Add event types**

Append to the end of `frontend/src/types.ts`:

```typescript
export type EventType = 'positive' | 'negative' | 'neutral';

export interface EventSimRequest {
  company_name: string;
  event_description: string;
  event_type: EventType;
  n_steps?: number;
  n_seeds?: number;
}

export interface SentimentSnapshot {
  t: number;
  overall: number;
  by_community: Record<string, number>;
}

export interface CommunityReaction {
  repost_pct: number;
  comment_pct: number;
  ignore_pct: number;
  avg_sentiment: number;
}

export interface EventSimResult {
  steps: SimStep[];
  analytics: Analytics;
  sentiment_timeline: SentimentSnapshot[];
  community_reactions: Record<string, CommunityReaction>;
}
```

Also update `AgentDecision` to add the optional `sentiment_score`:

```typescript
export interface AgentDecision {
  node_id: string;
  action: 'repost' | 'comment' | 'ignore';
  reason: string;
  content: string;
  reasoning_steps: ReasoningStep[];
  sentiment_score?: number;  // -1.0 to 1.0, event mode only
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors (or only pre-existing errors unrelated to types.ts)

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/types.ts && git commit -m "feat: add event types to types.ts"
```

---

## Task 7: Frontend API client

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add `simulateEvent()` function**

Add to `frontend/src/api/client.ts`, after the existing imports:

```typescript
import type { GraphData, SimRequest, SimResult, CompareResult, EventSimRequest, EventSimResult } from '../types';
```

Add the function at the end of the file:

```typescript
export async function simulateEvent(req: EventSimRequest, signal?: AbortSignal): Promise<EventSimResult> {
  const res = await fetchWithTimeout(`${BASE}/simulate/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    timeoutMs: 90000,
    signal,
  });
  if (!res.ok) throw new Error(`/simulate/event failed: ${res.statusText}`);
  return res.json() as Promise<EventSimResult>;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/api/client.ts && git commit -m "feat: add simulateEvent API client function"
```

---

## Task 8: EventPanel component

**Files:**
- Create: `frontend/src/components/EventPanel.tsx`

- [ ] **Step 1: Create the event input form**

Create `frontend/src/components/EventPanel.tsx`:

```tsx
import { useState } from 'react';
import type { EventSimRequest, EventType } from '../types';

interface Props {
  onRunSimulation: (req: EventSimRequest) => void;
  isLoading: boolean;
}

const DEMO: EventSimRequest = {
  company_name: 'TechCorp',
  event_description: 'TechCorp announces unexpected CEO resignation amid internal restructuring. No official statement on successor yet.',
  event_type: 'negative',
};

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; border: string }> = {
  positive: { label: 'Positive', color: 'text-green-400', border: 'border-green-400/60' },
  negative: { label: 'Negative', color: 'text-risk', border: 'border-risk/60' },
  neutral:  { label: 'Neutral',  color: 'text-dim',  border: 'border-edge-hi' },
};

export function EventPanel({ onRunSimulation, isLoading }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventType, setEventType] = useState<EventType>('neutral');

  const handleRun = () => {
    if (!companyName || !eventDescription) return;
    onRunSimulation({ company_name: companyName, event_description: eventDescription, event_type: eventType, n_steps: 20 });
  };

  const inputClass = "w-full bg-card text-fore rounded px-3 py-2 text-sm border border-edge focus:border-sig/60 focus:outline-none transition-colors placeholder:text-ghost";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button
          onClick={() => { setCompanyName(DEMO.company_name); setEventDescription(DEMO.event_description); setEventType(DEMO.event_type); }}
          className="text-[10px] font-mono px-2 py-0.5 rounded border border-edge text-ghost hover:text-sig hover:border-sig/50 transition-colors"
        >
          Demo
        </button>
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Company Name</label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. TechCorp"
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Event Description</label>
        <textarea
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          placeholder="Describe the event that occurred..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Event Type</label>
        <div className="flex gap-2">
          {(Object.keys(EVENT_TYPE_CONFIG) as EventType[]).map((type) => {
            const cfg = EVENT_TYPE_CONFIG[type];
            const active = eventType === type;
            return (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={`flex-1 py-1.5 text-xs font-bold tracking-wide rounded border transition-colors ${
                  active
                    ? `${cfg.color} ${cfg.border} bg-white/5`
                    : 'text-ghost border-edge hover:border-edge-hi'
                }`}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={!companyName || !eventDescription || isLoading}
        className="btn-neon w-full py-2 text-xs font-bold tracking-widest"
      >
        {isLoading ? 'SIMULATING...' : 'RUN EVENT SIMULATION'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/EventPanel.tsx && git commit -m "feat: add EventPanel input component"
```

---

## Task 9: SentimentTimeline component

**Files:**
- Create: `frontend/src/components/SentimentTimeline.tsx`

- [ ] **Step 1: Create the line chart component**

Create `frontend/src/components/SentimentTimeline.tsx`:

```tsx
import { useMemo } from 'react';
import type { SentimentSnapshot } from '../types';

interface Props {
  timeline: SentimentSnapshot[];
}

const COMMUNITY_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function SentimentTimeline({ timeline }: Props) {
  const W = 280, H = 140, PAD = { top: 12, right: 8, bottom: 24, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const communities = useMemo(() => {
    const set = new Set<string>();
    timeline.forEach(s => Object.keys(s.by_community).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [timeline]);

  const tMax = timeline.length > 0 ? Math.max(...timeline.map(s => s.t)) : 1;

  const xScale = (t: number) => (t / tMax) * innerW;
  const yScale = (v: number) => ((1 - v) / 2) * innerH; // -1..1 → innerH..0

  const makePath = (values: number[], ts: number[]) => {
    if (values.length === 0) return '';
    return values.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(ts[i]).toFixed(1)} ${yScale(v).toFixed(1)}`
    ).join(' ');
  };

  const overallTs = timeline.map(s => s.t);
  const overallVs = timeline.map(s => s.overall);

  const communityPaths = communities.map((c, ci) => {
    const pts = timeline.filter(s => c in s.by_community);
    return {
      community: c,
      color: COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length],
      path: makePath(pts.map(s => s.by_community[c]), pts.map(s => s.t)),
    };
  });

  // Y-axis ticks: -1, 0, +1
  const yTicks = [-1, 0, 1];

  if (timeline.length === 0) {
    return <div className="text-ghost text-xs font-mono text-center py-4">No sentiment data</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <svg width={W} height={H} className="overflow-visible">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={0} y1={yScale(tick)} x2={innerW} y2={yScale(tick)}
                stroke={tick === 0 ? '#4b5563' : '#1f2937'}
                strokeWidth={tick === 0 ? 1 : 0.5}
                strokeDasharray={tick === 0 ? '' : '3,3'}
              />
              <text x={-4} y={yScale(tick)} textAnchor="end" dominantBaseline="middle"
                className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          ))}

          {/* Community lines (thin) */}
          {communityPaths.map(({ community, color, path }) => (
            path && <path key={community} d={path} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.6} />
          ))}

          {/* Overall line (bold) */}
          <path
            d={makePath(overallVs, overallTs)}
            fill="none" stroke="#a78bfa" strokeWidth={2}
          />

          {/* X-axis */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#374151" strokeWidth={0.5} />
          <text x={0} y={innerH + 10} textAnchor="start"
            className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>t=0</text>
          <text x={innerW} y={innerH + 10} textAnchor="end"
            className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>t={tMax}</text>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-violet-400" />
          <span className="text-[9px] font-mono text-dim">Overall</span>
        </div>
        {communityPaths.map(({ community, color }) => (
          <div key={community} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-[9px] font-mono text-ghost">{community}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/SentimentTimeline.tsx && git commit -m "feat: add SentimentTimeline SVG chart component"
```

---

## Task 10: CommunityReactionPanel component

**Files:**
- Create: `frontend/src/components/CommunityReactionPanel.tsx`

- [ ] **Step 1: Create the stacked bar chart**

Create `frontend/src/components/CommunityReactionPanel.tsx`:

```tsx
import type { CommunityReaction } from '../types';

interface Props {
  communityReactions: Record<string, CommunityReaction>;
}

export function CommunityReactionPanel({ communityReactions }: Props) {
  const entries = Object.entries(communityReactions).sort((a, b) =>
    Math.abs(b[1].avg_sentiment) - Math.abs(a[1].avg_sentiment)
  );

  if (entries.length === 0) {
    return <div className="text-ghost text-xs font-mono text-center py-4">No reaction data</div>;
  }

  const sentimentColor = (v: number) => {
    if (v > 0.2) return 'text-green-400';
    if (v < -0.2) return 'text-risk';
    return 'text-dim';
  };

  return (
    <div className="flex flex-col gap-2">
      {entries.map(([community, reaction]) => (
        <div key={community} className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-mid truncate max-w-[120px]">{community}</span>
            <span className={`text-[10px] font-mono font-bold ${sentimentColor(reaction.avg_sentiment)}`}>
              {reaction.avg_sentiment > 0 ? '+' : ''}{reaction.avg_sentiment.toFixed(2)}
            </span>
          </div>

          {/* Stacked bar */}
          <div className="flex h-4 rounded overflow-hidden">
            {reaction.repost_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.repost_pct * 100}%`, backgroundColor: '#7c3aed' }}
                title={`Repost: ${(reaction.repost_pct * 100).toFixed(0)}%`}
              >
                {reaction.repost_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-white">
                    {(reaction.repost_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
            {reaction.comment_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.comment_pct * 100}%`, backgroundColor: '#0ea5e9' }}
                title={`Comment: ${(reaction.comment_pct * 100).toFixed(0)}%`}
              >
                {reaction.comment_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-white">
                    {(reaction.comment_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
            {reaction.ignore_pct > 0 && (
              <div
                className="flex items-center justify-center"
                style={{ width: `${reaction.ignore_pct * 100}%`, backgroundColor: '#374151' }}
                title={`Ignore: ${(reaction.ignore_pct * 100).toFixed(0)}%`}
              >
                {reaction.ignore_pct > 0.15 && (
                  <span className="text-[8px] font-mono text-ghost">
                    {(reaction.ignore_pct * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-3 pt-1">
        {[
          { color: '#7c3aed', label: 'Repost' },
          { color: '#0ea5e9', label: 'Comment' },
          { color: '#374151', label: 'Ignore' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono text-ghost">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/CommunityReactionPanel.tsx && git commit -m "feat: add CommunityReactionPanel stacked bar chart"
```

---

## Task 11: App.tsx integration

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add simMode state and event result state**

In `frontend/src/App.tsx`, add to the imports:

```typescript
import { EventPanel } from './components/EventPanel';
import { SentimentTimeline } from './components/SentimentTimeline';
import { CommunityReactionPanel } from './components/CommunityReactionPanel';
import { simulateEvent } from './api/client';
import type { EventSimResult, EventSimRequest } from './types';
```

Add new state variables after the existing `useState` declarations:

```typescript
const [simMode, setSimMode] = useState<'campaign' | 'event'>('campaign');
const [eventResult, setEventResult] = useState<EventSimResult | null>(null);
const [isEventSimulating, setIsEventSimulating] = useState(false);
```

- [ ] **Step 2: Add `handleRunEventSimulation` handler**

Add after `handleRunSimulation`:

```typescript
const handleRunEventSimulation = useCallback(async (req: EventSimRequest) => {
  setIsEventSimulating(true);
  setError(null);
  try {
    const result = await simulateEvent(req);
    setEventResult(result);
    setSimResult(result as any); // share step state with GraphView for activation highlights
    resetSimulation();
  } catch (e: any) {
    setError(e.message);
  } finally {
    setIsEventSimulating(false);
  }
}, [resetSimulation]);
```

- [ ] **Step 3: Add mode toggle in the right panel and swap setup section**

In the JSX, replace the section header `"CAMPAIGN SETUP"` block with the following (the entire `<div className="border-b border-edge">` that wraps the setup section):

```tsx
{/* Section: Simulation Setup */}
<div className="border-b border-edge">
  <button
    onClick={() => toggleSection('setup')}
    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
  >
    <div className="flex items-center gap-2">
      <span className="text-sig text-[10px]">▶</span>
      <span className="text-fore text-xs font-bold tracking-widest">
        {simMode === 'campaign' ? 'CAMPAIGN SETUP' : 'EVENT SETUP'}
      </span>
    </div>
    <span className="text-ghost text-xs transition-transform duration-200" style={{ transform: expanded.setup ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
  </button>
  {expanded.setup && (
    <div className="px-3 pb-3">
      {/* Mode toggle */}
      <div className="flex gap-1 mb-3">
        {(['campaign', 'event'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSimMode(mode)}
            className={`flex-1 py-1 text-[10px] font-bold tracking-widest uppercase rounded border transition-colors ${
              simMode === mode
                ? 'text-sig border-sig/60 bg-sig/10'
                : 'text-ghost border-edge hover:border-edge-hi'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {simMode === 'campaign' ? (
        <InvestPanel
          graphData={graphData}
          selectedSeeds={selectedSeeds}
          onSeedsChange={setSelectedSeeds}
          onRunSimulation={handleRunSimulation}
          isLoading={isSimulating}
          lastResult={simResult}
          onCompare={handleCompare}
        />
      ) : (
        <EventPanel
          onRunSimulation={handleRunEventSimulation}
          isLoading={isEventSimulating}
        />
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Add Event Analytics sections**

After the existing ROI RANKING section (the last `<div className="border-b border-edge">` block in the `layer === 'global'` branch), add:

```tsx
{/* Section: Sentiment Timeline (event mode only) */}
{simMode === 'event' && eventResult && (
  <div className="border-b border-edge">
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className="text-sig text-[10px]">▶</span>
      <span className="text-fore text-xs font-bold tracking-widest">SENTIMENT TIMELINE</span>
    </div>
    <div className="px-3 pb-3">
      <SentimentTimeline timeline={eventResult.sentiment_timeline} />
    </div>
  </div>
)}

{/* Section: Community Reactions (event mode only) */}
{simMode === 'event' && eventResult && (
  <div className="border-b border-edge">
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className="text-sig text-[10px]">▶</span>
      <span className="text-fore text-xs font-bold tracking-widest">COMMUNITY REACTIONS</span>
    </div>
    <div className="px-3 pb-3">
      <CommunityReactionPanel communityReactions={eventResult.community_reactions} />
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors

- [ ] **Step 6: Start dev server and verify UI loads**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run dev &
sleep 3 && curl -s http://localhost:5173 | head -5
```

Expected: HTML response with no server error

- [ ] **Step 7: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/App.tsx && git commit -m "feat: integrate event simulation mode into App.tsx"
```

---

## Self-Review

**Spec coverage check:**
- ✅ EventType enum (positive/negative/neutral) → Task 1
- ✅ EventSimRequest model → Task 1
- ✅ SentimentSnapshot + EventSimResult → Task 1
- ✅ Auto-seed selection with community spread + negative event downweighting → Task 2
- ✅ `get_kol_event_decision()` with sentiment_score in JSON → Task 3
- ✅ `run_simulation()` accepts pluggable decision_fn → Task 4
- ✅ `POST /simulate/event` route with sentiment aggregation → Task 5
- ✅ Frontend types → Task 6
- ✅ `simulateEvent()` API client → Task 7
- ✅ EventPanel input form → Task 8
- ✅ SentimentTimeline line chart → Task 9
- ✅ CommunityReactionPanel stacked bar → Task 10
- ✅ Campaign/Event tab toggle, result rendering → Task 11
- ✅ Error if no KOL nodes → Task 5 (HTTPException)
- ✅ n_seeds exceeds KOLs → Task 2 (returns all available)
- ✅ Claude fails to return sentiment_score → Task 3 (defaults to 0.0)

**Type consistency check:**
- `CommunityReaction` interface defined in Task 6, used in Task 10 props — consistent
- `EventSimResult.community_reactions` is `Record<string, CommunityReaction>` — matches backend `dict[str, dict]` via JSON
- `SentimentSnapshot` fields (`t`, `overall`, `by_community`) — match between Task 1 (backend) and Task 6 (frontend)
- `get_kol_event_decision()` signature in Task 3 matches the wrapper lambda in Task 5
- `decision_fn` in Task 4 receives `**decision_fn_kwargs` which passes `event_type` — matches Task 5 usage

**Placeholder scan:** No TBD, no TODO, no "add appropriate handling" — all steps have actual code.
