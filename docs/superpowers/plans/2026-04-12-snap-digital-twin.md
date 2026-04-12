# SNAP Twitter + Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace SocialSim's synthetic BA graph with SNAP Twitter ego-nets and build three-layer Digital Twin personas for KOL nodes.

**Architecture:** A new `snap_loader.py` parses SNAP `.edges` files, BFS-samples to 500 nodes, runs Louvain community detection with Claude-generated labels, and identifies KOLs via PageRank. A new `twin_builder.py` calls Claude to generate A+B layer static personas and infers behaviour patterns from topology. `agent.py` parses the new JSON persona and injects Layer C (activated-neighbor context) at runtime. `main.py` gains a `source=snap` query param and startup preload.

**Tech Stack:** Python 3.12, NetworkX 3.4, python-louvain 0.16, Anthropic claude-haiku-4-5-20251001, pytest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/snap_loader.py` | SNAP parsing, BFS sampling, Louvain, Claude community labels, PageRank KOL |
| Create | `backend/twin_builder.py` | Digital Twin Layer A (Claude persona) + Layer B (topology behaviour) |
| Create | `backend/tests/test_snap_loader.py` | Unit tests for BFS sampling and output schema |
| Create | `backend/tests/test_twin_builder.py` | Unit tests for Layer B computation |
| Create | `scripts/download_snap.sh` | One-shot SNAP data download |
| Modify | `backend/requirements.txt` | Add python-louvain==0.16, pytest |
| Modify | `backend/.gitignore` (root `.gitignore`) | Exclude `data/snap/` |
| Modify | `backend/agent.py` | JSON persona parsing + Layer C context injection |
| Modify | `backend/simulation.py` | Pass activated-neighbor counts to `get_kol_decision` |
| Modify | `backend/main.py` | Add `source` param, startup preload via `lifespan` |

---

## Task 1: Setup — requirements, gitignore, download script

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `.gitignore`
- Create: `scripts/download_snap.sh`
- Create: `data/snap/.gitkeep`

- [ ] **Step 1: Add python-louvain and pytest to requirements**

Replace entire `backend/requirements.txt` with:

```
fastapi==0.115.0
uvicorn[standard]==0.32.0
networkx==3.4.2
numpy==2.1.3
anthropic==0.40.0
python-dotenv==1.0.1
pydantic==2.10.3
python-louvain==0.16
pytest==8.3.4
```

- [ ] **Step 2: Add data/snap/ to .gitignore**

Append to root `.gitignore`:

```
# SNAP raw data
data/snap/*.edges
data/snap/*.feat
data/snap/*.featnames
data/snap/*.egofeat
data/snap/*.circles
```

- [ ] **Step 3: Create download script**

Create `scripts/download_snap.sh`:

```bash
#!/usr/bin/env bash
set -e

DEST="$(dirname "$0")/../data/snap"
mkdir -p "$DEST"

echo "Downloading SNAP Twitter ego-nets..."
curl -L "https://snap.stanford.edu/data/twitter.tar.gz" -o /tmp/twitter.tar.gz

echo "Extracting..."
tar -xzf /tmp/twitter.tar.gz -C /tmp/

# Copy only .edges files (the graph topology we need)
cp /tmp/twitter/*.edges "$DEST/"
rm -f /tmp/twitter.tar.gz

echo "Done. Files in $DEST:"
ls "$DEST"/*.edges | wc -l
echo ".edges files downloaded."
```

- [ ] **Step 4: Create data/snap placeholder and install**

```bash
mkdir -p data/snap && touch data/snap/.gitkeep
cd backend && pip install python-louvain==0.16 pytest==8.3.4
```

Expected: no errors, `community` package importable.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt .gitignore scripts/download_snap.sh data/snap/.gitkeep
git commit -m "chore: add python-louvain, pytest, SNAP download script"
```

---

## Task 2: `snap_loader.py` — edge parsing and BFS sampling

**Files:**
- Create: `backend/snap_loader.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_snap_loader.py`

- [ ] **Step 1: Write failing tests for edge loading and BFS sampling**

Create `backend/tests/__init__.py` (empty).

Create `backend/tests/test_snap_loader.py`:

```python
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
import networkx as nx
from snap_loader import _load_edges, _bfs_sample


def _write_edges(path: str, edges: list[tuple[int, int]]):
    with open(path, "w") as f:
        for u, v in edges:
            f.write(f"{u} {v}\n")


def test_load_edges_basic():
    with tempfile.TemporaryDirectory() as d:
        _write_edges(f"{d}/ego1.edges", [(1, 2), (2, 3), (3, 4)])
        _write_edges(f"{d}/ego2.edges", [(4, 5), (5, 6)])
        G = _load_edges(d)
        assert G.number_of_nodes() == 6
        assert G.number_of_edges() == 5


def test_load_edges_ignores_non_edge_files():
    with tempfile.TemporaryDirectory() as d:
        _write_edges(f"{d}/ego1.edges", [(1, 2)])
        with open(f"{d}/ego1.feat", "w") as f:
            f.write("ignored content")
        G = _load_edges(d)
        assert G.number_of_nodes() == 2


def test_bfs_sample_respects_max_nodes():
    # Star graph: 1 centre connected to 200 leaves
    G = nx.star_graph(200)
    sampled = _bfs_sample(G, max_nodes=50, seed=42)
    assert sampled.number_of_nodes() <= 50


def test_bfs_sample_returns_connected_subgraph():
    G = nx.barabasi_albert_graph(300, 3, seed=1)
    sampled = _bfs_sample(G, max_nodes=100, seed=1)
    assert nx.is_connected(sampled)


def test_bfs_sample_prefers_high_degree_nodes():
    # Hub-and-spoke: node 0 connects to all; nodes 1-10 each connect to 1 leaf
    G = nx.Graph()
    G.add_edges_from([(0, i) for i in range(1, 50)])   # hub
    G.add_edges_from([(i, 50 + i) for i in range(1, 10)])  # spokes
    sampled = _bfs_sample(G, max_nodes=20, seed=0)
    # Hub must be included (highest degree)
    assert 0 in sampled.nodes()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_snap_loader.py -v 2>&1 | head -20
```

Expected: `ImportError` or `ModuleNotFoundError` — `snap_loader` does not exist yet.

- [ ] **Step 3: Implement `_load_edges` and `_bfs_sample` in snap_loader.py**

Create `backend/snap_loader.py`:

```python
import json
import os
import random
from collections import deque
from pathlib import Path

import networkx as nx
import numpy as np

SNAP_DIR = Path(__file__).parent.parent / "data" / "snap"


def _load_edges(data_dir: str | Path) -> nx.Graph:
    """Load all .edges files from a directory into one undirected graph."""
    G = nx.Graph()
    data_path = Path(data_dir)
    for f in sorted(data_path.glob("*.edges")):
        with open(f) as fp:
            for line in fp:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    try:
                        u, v = int(parts[0]), int(parts[1])
                        G.add_edge(u, v)
                    except ValueError:
                        continue
    return G


def _bfs_sample(G: nx.Graph, max_nodes: int, seed: int | None = None) -> nx.Graph:
    """
    BFS from the highest-degree node, expanding neighbours ordered by degree
    (highest first). Stops when max_nodes is reached.
    Returns a copy of the induced subgraph.
    """
    if G.number_of_nodes() <= max_nodes:
        return G.copy()

    # Start from highest-degree node
    start = max(G.degree(), key=lambda x: x[1])[0]

    visited: set[int] = {start}
    queue: deque[int] = deque([start])

    while queue and len(visited) < max_nodes:
        node = queue.popleft()
        # Sort neighbours descending by degree so high-influence nodes come first
        neighbours = sorted(G.neighbors(node), key=lambda n: G.degree(n), reverse=True)
        for nb in neighbours:
            if nb not in visited:
                visited.add(nb)
                queue.append(nb)
                if len(visited) >= max_nodes:
                    break

    return G.subgraph(visited).copy()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_snap_loader.py::test_load_edges_basic tests/test_snap_loader.py::test_load_edges_ignores_non_edge_files tests/test_snap_loader.py::test_bfs_sample_respects_max_nodes tests/test_snap_loader.py::test_bfs_sample_returns_connected_subgraph tests/test_snap_loader.py::test_bfs_sample_prefers_high_degree_nodes -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/snap_loader.py backend/tests/__init__.py backend/tests/test_snap_loader.py
git commit -m "feat: snap_loader edge parsing and BFS sampling"
```

---

## Task 3: `snap_loader.py` — Louvain, Claude community labels, PageRank KOL, output

**Files:**
- Modify: `backend/snap_loader.py`
- Modify: `backend/tests/test_snap_loader.py`

- [ ] **Step 1: Add tests for community detection and output schema**

Append to `backend/tests/test_snap_loader.py`:

```python
from snap_loader import _detect_communities, _compute_node_attributes, load_snap_graph
from unittest.mock import MagicMock


def test_detect_communities_returns_partition():
    G = nx.barabasi_albert_graph(100, 3, seed=42)
    partition = _detect_communities(G)
    assert len(partition) == 100
    assert all(isinstance(v, int) for v in partition.values())


def test_compute_node_attributes_schema():
    G = nx.barabasi_albert_graph(30, 2, seed=1)
    partition = {n: n % 3 for n in G.nodes()}
    pagerank = nx.pagerank(G)
    kol_set = set(list(G.nodes())[:3])
    community_labels = {0: "tech news", 1: "sports fans", 2: "finance"}

    nodes = _compute_node_attributes(G, partition, pagerank, kol_set, community_labels)

    assert len(nodes) == 30
    for node in nodes:
        assert node["id"].startswith("n_")
        assert node["type"] in ("kol", "normal")
        assert isinstance(node["community"], str)
        assert 0.0 <= node["influence"] <= 1.0
        assert 0.0 <= node["activity"] <= 1.0
        assert 0.0 <= node["sentiment"] <= 1.0
        assert isinstance(node["followers"], int)


def test_load_snap_graph_with_mock_client():
    """load_snap_graph should return schema-compatible dict using a mock Claude client."""
    with tempfile.TemporaryDirectory() as d:
        # Write a small graph (60 nodes via BA-style edges)
        G = nx.barabasi_albert_graph(60, 3, seed=7)
        with open(f"{d}/test.edges", "w") as f:
            for u, v in G.edges():
                f.write(f"{u} {v}\n")

        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="tech influencers")]
        mock_client.messages.create.return_value = mock_response

        result = load_snap_graph(data_dir=d, n_kol=3, max_nodes=50, claude_client=mock_client)

    assert "nodes" in result and "edges" in result
    kols = [n for n in result["nodes"] if n["type"] == "kol"]
    assert len(kols) == 3
    # All nodes have required fields
    required = {"id", "name", "type", "community", "influence", "activity", "sentiment", "followers"}
    for node in result["nodes"]:
        assert required <= node.keys()
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_snap_loader.py::test_detect_communities_returns_partition tests/test_snap_loader.py::test_compute_node_attributes_schema tests/test_snap_loader.py::test_load_snap_graph_with_mock_client -v 2>&1 | head -20
```

Expected: `ImportError` — functions not defined yet.

- [ ] **Step 3: Add community detection, label inference, output formatter, and `load_snap_graph` to snap_loader.py**

Append to `backend/snap_loader.py` (after the `_bfs_sample` function):

```python
try:
    import community as community_louvain
    _LOUVAIN_AVAILABLE = True
except ImportError:
    _LOUVAIN_AVAILABLE = False


def _detect_communities(G: nx.Graph) -> dict[int, int]:
    """Louvain community detection. Returns {node_id: community_int}."""
    if _LOUVAIN_AVAILABLE:
        return community_louvain.best_partition(G)
    # Fallback: label propagation
    communities = nx.algorithms.community.label_propagation_communities(G)
    return {node: i for i, comm in enumerate(communities) for node in comm}


def _infer_community_labels(
    G: nx.Graph,
    partition: dict[int, int],
    claude_client,
) -> dict[int, str]:
    """
    For each community, compute structural stats and ask Claude for a topic label.
    Returns {community_int: label_string}.
    """
    community_ids = sorted(set(partition.values()))
    labels: dict[int, str] = {}

    for cid in community_ids:
        members = [n for n, c in partition.items() if c == cid]
        subgraph = G.subgraph(members)

        size = len(members)
        density = round(nx.density(subgraph), 4)
        avg_degree = round(
            sum(dict(subgraph.degree()).values()) / max(size, 1), 1
        )
        bridge_count = sum(
            1 for u in members for v in G.neighbors(u) if partition.get(v) != cid
        )

        prompt = (
            f"A social network community has these structural characteristics:\n"
            f"- Size: {size} nodes\n"
            f"- Internal density: {density}\n"
            f"- Average internal degree: {avg_degree}\n"
            f"- Cross-community connections: {bridge_count}\n\n"
            f"Based on typical Twitter community patterns, suggest a concise topic label "
            f"(2-4 words). Examples: 'tech influencers', 'sports fans', 'finance news', "
            f"'entertainment media', 'political commentary'.\n\n"
            f"Respond with ONLY the label, no explanation."
        )

        try:
            response = claude_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=20,
                messages=[{"role": "user", "content": prompt}],
            )
            labels[cid] = response.content[0].text.strip().lower()
        except Exception:
            labels[cid] = f"community_{cid}"

    return labels


def _compute_node_attributes(
    G: nx.Graph,
    partition: dict[int, int],
    pagerank: dict[int, float],
    kol_set: set[int],
    community_labels: dict[int, str],
) -> list[dict]:
    """Convert NetworkX graph to SocialSim node-dict list."""
    degrees = dict(G.degree())
    max_degree = max(degrees.values()) if degrees else 1
    max_pr = max(pagerank.values()) if pagerank else 1.0

    nodes = []
    for node in G.nodes():
        is_kol = node in kol_set
        degree = degrees.get(node, 0)
        pr = pagerank.get(node, 0.0)
        cid = partition.get(node, 0)

        if is_kol:
            influence = round(min(1.0, 0.6 + (pr / max_pr) * 0.4), 2)
            followers = int(degree * 300 + 5000)
        else:
            influence = round(min(0.7, (pr / max_pr) * 0.7), 2)
            followers = int(degree * 20 + 50)

        nodes.append({
            "id": f"n_{node}",
            "name": f"User_{node}",          # overwritten by twin_builder
            "type": "kol" if is_kol else "normal",
            "community": community_labels.get(cid, f"community_{cid}"),
            "influence": influence,
            "activity": round(min(0.9, degree / max_degree * 0.5 + 0.3), 2),
            "sentiment": round(0.5 + (pr / max_pr - 0.5) * 0.4, 2),
            "followers": followers,
            "persona": None,
        })
    return nodes


def load_snap_graph(
    data_dir: str | Path | None = None,
    n_kol: int = 15,
    max_nodes: int = 500,
    seed: int | None = None,
    claude_client=None,
) -> dict:
    """
    Parse SNAP Twitter ego-nets, sample to max_nodes via BFS,
    detect communities with Claude-generated labels, identify KOLs
    via PageRank. Returns dict matching generate_graph() output schema.
    """
    dir_path = Path(data_dir) if data_dir else SNAP_DIR
    if not dir_path.exists() or not any(dir_path.glob("*.edges")):
        raise FileNotFoundError(
            f"No .edges files found in {dir_path}. "
            "Run scripts/download_snap.sh first."
        )

    G_full = _load_edges(dir_path)
    G = _bfs_sample(G_full, max_nodes=max_nodes, seed=seed)

    partition = _detect_communities(G)
    pagerank = nx.pagerank(G)

    kol_nodes = sorted(pagerank, key=pagerank.__getitem__, reverse=True)[:n_kol]
    kol_set = set(kol_nodes)

    if claude_client is not None:
        community_labels = _infer_community_labels(G, partition, claude_client)
    else:
        community_labels = {cid: f"community_{cid}" for cid in set(partition.values())}

    nodes = _compute_node_attributes(G, partition, pagerank, kol_set, community_labels)

    edges = []
    for u, v in G.edges():
        same_community = partition.get(u) == partition.get(v)
        edges.append({
            "source": f"n_{u}",
            "target": f"n_{v}",
            "weight": round(min(0.9, 0.2 + pagerank.get(u, 0) * 20), 2),
            "type": "friend" if same_community else "follow",
        })

    return {"nodes": nodes, "edges": edges}
```

- [ ] **Step 4: Run all snap_loader tests**

```bash
cd backend && python -m pytest tests/test_snap_loader.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/snap_loader.py backend/tests/test_snap_loader.py
git commit -m "feat: snap_loader Louvain community labels and load_snap_graph"
```

---

## Task 4: `twin_builder.py` — Layer A (Claude persona) + Layer B (topology behaviour)

**Files:**
- Create: `backend/twin_builder.py`
- Create: `backend/tests/test_twin_builder.py`

- [ ] **Step 1: Write failing tests for Layer B**

Create `backend/tests/test_twin_builder.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
from twin_builder import _build_layer_b, build_twin
from unittest.mock import patch, MagicMock


def test_layer_b_high_betweenness_is_bridge():
    b = _build_layer_b(degree=80, betweenness=0.05, clustering=0.1)
    assert b["bridge_role"] is True
    assert "shares_cross_community" in b["content_filters"]


def test_layer_b_high_clustering_is_loyal():
    b = _build_layer_b(degree=20, betweenness=0.001, clustering=0.6)
    assert b["community_loyal"] is True
    assert "prefers_intra_community" in b["content_filters"]


def test_layer_b_high_degree_is_high_engagement():
    b = _build_layer_b(degree=150, betweenness=0.001, clustering=0.1)
    assert b["engagement_bias"] == "high"


def test_layer_b_low_degree_is_low_engagement():
    b = _build_layer_b(degree=5, betweenness=0.001, clustering=0.1)
    assert b["engagement_bias"] == "low"


def test_build_twin_returns_valid_json_on_api_failure():
    """When Claude API fails, build_twin must still return valid JSON."""
    with patch("twin_builder._client") as mock_client:
        mock_client.messages.create.side_effect = Exception("API down")
        result = build_twin(
            node_id="n_42",
            community="tech influencers",
            degree=50,
            betweenness=0.02,
            clustering=0.15,
            pagerank=0.003,
            neighbors_count=50,
        )
    parsed = json.loads(result)
    required = {"name", "bio", "topics", "tone", "posting_frequency", "brand_sensitivity", "behavior"}
    assert required <= parsed.keys()


def test_build_twin_uses_layer_b_in_output():
    """Layer B behavior dict must appear in the returned persona JSON."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "name": "Alice Chen",
        "bio": "AI researcher.",
        "topics": ["AI", "ML"],
        "tone": "analytical",
        "posting_frequency": "high",
        "brand_sensitivity": 0.7,
        "behavior": {"bridge_role": True, "community_loyal": False,
                     "engagement_bias": "high", "content_filters": ["shares_cross_community"]},
    }))]
    with patch("twin_builder._client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        result = build_twin(
            node_id="n_1",
            community="tech influencers",
            degree=120,
            betweenness=0.05,
            clustering=0.1,
            pagerank=0.005,
            neighbors_count=120,
        )
    parsed = json.loads(result)
    assert "behavior" in parsed
    assert parsed["name"] == "Alice Chen"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_twin_builder.py -v 2>&1 | head -10
```

Expected: `ImportError` — module not found.

- [ ] **Step 3: Create `backend/twin_builder.py`**

```python
import json
import os
import anthropic
import networkx as nx

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_TWIN_SYSTEM = (
    "You are a social media analyst building digital twin profiles for Twitter KOLs. "
    "Given network topology metrics, generate a realistic Twitter user persona. "
    "Respond ONLY with valid JSON matching the exact schema in the user message."
)


def _build_layer_b(degree: int, betweenness: float, clustering: float) -> dict:
    """
    Infer behaviour pattern from topology. No API call.
    Thresholds are calibrated to typical Twitter ego-net distributions.
    """
    bridge_role = betweenness > 0.01
    community_loyal = clustering > 0.3

    if degree > 100:
        engagement_bias = "high"
    elif degree > 30:
        engagement_bias = "medium"
    else:
        engagement_bias = "low"

    content_filters = []
    if bridge_role:
        content_filters.append("shares_cross_community")
    if community_loyal:
        content_filters.append("prefers_intra_community")

    return {
        "bridge_role": bridge_role,
        "community_loyal": community_loyal,
        "engagement_bias": engagement_bias,
        "content_filters": content_filters,
    }


def build_twin(
    node_id: str,
    community: str,
    degree: int,
    betweenness: float,
    clustering: float,
    pagerank: float,
    neighbors_count: int,
) -> str:
    """
    Build a Digital Twin JSON string (persona field value) for a KOL node.
    Contains Layer A (Claude-generated static profile) + Layer B (topology behaviour).
    Returns a JSON string; never raises — falls back to a minimal valid persona on error.
    """
    layer_b = _build_layer_b(degree, betweenness, clustering)

    prompt = (
        f"Build a Twitter KOL digital twin profile.\n\n"
        f"Network metrics:\n"
        f"- Community topic: {community}\n"
        f"- Connections (degree): {degree}\n"
        f"- PageRank influence: {pagerank:.5f}\n"
        f"- Betweenness centrality: {betweenness:.5f}\n"
        f"- Clustering coefficient: {clustering:.3f}\n"
        f"- Neighbour count: {neighbors_count}\n"
        f"- Inferred behaviour: {json.dumps(layer_b)}\n\n"
        f"Return ONLY a JSON object with this exact schema:\n"
        f'{{\n'
        f'  "name": "<realistic Twitter display name, e.g. Jordan Wei>",\n'
        f'  "bio": "<2-sentence Twitter bio matching the community>",\n'
        f'  "topics": ["<topic1>", "<topic2>", "<topic3>"],\n'
        f'  "tone": "<analytical|casual|enthusiastic|skeptical|professional>",\n'
        f'  "posting_frequency": "<high|medium|low>",\n'
        f'  "brand_sensitivity": <float 0.0-1.0>,\n'
        f'  "behavior": {json.dumps(layer_b)}\n'
        f'}}'
    )

    try:
        response = _client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=350,
            system=_TWIN_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        json.loads(raw)   # validate
        return raw
    except Exception as e:
        print(f"[twin_builder] ERROR for {node_id}: {e}")
        return json.dumps({
            "name": f"User_{node_id.replace('n_', '')}",
            "bio": f"Active voice in the {community} community.",
            "topics": [community.split()[0] if community else "general", "social media", "networking"],
            "tone": "casual",
            "posting_frequency": layer_b["engagement_bias"],
            "brand_sensitivity": 0.5,
            "behavior": layer_b,
        })


def build_all_twins(graph_data: dict) -> dict:
    """
    Enrich all KOL nodes in graph_data with Digital Twin personas.
    Mutates graph_data["nodes"] in place and returns graph_data.
    Also updates node["name"] from the generated twin.
    """
    # Rebuild graph for centrality metrics (needed for Layer B)
    G = nx.Graph()
    for edge in graph_data["edges"]:
        u = int(edge["source"].replace("n_", ""))
        v = int(edge["target"].replace("n_", ""))
        G.add_edge(u, v)

    betweenness = nx.betweenness_centrality(G, normalized=True)
    clustering = nx.clustering(G)
    pagerank = nx.pagerank(G)

    for node in graph_data["nodes"]:
        if node["type"] != "kol":
            continue

        nid = int(node["id"].replace("n_", ""))
        degree = G.degree(nid) if G.has_node(nid) else 0

        twin_json = build_twin(
            node_id=node["id"],
            community=node["community"],
            degree=degree,
            betweenness=betweenness.get(nid, 0.0),
            clustering=clustering.get(nid, 0.0),
            pagerank=pagerank.get(nid, 0.0),
            neighbors_count=len(list(G.neighbors(nid))) if G.has_node(nid) else 0,
        )
        node["persona"] = twin_json
        try:
            node["name"] = json.loads(twin_json).get("name", node["name"])
        except Exception:
            pass

    return graph_data
```

- [ ] **Step 4: Run twin_builder tests**

```bash
cd backend && python -m pytest tests/test_twin_builder.py -v
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/twin_builder.py backend/tests/test_twin_builder.py
git commit -m "feat: twin_builder Layer A+B digital twin personas"
```

---

## Task 5: `agent.py` + `simulation.py` — JSON persona parsing + Layer C

**Files:**
- Modify: `backend/agent.py`
- Modify: `backend/simulation.py`

- [ ] **Step 1: Update `agent.py` — parse JSON persona and inject Layer C context**

Replace `backend/agent.py` entirely:

```python
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
        pct = round(activated_neighbors / total_neighbors * 100)
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
```

- [ ] **Step 2: Update `simulation.py` — pass Layer C counts to `get_kol_decision`**

In `backend/simulation.py`, replace the `call_kol` inner function (lines 53–62):

```python
            def call_kol(activator_id: str) -> dict:
                activator = node_map[activator_id]
                # Layer C: count how many neighbours are already activated
                nb_ids = [nb for nb, _ in adjacency[activator_id]]
                activated_nb = sum(1 for nb in nb_ids if nb in activated)
                return get_kol_decision(
                    activator_id,
                    activator.get("persona", ""),
                    activator["community"],
                    brand_name,
                    brand_content,
                    avg_sentiment,
                    activated_neighbors=activated_nb,
                    total_neighbors=len(nb_ids),
                )
```

- [ ] **Step 3: Verify agent parse logic with a quick smoke test**

```bash
cd backend && python -c "
from agent import _parse_persona, _build_user_message
import json

# Test 1: JSON persona
twin = json.dumps({'name':'Alice','bio':'AI writer.','topics':['AI'],'tone':'analytical',
                   'brand_sensitivity':0.7,'behavior':{'bridge_role':True,'community_loyal':False,
                   'engagement_bias':'high','content_filters':[]}})
d = _parse_persona(twin)
assert d['name'] == 'Alice', 'JSON parse failed'

# Test 2: plain string fallback
d2 = _parse_persona('Tech blogger')
assert d2['raw'] == 'Tech blogger', 'Plain string fallback failed'

# Test 3: Layer C injection
msg = _build_user_message(d, 'tech', 'BrandX', 'Cool product', 0.7, 3, 10)
assert '3/10' in msg, 'Layer C not injected'
print('All checks passed')
"
```

Expected: `All checks passed`

- [ ] **Step 4: Commit**

```bash
git add backend/agent.py backend/simulation.py
git commit -m "feat: agent JSON persona parsing and Layer C neighbour context"
```

---

## Task 6: `main.py` — `source` param and startup SNAP preload

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add lifespan, snap imports, and source param to main.py**

Replace the top section of `backend/main.py` (lines 1–50) with:

```python
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
    CompareRequest, CompareResult, NodeDetailResponse
)
from graph import generate_graph
from simulation import run_simulation
from analytics import compute_analytics
from snap_loader import load_snap_graph
from twin_builder import build_all_twins

load_dotenv()

_graph_cache: dict[str, dict] = {}
_last_graph_id: Optional[str] = None
_snap_graph_id: Optional[str] = None   # cached pre-loaded SNAP graph

_SNAP_DIR = Path(__file__).parent.parent / "data" / "snap"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Preload SNAP graph at startup if data is available."""
    global _snap_graph_id, _last_graph_id
    if _SNAP_DIR.exists() and any(_SNAP_DIR.glob("*.edges")):
        print("[startup] Preloading SNAP graph...")
        try:
            claude = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
            graph_data = load_snap_graph(
                data_dir=_SNAP_DIR,
                n_kol=15,
                max_nodes=500,
                claude_client=claude,
            )
            graph_data = build_all_twins(graph_data)
            gid = str(uuid.uuid4())
            _graph_cache[gid] = graph_data
            _snap_graph_id = gid
            _last_graph_id = gid
            print(f"[startup] SNAP graph loaded: {len(graph_data['nodes'])} nodes, id={gid}")
        except Exception as e:
            print(f"[startup] SNAP preload failed: {e} — falling back to synthetic")
    else:
        print("[startup] No SNAP data found, skipping preload.")
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
            # Return the preloaded graph (same id each time for cache hits)
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
        graph_data = load_snap_graph(data_dir=_SNAP_DIR, n_kol=n_kol, max_nodes=n_nodes, seed=seed, claude_client=claude)
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
```

Keep the rest of `main.py` (lines 51–161 in the original) unchanged.

- [ ] **Step 2: Verify import chain works**

```bash
cd backend && python -c "from main import app; print('imports OK')"
```

Expected: `imports OK` (no ImportError).

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: main.py source=snap param and startup SNAP preload"
```

---

## Task 7: Download data and end-to-end smoke test

**Files:** none modified — runtime validation only

- [ ] **Step 1: Download SNAP data**

```bash
bash scripts/download_snap.sh
```

Expected: prints number of `.edges` files downloaded (should be 10).

- [ ] **Step 2: Start the backend and request a SNAP graph**

```bash
cd backend && source .venv/bin/activate && uvicorn main:app --port 8001 &
sleep 4
curl -s "http://localhost:8001/graph?source=snap" | python3 -c "
import json, sys
d = json.load(sys.stdin)
nodes = d['nodes']
kols = [n for n in nodes if n['type'] == 'kol']
print(f'nodes={len(nodes)}, kols={len(kols)}')
# Verify KOL has rich Digital Twin persona
kol = kols[0]
persona = json.loads(kol['persona'])
assert 'bio' in persona, 'Missing bio'
assert 'behavior' in persona, 'Missing behavior layer'
assert 'bridge_role' in persona['behavior'], 'Missing Layer B'
print(f'KOL name={kol[\"name\"]}, community={kol[\"community\"]}')
print(f'Persona topics={persona[\"topics\"]}')
print('Smoke test passed')
"
```

Expected output (values will vary):
```
nodes=500, kols=15
KOL name=Jordan Wei, community=tech influencers
Persona topics=['AI', 'machine learning', 'startups']
Smoke test passed
```

- [ ] **Step 3: Run full test suite**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Kill the background server and commit**

```bash
kill %1 2>/dev/null || true
git add .
git commit -m "feat: SNAP Digital Twin pipeline complete — end-to-end verified"
```

---

## Self-Review

**Spec coverage:**
- [x] SNAP ego-nets as data source → `snap_loader.py`
- [x] BFS sampling with 500-node cap → `_bfs_sample`
- [x] Data-driven community labels via Claude → `_infer_community_labels`
- [x] KOL identification via PageRank → `load_snap_graph`
- [x] Digital Twin Layer A (static Claude persona) → `twin_builder.build_twin`
- [x] Digital Twin Layer B (topology behaviour) → `twin_builder._build_layer_b`
- [x] Digital Twin Layer C (runtime neighbour context) → `agent._build_user_message`
- [x] Backend integration `source=snap` param → `main.get_graph`
- [x] Startup preload → `lifespan`
- [x] Frontend unchanged → no frontend tasks

**Type consistency check:**
- `load_snap_graph` returns `{"nodes": list[dict], "edges": list[dict]}` — matches `generate_graph` and all `main.py` call sites ✓
- `get_kol_decision` new params `activated_neighbors`/`total_neighbors` default to `0` — backward compatible with synthetic graph path in `simulation.py` where they aren't passed ✓
- `build_all_twins` takes and returns the same `graph_data` dict ✓

**No placeholders:** all code blocks are complete and runnable. ✓
