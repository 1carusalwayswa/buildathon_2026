from collections import defaultdict


def compute_analytics(
    nodes: list[dict],
    edges: list[dict],
    steps: list[dict],
    seed_nodes: list[str],
) -> dict:
    """Compute all analytics from simulation steps."""
    total_nodes = len(nodes)
    node_map = {n["id"]: n for n in nodes}
    final_activated = set(steps[-1]["activated"])
    total_activated = len(final_activated)

    # Coverage
    coverage = round(total_activated / total_nodes, 4)

    # Peak step (most new activations)
    peak_step = max(range(len(steps)), key=lambda i: len(steps[i]["new_activated"]))

    # Activation time per node
    activation_time = {}
    for step in steps:
        t = step["t"]
        for nid in step["new_activated"]:
            activation_time[nid] = t
    max_depth = max(activation_time.values()) if activation_time else 0

    # Community penetration
    community_totals: dict[str, int] = defaultdict(int)
    community_activated: dict[str, int] = defaultdict(int)
    for n in nodes:
        community_totals[n["community"]] += 1
    for nid in final_activated:
        if nid in node_map:
            community_activated[node_map[nid]["community"]] += 1
    community_penetration = {
        c: round(community_activated[c] / community_totals[c], 4)
        for c in community_totals
    }

    # Build adjacency for contribution analysis
    adjacency: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        adjacency[edge["source"]].append(edge["target"])
        adjacency[edge["target"]].append(edge["source"])

    # Node contributions for seed nodes
    node_contributions = []
    for seed in seed_nodes:
        visited = {seed}
        queue = [seed]
        direct = 0
        indirect = 0
        while queue:
            current = queue.pop(0)
            for neighbor in adjacency[current]:
                if neighbor not in visited and neighbor in final_activated:
                    visited.add(neighbor)
                    queue.append(neighbor)
                    t = activation_time.get(neighbor, 999)
                    if t == 1:
                        direct += 1
                    else:
                        indirect += 1
        contribution_pct = round((direct + indirect) / total_activated, 4) if total_activated > 0 else 0
        node_contributions.append({
            "node_id": seed,
            "direct_reach": direct,
            "indirect_reach": indirect,
            "contribution_pct": contribution_pct,
        })

    # Bottleneck nodes
    bottleneck_nodes = [
        nc["node_id"] for nc in node_contributions if nc["contribution_pct"] > 0.15
    ]

    # Critical paths
    critical_paths = []
    for seed in seed_nodes[:3]:
        path = [seed]
        current = seed
        visited_path = {seed}
        for _ in range(max_depth):
            best_next = None
            best_t = -1
            for neighbor in adjacency[current]:
                if neighbor not in visited_path and neighbor in final_activated:
                    t = activation_time.get(neighbor, -1)
                    if t > best_t:
                        best_t = t
                        best_next = neighbor
            if best_next is None:
                break
            path.append(best_next)
            visited_path.add(best_next)
            current = best_next
        if len(path) > 1:
            critical_paths.append(path[:6])

    return {
        "coverage": coverage,
        "max_depth": max_depth,
        "peak_step": peak_step,
        "total_activated": total_activated,
        "community_penetration": community_penetration,
        "node_contributions": node_contributions,
        "bottleneck_nodes": bottleneck_nodes,
        "critical_paths": critical_paths,
    }
