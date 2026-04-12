import random
import networkx as nx
import numpy as np

COMMUNITIES = ["tech", "fashion", "finance", "food", "sports"]

NAMES_POOL = [
    "Alex Chen", "Sam Park", "Jordan Lee", "Morgan Wu", "Casey Zhang",
    "Riley Liu", "Taylor Wang", "Avery Kim", "Quinn Zhao", "Blake Sun",
    "Drew Xu", "Sage Li", "Rowan Ma", "Phoenix Hu", "River Guo",
    "Harper Zhou", "Skyler Fang", "Logan Tang", "Cameron Jiang", "Reese Luo",
    "Jamie Peng", "Devon Shi", "Elliot Bai", "Finley Yao", "Gray Dong",
    "Hunter Zhu", "Indigo Qian", "Jules Shen", "Kai Liang", "Lane Cai",
]

KOL_PERSONAS = {
    "tech": "Tech blogger focused on AI and consumer electronics. Often reviews the latest gadgets and shares opinions on emerging tech trends.",
    "fashion": "Fashion influencer covering luxury brands, street style, and seasonal trends. Known for honest brand reviews.",
    "finance": "Personal finance educator sharing investment strategies, market analysis, and financial independence tips.",
    "food": "Food critic and recipe developer exploring restaurant culture and culinary innovation.",
    "sports": "Sports analyst covering fitness trends, athlete performance, and sports nutrition.",
}


def generate_graph(
    n_nodes: int = 500,
    n_kol: int = 15,
    m_edges: int = 3,
    n_communities: int = 5,
) -> dict:
    random.seed(42)
    np.random.seed(42)

    G = nx.barabasi_albert_graph(n_nodes, m_edges, seed=42)

    # Top n_kol nodes by degree become KOLs
    degree_sorted = sorted(G.degree(), key=lambda x: x[1], reverse=True)
    kol_indices = {node for node, _ in degree_sorted[:n_kol]}

    # Assign communities via label propagation
    communities = list(nx.algorithms.community.label_propagation_communities(G))
    node_community = {}
    community_names = COMMUNITIES[:n_communities]
    for i, comm in enumerate(communities[:n_communities]):
        for node in comm:
            node_community[node] = community_names[i % n_communities]
    for node in G.nodes():
        if node not in node_community:
            node_community[node] = random.choice(community_names)

    nodes = []
    name_pool = NAMES_POOL * (n_nodes // len(NAMES_POOL) + 1)
    random.shuffle(name_pool)

    for i, node in enumerate(G.nodes()):
        is_kol = node in kol_indices
        community = node_community[node]
        influence = round(random.uniform(0.6, 1.0) if is_kol else random.uniform(0.1, 0.7), 2)
        activity = round(random.uniform(0.4, 0.9), 2)
        sentiment = round(random.uniform(0.3, 0.9), 2)
        followers = random.randint(5000, 50000) if is_kol else random.randint(50, 2000)

        nodes.append({
            "id": f"n_{node}",
            "name": name_pool[i % len(name_pool)],
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
        weight = round(random.uniform(0.2, 0.9), 2)
        edge_type = "friend" if random.random() < 0.3 else "follow"
        edges.append({
            "source": f"n_{u}",
            "target": f"n_{v}",
            "weight": weight,
            "type": edge_type,
        })

    return {"nodes": nodes, "edges": edges}
