import random
from agent import get_kol_decision


def run_simulation(
    nodes: list[dict],
    edges: list[dict],
    seed_nodes: list[str],
    brand_name: str,
    brand_content: str,
    max_steps: int = 20,
) -> list[dict]:
    """Run IC model simulation. Returns list of SimStep dicts."""
    # Build adjacency: node_id -> list of (neighbor_id, weight)
    adjacency: dict[str, list[tuple[str, float]]] = {n["id"]: [] for n in nodes}
    for edge in edges:
        adjacency[edge["source"]].append((edge["target"], edge["weight"]))
        adjacency[edge["target"]].append((edge["source"], edge["weight"]))

    node_map = {n["id"]: n for n in nodes}

    activated = set(seed_nodes)
    tried: set[tuple[str, str]] = set()  # (activator, target) pairs already attempted
    agent_decision_map: dict[str, dict] = {}  # node_id -> decision

    steps = []

    # t=0: seed nodes
    steps.append({
        "t": 0,
        "activated": list(activated),
        "new_activated": list(seed_nodes),
        "agent_decisions": [],
    })

    for t in range(1, max_steps + 1):
        new_activated = []
        agent_decisions = []

        # Current frontier: nodes activated in previous step
        prev_new = steps[-1]["new_activated"]

        for activator_id in prev_new:
            activator = node_map[activator_id]

            # If activator is KOL and hasn't decided yet
            if activator["type"] == "kol" and activator_id not in agent_decision_map:
                avg_sentiment = sum(node_map[n]["sentiment"] for n in activated) / len(activated)
                decision = get_kol_decision(
                    activator_id,
                    activator.get("persona", ""),
                    activator["community"],
                    brand_name,
                    brand_content,
                    avg_sentiment,
                )
                agent_decision_map[activator_id] = decision
                agent_decisions.append(decision)

                # KOL spread probability
                if decision["action"] == "repost":
                    spread_mult = 0.9
                elif decision["action"] == "comment":
                    spread_mult = 0.4
                else:
                    continue  # ignore: no spread

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        if random.random() < weight * spread_mult:
                            activated.add(neighbor_id)
                            new_activated.append(neighbor_id)

            elif activator["type"] == "normal":
                # IC model: P = weight * influence * activity * sentiment
                inf = activator["influence"]
                act = activator["activity"]
                sent = activator["sentiment"]

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        p = weight * inf * act * sent
                        if random.random() < p:
                            activated.add(neighbor_id)
                            new_activated.append(neighbor_id)

        steps.append({
            "t": t,
            "activated": list(activated),
            "new_activated": new_activated,
            "agent_decisions": agent_decisions,
        })

        if not new_activated:
            break

    return steps
