from pydantic import BaseModel
from typing import Optional


class Node(BaseModel):
    id: str
    name: str
    type: str  # "kol" | "normal"
    community: str
    influence: float
    activity: float
    sentiment: float
    followers: int
    persona: Optional[str] = None  # KOL only


class Edge(BaseModel):
    source: str
    target: str
    weight: float
    type: str  # "follow" | "friend"


class GraphData(BaseModel):
    nodes: list[Node]
    edges: list[Edge]


class SimRequest(BaseModel):
    seed_nodes: list[str]
    brand_name: str
    brand_content: str
    n_steps: int = 20
    graph_id: Optional[str] = None


class ReasoningStep(BaseModel):
    step: str
    result: str
    passed: bool


class AgentDecision(BaseModel):
    node_id: str
    action: str  # "repost" | "comment" | "ignore"
    reason: str
    content: str
    reasoning_steps: list[ReasoningStep]


class SimStep(BaseModel):
    t: int
    activated: list[str]
    new_activated: list[str]
    agent_decisions: list[AgentDecision]


class NodeContribution(BaseModel):
    node_id: str
    direct_reach: int
    indirect_reach: int
    contribution_pct: float


class Analytics(BaseModel):
    coverage: float
    max_depth: int
    peak_step: int
    total_activated: int
    community_penetration: dict[str, float]
    node_contributions: list[NodeContribution]
    bottleneck_nodes: list[str]
    critical_paths: list[list[str]]


class SimResult(BaseModel):
    steps: list[SimStep]
    analytics: Analytics


class CompareRequest(BaseModel):
    scenarios: list[SimRequest]
    scenario_names: list[str]


class CompareResult(BaseModel):
    results: list[SimResult]
    names: list[str]


class NodeDetailResponse(BaseModel):
    node: Node
    neighbors_1hop: list[Node]
    neighbors_2hop: list[Node]
    edges: list[Edge]
