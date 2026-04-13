import random
import concurrent.futures
from typing import Callable, Optional
from agent import get_kol_decision


def run_simulation(
    nodes: list[dict],
    edges: list[dict],
    seed_nodes: list[str],
    brand_name: str,
    brand_content: str,
    max_steps: int = 20,
    decision_fn: Optional[Callable] = None,
    decision_fn_kwargs: Optional[dict] = None,
) -> list[dict]:
    """Run IC model simulation. Returns list of SimStep dicts.

    decision_fn: callable with signature (node_id, persona, community, brand_name, brand_content,
                 network_sentiment, activated_neighbors, total_neighbors) -> dict
                 Defaults to get_kol_decision.
    decision_fn_kwargs: extra keyword arguments passed to decision_fn (e.g. event_type).
    """
    if decision_fn is None:
        decision_fn = get_kol_decision
    if decision_fn_kwargs is None:
        decision_fn_kwargs = {}

    # Build adjacency: node_id -> list of (neighbor_id, weight)
    adjacency: dict[str, list[tuple[str, float]]] = {n["id"]: [] for n in nodes}
    for edge in edges:
        adjacency[edge["source"]].append((edge["target"], edge["weight"]))
        adjacency[edge["target"]].append((edge["source"], edge["weight"]))

    node_map = {n["id"]: n for n in nodes}

    activated = set(seed_nodes)
    tried: set[tuple[str, str]] = set()
    agent_decision_map: dict[str, dict] = {}

    steps = []

    steps.append({
        "t": 0,
        "activated": list(activated),
        "new_activated": list(seed_nodes),
        "agent_decisions": [],
    })

    for t in range(1, max_steps + 1):
        new_activated = []
        agent_decisions = []

        prev_new = steps[-1]["new_activated"]

        kols_to_decide = [
            activator_id for activator_id in prev_new
            if node_map[activator_id]["type"] == "kol" and activator_id not in agent_decision_map
        ]

        if kols_to_decide:
            avg_sentiment = sum(node_map[n]["sentiment"] for n in activated) / len(activated)

            def call_kol(activator_id: str) -> dict:
                activator = node_map[activator_id]
                nb_ids = [nb for nb, _ in adjacency[activator_id]]
                activated_nb = sum(1 for nb in nb_ids if nb in activated)
                return decision_fn(
                    activator_id,
                    activator.get("persona", ""),
                    activator["community"],
                    brand_name,
                    brand_content,
                    avg_sentiment,
                    activated_neighbors=activated_nb,
                    total_neighbors=len(nb_ids),
                    **decision_fn_kwargs,
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=len(kols_to_decide)) as executor:
                futures = {executor.submit(call_kol, aid): aid for aid in kols_to_decide}
                for future in concurrent.futures.as_completed(futures):
                    decision = future.result()
                    agent_decision_map[decision["node_id"]] = decision

        decisions_added: set[str] = set()
        for activator_id in prev_new:
            activator = node_map[activator_id]

            if activator["type"] == "kol" and activator_id in agent_decision_map:
                decision = agent_decision_map[activator_id]
                if activator_id not in decisions_added:
                    agent_decisions.append(decision)
                    decisions_added.add(activator_id)

                if decision["action"] == "repost":
                    spread_mult = 0.9
                elif decision["action"] == "comment":
                    spread_mult = 0.4
                else:
                    continue

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        if random.random() < weight * spread_mult:
                            activated.add(neighbor_id)
                            new_activated.append(neighbor_id)

            elif activator["type"] == "normal":
                inf = activator["influence"]
                act = activator["activity"]
                sent = activator["sentiment"]

                for neighbor_id, weight in adjacency[activator_id]:
                    if neighbor_id not in activated and (activator_id, neighbor_id) not in tried:
                        tried.add((activator_id, neighbor_id))
                        p = weight * (0.3 + 0.7 * inf * act)
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
