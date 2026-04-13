import random
import networkx as nx
import numpy as np

COMMUNITIES = ["tech", "fashion", "finance", "food", "sports"]

NAMES_POOL = [
    # Swedish / Nordic
    "Erik Lindqvist", "Sara Johansson", "Maja Andersson", "Linus Karlsson",
    "Frida Nilsson", "Oscar Eriksson", "Klara Persson", "Axel Svensson",
    # British / American
    "James Walker", "Emma Thompson", "Oliver Bennett", "Sophie Clarke",
    "Marcus Johnson", "Chloe Davis", "Nathan Brooks", "Zoe Mitchell",
    # Latin American
    "Carlos Mendoza", "Valentina Reyes", "Diego Herrera", "Camila Torres",
    # South Asian
    "Priya Nair", "Arjun Sharma", "Ananya Patel", "Rohan Mehta",
    # East Asian
    "Yuki Tanaka", "Min-jun Lee", "Wei Chen", "Sakura Yamamoto",
    # African / Middle Eastern
    "Amara Okafor", "Kofi Mensah", "Leila Ahmadi", "Tariq Hassan",
]

KOL_PERSONAS = {
    "tech": "Tech blogger focused on AI and consumer electronics. Often reviews the latest gadgets and shares opinions on emerging tech trends.",
    "fashion": "Fashion influencer covering luxury brands, street style, and seasonal trends. Known for honest brand reviews.",
    "finance": "Personal finance educator sharing investment strategies, market analysis, and financial independence tips.",
    "food": "Food critic and recipe developer exploring restaurant culture and culinary innovation.",
    "sports": "Sports analyst covering fitness trends, athlete performance, and sports nutrition.",
}


def _build_community_aware_graph(
    n_nodes: int,
    m_edges: int,
    n_communities: int,
    rng: random.Random,
    np_rng: np.random.Generator,
) -> tuple[nx.Graph, dict[int, str]]:
    """
    Build a social graph with realistic community structure:
    - Each community is a BA subgraph (power-law within community)
    - ~15% of edges are cross-community "weak ties" (Granovetter 1973)
    - This produces visible clusters rather than a homogeneous blob
    """
    community_names = COMMUNITIES[:n_communities]

    # Distribute nodes across communities (roughly equal)
    base_size = n_nodes // n_communities
    sizes = [base_size] * n_communities
    for i in range(n_nodes - base_size * n_communities):
        sizes[i] += 1

    G = nx.Graph()
    node_community: dict[int, str] = {}
    community_node_lists: list[list[int]] = []

    offset = 0
    for c_idx, c_size in enumerate(sizes):
        c_name = community_names[c_idx]
        # BA graph for this community; use m=max(1, m_edges-1) to keep it sparse
        m = max(1, m_edges - 1)
        seed_val = rng.randint(0, 2**31)
        c_g = nx.barabasi_albert_graph(c_size, m, seed=seed_val)

        # Relabel nodes to global IDs
        mapping = {n: n + offset for n in c_g.nodes()}
        c_g = nx.relabel_nodes(c_g, mapping)

        for n in c_g.nodes():
            node_community[n] = c_name

        G.add_nodes_from(c_g.nodes())
        G.add_edges_from(c_g.edges())
        community_node_lists.append(list(c_g.nodes()))
        offset += c_size

    # Add cross-community "weak ties" — about 15% of total intra-community edges
    n_intra = G.number_of_edges()
    n_inter_target = max(n_communities - 1, int(n_intra * 0.15))

    # Prefer connecting high-degree nodes across communities (bridges / hubs)
    all_nodes = list(G.nodes())
    degree_dict = dict(G.degree())
    weights = np.array([degree_dict[n] + 1 for n in all_nodes], dtype=float)
    weights /= weights.sum()

    added = 0
    attempts = 0
    max_attempts = n_inter_target * 20
    while added < n_inter_target and attempts < max_attempts:
        u, v = np_rng.choice(all_nodes, size=2, replace=False, p=weights)
        u, v = int(u), int(v)
        if node_community[u] != node_community[v] and not G.has_edge(u, v):
            G.add_edge(u, v)
            added += 1
        attempts += 1

    return G, node_community


def generate_graph(
    n_nodes: int = 500,
    n_kol: int = 15,
    m_edges: int = 3,
    n_communities: int = 5,
    seed: int | None = None,
) -> dict:
    rng = random.Random(seed)
    np_rng = np.random.default_rng(seed)

    G, node_community = _build_community_aware_graph(
        n_nodes, m_edges, n_communities, rng, np_rng
    )

    # Top n_kol nodes by degree become KOLs
    degree_sorted = sorted(G.degree(), key=lambda x: x[1], reverse=True)
    kol_indices = {node for node, _ in degree_sorted[:n_kol]}

    nodes = []
    name_pool = NAMES_POOL * (n_nodes // len(NAMES_POOL) + 1)
    shuffled_names = name_pool[:]
    rng.shuffle(shuffled_names)

    for i, node in enumerate(G.nodes()):
        is_kol = node in kol_indices
        community = node_community.get(node, rng.choice(COMMUNITIES[:n_communities]))
        influence = round(rng.uniform(0.6, 1.0) if is_kol else rng.uniform(0.1, 0.7), 2)
        activity = round(rng.uniform(0.4, 0.9), 2)
        sentiment = round(rng.uniform(0.3, 0.9), 2)
        followers = rng.randint(5000, 50000) if is_kol else rng.randint(50, 2000)

        nodes.append({
            "id": f"n_{node}",
            "name": shuffled_names[i % len(shuffled_names)],
            "type": "kol" if is_kol else "normal",
            "community": community,
            "influence": influence,
            "activity": activity,
            "sentiment": sentiment,
            "followers": followers,
            "persona": KOL_PERSONAS.get(community) if is_kol else None,
        })

    edges = []
    for u, v in G.edges():
        weight = round(rng.uniform(0.2, 0.9), 2)
        # Cross-community edges are follows; same-community more likely to be friends
        same_comm = node_community.get(u) == node_community.get(v)
        edge_type = "friend" if (same_comm and rng.random() < 0.4) else "follow"
        edges.append({
            "source": f"n_{u}",
            "target": f"n_{v}",
            "weight": weight,
            "type": edge_type,
        })

    return {"nodes": nodes, "edges": edges}
