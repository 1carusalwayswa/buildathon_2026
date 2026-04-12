import os
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from typing import Optional
from models import (
    GraphData, Node, Edge, SimRequest, SimResult, SimStep,
    AgentDecision, ReasoningStep, Analytics, NodeContribution,
    CompareRequest, CompareResult, NodeDetailResponse
)
from graph import generate_graph
from simulation import run_simulation
from analytics import compute_analytics

load_dotenv()

app = FastAPI(title="SocialSim API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_graph_cache: dict[str, dict] = {}
_last_graph_id: Optional[str] = None


@app.get("/graph")
def get_graph(
    n_nodes: int = 500,
    n_kol: int = 15,
    m_edges: int = 3,
    n_communities: int = 5,
    seed: Optional[int] = None,
):
    global _last_graph_id
    graph_id = str(uuid.uuid4())
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
