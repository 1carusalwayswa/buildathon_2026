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
    sampled = _bfs_sample(G, max_nodes=50)
    assert sampled.number_of_nodes() <= 50


def test_bfs_sample_returns_connected_subgraph():
    G = nx.barabasi_albert_graph(300, 3, seed=1)
    sampled = _bfs_sample(G, max_nodes=100)
    assert nx.is_connected(sampled)


def test_bfs_sample_prefers_high_degree_nodes():
    # Hub-and-spoke: node 0 connects to all; nodes 1-10 each connect to 1 leaf
    G = nx.Graph()
    G.add_edges_from([(0, i) for i in range(1, 50)])   # hub
    G.add_edges_from([(i, 50 + i) for i in range(1, 10)])  # spokes
    sampled = _bfs_sample(G, max_nodes=20)
    # Hub must be included (highest degree)
    assert 0 in sampled.nodes()
