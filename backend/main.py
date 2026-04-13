import os
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from typing import Optional
import anthropic

from models import (
    GraphData, Node, Edge, SimRequest, SimResult, SimStep,
    AgentDecision, ReasoningStep, Analytics, NodeContribution,
    CompareRequest, CompareResult, NodeDetailResponse,
    EventSimRequest, EventSimResult, SentimentSnapshot,
)
from graph import generate_graph
from simulation import run_simulation
from analytics import compute_analytics
from snap_loader import load_snap_graph
from twin_builder import build_all_twins
from event_seeder import select_event_seeds
from agent import get_kol_event_decision

load_dotenv()

_graph_cache: dict[str, dict] = {}
_last_graph_id: Optional[str] = None
_snap_graph_id: Optional[str] = None   # cached pre-loaded SNAP graph

_SNAP_DIR = Path(__file__).parent.parent / "data" / "snap"


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


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="SocialSim API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/graph")
def get_graph(
    source: str = "synthetic",   # "synthetic" | "snap"
    n_nodes: int = 500,
    n_kol: int = 15,
    m_edges: int = 3,
    n_communities: int = 5,
    seed: Optional[int] = None,
):
    global _last_graph_id
    graph_id = str(uuid.uuid4())

    if source == "snap":
        if _snap_graph_id and _snap_graph_id in _graph_cache:
            # Return the preloaded graph
            _last_graph_id = _snap_graph_id
            graph_data = _graph_cache[_snap_graph_id]
            return {
                "graph_id": _snap_graph_id,
                "nodes": [Node(**n) for n in graph_data["nodes"]],
                "edges": [Edge(**e) for e in graph_data["edges"]],
            }
        # Not preloaded — load on demand
        if not _SNAP_DIR.exists() or not any(_SNAP_DIR.glob("*.edges")):
            raise HTTPException(
                status_code=400,
                detail="SNAP data not found. Run scripts/download_snap.sh first.",
            )
        claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        graph_data = load_snap_graph(data_dir=_SNAP_DIR, n_kol=n_kol, max_nodes=n_nodes, claude_client=claude)
        graph_data = build_all_twins(graph_data)
    else:
        graph_data = generate_graph(n_nodes, n_kol, m_edges, n_communities, seed=seed)

    _graph_cache[graph_id] = graph_data
    _last_graph_id = graph_id
    return {
        "graph_id": graph_id,
        "nodes": [Node(**n) for n in graph_data["nodes"]],
        "edges": [Edge(**e) for e in graph_data["edges"]],
    }


@app.post("/simulate", response_model=SimResult)
def simulate(req: SimRequest):
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

    node_ids = {n["id"] for n in nodes}
    for seed in req.seed_nodes:
        if seed not in node_ids:
            raise HTTPException(status_code=400, detail=f"Node {seed} not found")

    steps_raw = run_simulation(
        nodes, edges, req.seed_nodes,
        req.brand_name, req.brand_content, req.n_steps
    )

    analytics_raw = compute_analytics(nodes, edges, steps_raw, req.seed_nodes)

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

    return SimResult(steps=steps, analytics=analytics)


@app.get("/node/{node_id}", response_model=NodeDetailResponse)
def get_node_detail(node_id: str):
    if _last_graph_id is None:
        raise HTTPException(status_code=400, detail="Call GET /graph first")

    graph = _graph_cache[_last_graph_id]
    node_map = {n["id"]: n for n in graph["nodes"]}
    if node_id not in node_map:
        raise HTTPException(status_code=404, detail="Node not found")

    from collections import defaultdict
    adjacency: dict[str, list[str]] = defaultdict(list)
    node_edges = []
    for edge in graph["edges"]:
        adjacency[edge["source"]].append(edge["target"])
        adjacency[edge["target"]].append(edge["source"])
        if edge["source"] == node_id or edge["target"] == node_id:
            node_edges.append(edge)

    neighbors_1hop = [node_map[n] for n in adjacency[node_id] if n in node_map]
    hop1_set = set(adjacency[node_id])
    neighbors_2hop_ids = set()
    for n1 in adjacency[node_id]:
        for n2 in adjacency[n1]:
            if n2 != node_id and n2 not in hop1_set:
                neighbors_2hop_ids.add(n2)
    neighbors_2hop = [node_map[n] for n in list(neighbors_2hop_ids)[:30] if n in node_map]

    return NodeDetailResponse(
        node=Node(**node_map[node_id]),
        neighbors_1hop=[Node(**n) for n in neighbors_1hop[:50]],
        neighbors_2hop=[Node(**n) for n in neighbors_2hop],
        edges=[Edge(**e) for e in node_edges],
    )


@app.post("/simulate/compare", response_model=CompareResult)
def compare_simulations(req: CompareRequest):
    if _last_graph_id is None:
        raise HTTPException(status_code=400, detail="Call GET /graph first")

    results = []
    for scenario in req.scenarios:
        result = simulate(scenario)
        results.append(result)

    return CompareResult(results=results, names=req.scenario_names)


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
