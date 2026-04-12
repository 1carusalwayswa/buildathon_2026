import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
from twin_builder import _build_layer_b, build_twin
from unittest.mock import patch, MagicMock


def test_layer_b_high_betweenness_is_bridge():
    b = _build_layer_b(degree=80, betweenness=0.05, clustering=0.1)
    assert b["bridge_role"] is True
    assert "shares_cross_community" in b["content_filters"]


def test_layer_b_high_clustering_is_loyal():
    b = _build_layer_b(degree=20, betweenness=0.001, clustering=0.6)
    assert b["community_loyal"] is True
    assert "prefers_intra_community" in b["content_filters"]


def test_layer_b_high_degree_is_high_engagement():
    b = _build_layer_b(degree=150, betweenness=0.001, clustering=0.1)
    assert b["engagement_bias"] == "high"


def test_layer_b_low_degree_is_low_engagement():
    b = _build_layer_b(degree=5, betweenness=0.001, clustering=0.1)
    assert b["engagement_bias"] == "low"


def test_build_twin_returns_valid_json_on_api_failure():
    """When Claude API fails, build_twin must still return valid JSON."""
    with patch("twin_builder._client") as mock_client:
        mock_client.messages.create.side_effect = Exception("API down")
        result = build_twin(
            node_id="n_42",
            community="tech influencers",
            degree=50,
            betweenness=0.02,
            clustering=0.15,
            pagerank=0.003,
            neighbors_count=50,
        )
    parsed = json.loads(result)
    required = {"name", "bio", "topics", "tone", "posting_frequency", "brand_sensitivity", "behavior"}
    assert required <= parsed.keys()


def test_build_twin_uses_layer_b_in_output():
    """Layer B behavior dict must appear in the returned persona JSON."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=json.dumps({
        "name": "Alice Chen",
        "bio": "AI researcher.",
        "topics": ["AI", "ML"],
        "tone": "analytical",
        "posting_frequency": "high",
        "brand_sensitivity": 0.7,
        "behavior": {"bridge_role": True, "community_loyal": False,
                     "engagement_bias": "high", "content_filters": ["shares_cross_community"]},
    }))]
    with patch("twin_builder._client") as mock_client:
        mock_client.messages.create.return_value = mock_response
        result = build_twin(
            node_id="n_1",
            community="tech influencers",
            degree=120,
            betweenness=0.05,
            clustering=0.1,
            pagerank=0.005,
            neighbors_count=120,
        )
    parsed = json.loads(result)
    assert "behavior" in parsed
    assert parsed["name"] == "Alice Chen"
