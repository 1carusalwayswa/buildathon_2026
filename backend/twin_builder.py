import json
import os
import anthropic
import networkx as nx

_client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

_TWIN_SYSTEM = (
    "You are a social media analyst building digital twin profiles for Twitter KOLs. "
    "Given network topology metrics, generate a realistic Twitter user persona. "
    "Names must reflect real-world demographic diversity: mix Swedish/Nordic, British, American, "
    "Latin American, South Asian, East Asian, and African names. Avoid over-representing any single ethnicity. "
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
        f'  "name": "<realistic Twitter display name — use diverse names reflecting global users including Swedish/Nordic names (e.g. Erik Lindqvist, Sara Johansson, Alex Chen, Maria Santos, Priya Nair, James Okafor)>",\n'
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
        try:
            u = int(edge["source"].replace("n_", ""))
            v = int(edge["target"].replace("n_", ""))
            G.add_edge(u, v)
        except (ValueError, KeyError, TypeError, AttributeError) as e:
            print(f"[twin_builder] WARNING: skipping malformed edge {edge}: {e}")
            continue

    betweenness = nx.betweenness_centrality(G, normalized=True)
    clustering = nx.clustering(G)
    pagerank = nx.pagerank(G)

    for node in graph_data["nodes"]:
        if node["type"] != "kol":
            continue

        try:
            nid = int(node["id"].replace("n_", ""))
        except (ValueError, KeyError, TypeError, AttributeError) as e:
            print(f"[twin_builder] WARNING: skipping KOL node with invalid ID {node.get('id')}: {e}")
            continue
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
