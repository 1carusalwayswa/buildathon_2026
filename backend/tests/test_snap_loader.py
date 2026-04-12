import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import tempfile
import networkx as nx
from snap_loader import _load_edges, _bfs_sample
from snap_loader import _detect_communities, _compute_node_attributes, load_snap_graph
from unittest.mock import MagicMock


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
