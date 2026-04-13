import json
import os
from collections import deque
from pathlib import Path

import networkx as nx

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


def _bfs_sample(G: nx.Graph, max_nodes: int) -> nx.Graph:
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
        # Use secondary key by node ID for stable, deterministic ordering
        neighbours = sorted(G.neighbors(node), key=lambda n: (G.degree(n), n), reverse=True)
        for nb in neighbours:
            if nb not in visited:
                visited.add(nb)
                queue.append(nb)
                if len(visited) >= max_nodes:
                    break

    return G.subgraph(visited).copy()


try:
    import community as community_louvain
    _LOUVAIN_AVAILABLE = True
except ImportError:
    _LOUVAIN_AVAILABLE = False


def _detect_communities(G: nx.Graph, min_communities: int = 4) -> dict[int, int]:
    """Community detection with min_communities guarantee.
    Tries Louvain → greedy modularity → degree-quantile fallback.
    Returns {node_id: community_int}.
    """
    partition: dict[int, int] | None = None

    if _LOUVAIN_AVAILABLE:
        partition = community_louvain.best_partition(G)

    if partition is None or len(set(partition.values())) < min_communities:
        try:
            comms = list(nx.algorithms.community.greedy_modularity_communities(G))
            if len(comms) >= min_communities:
                return {node: i for i, comm in enumerate(comms) for node in comm}
        except Exception:
            pass

    # Last resort: split by degree quantile into min_communities buckets
    if partition is None or len(set(partition.values())) < min_communities:
        degrees = dict(G.degree())
        sorted_nodes = sorted(G.nodes(), key=lambda n: degrees[n])
        n = len(sorted_nodes)
        partition = {node: (i * min_communities) // n for i, node in enumerate(sorted_nodes)}

    return partition


def _assign_community_labels(partition: dict[int, int]) -> dict[int, str]:
    """Assign a unique topic label to each community (round-robin, demo use)."""
    _LABELS = ["tech", "fashion", "finance", "food", "sports"]
    community_ids = sorted(set(partition.values()))
    return {cid: _LABELS[i % len(_LABELS)] for i, cid in enumerate(community_ids)}


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
    G = _bfs_sample(G_full, max_nodes=max_nodes)

    partition = _detect_communities(G)
    pagerank = nx.pagerank(G)

    kol_nodes = sorted(pagerank, key=lambda x: pagerank[x], reverse=True)[:n_kol]
    kol_set = set(kol_nodes)

    community_labels = _assign_community_labels(partition)

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
