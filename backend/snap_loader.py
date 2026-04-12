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
