import json
import io
import asyncio
from pathlib import Path
import sys
import types
from unittest.mock import patch

from fastapi.testclient import TestClient
from docx import Document

import app
from role_matching import RoleMatcher, detect_skill_counts, estimate_years_of_experience


BASE_DIR = Path(__file__).resolve().parent


def make_matcher():
    return RoleMatcher(BASE_DIR / "roles.json", BASE_DIR / "scoring_config.json")


def test_skill_extraction_respects_word_boundaries_and_aliases():
    counts = detect_skill_counts(
        "Python Python 3 and SQL; Pythonista is not Python.",
        app.SKILL_ALIASES,
    )

    assert counts["Python"] == 3
    assert counts["SQL"] == 1
    assert "Java" not in counts


def test_weighted_scoring_ranks_data_roles_for_relevant_resume():
    matcher = make_matcher()
    result = matcher.match(
        "Data analyst with 2 years experience. SQL, Excel, Power BI, Python, data analysis. "
        "Created business KPI reporting dashboards.",
        app.SKILL_ALIASES,
        top_n=5,
    )

    assert result["roles"][0]["role"] in {"Data Analyst", "Business Intelligence Analyst"}
    assert any(role["role"] == "Data Analyst" for role in result["roles"])
    data_analyst = next(role for role in result["roles"] if role["role"] == "Data Analyst")
    assert data_analyst["match_score"] > 50
    assert {"SQL", "Excel", "Power BI"} <= set(data_analyst["matched_skills"])
    assert data_analyst["score_breakdown"]["semantic_model_available"] is False
    assert data_analyst["score_breakdown"]["semantic_similarity"] > 0
    assert len(data_analyst["skills_to_learn"]) <= 3


def test_experience_extraction_and_missing_experience_fit():
    assert estimate_years_of_experience("Four years experience") is None
    assert estimate_years_of_experience("5 years of professional experience") == 5
    assert estimate_years_of_experience("Experience: 2.5 years") == 2.5

    result = make_matcher().match("Python, SQL, data analysis", app.SKILL_ALIASES)
    assert result["years_of_experience"] is None
    assert all(role["score_breakdown"]["experience_fit"] == 60 for role in result["roles"])


def test_sentence_transformer_embeddings_are_precomputed_and_used():
    class FakeVector(list):
        def tolist(self):
            return list(self)

    class FakeSentenceTransformer:
        def __init__(self, _model_name):
            self.encoded_inputs = []

        def encode(self, texts, normalize_embeddings):
            assert normalize_embeddings is True
            self.encoded_inputs.extend(texts)
            return [FakeVector([1.0, 0.0]) for _ in texts]

    fake_module = types.ModuleType("sentence_transformers")
    fake_module.SentenceTransformer = FakeSentenceTransformer
    matcher = make_matcher()

    with patch.dict(sys.modules, {"sentence_transformers": fake_module}):
        matcher.initialize_embeddings()
        result = matcher.match("Python, SQL, data analysis", app.SKILL_ALIASES, top_n=1)

    assert matcher.semantic_model_available is True
    assert len(matcher.role_embeddings) == len(matcher.roles)
    assert result["roles"][0]["score_breakdown"]["semantic_model_available"] is True
    assert result["roles"][0]["score_breakdown"]["semantic_similarity"] == 100


def test_invalid_llm_review_keeps_deterministic_role_explanation(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": "[]"}}]}

    class FakeAsyncClient:
        def __init__(self, timeout):
            assert timeout == 12

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setattr(app.httpx, "AsyncClient", FakeAsyncClient)
    result = make_matcher().match("Python, SQL, APIs", app.SKILL_ALIASES, top_n=1)
    original_reason = result["roles"][0]["why_this_role_fits"]

    asyncio.run(app.review_top_role_matches("Python SQL APIs", result["roles"]))

    assert result["roles"][0]["why_this_role_fits"] == original_reason


def test_resume_result_cache_is_bounded_and_returns_independent_values():
    matcher = make_matcher()
    first = matcher.match("Python, SQL, Git", app.SKILL_ALIASES, top_n=2)
    first["roles"].clear()
    second = matcher.match("Python, SQL, Git", app.SKILL_ALIASES, top_n=2)

    assert len(second["roles"]) == 2
    assert len(matcher.cache) == 1


def test_role_catalog_contains_15_to_20_labeled_evaluation_resumes():
    samples = json.loads((BASE_DIR / "evaluation_samples.json").read_text(encoding="utf-8"))

    assert 15 <= len(samples) <= 20
    assert all(sample["expected_role"] and len(sample["resume"]) > 40 for sample in samples)


def test_match_roles_endpoint_requires_auth_and_rejects_bad_top_n():
    client = TestClient(app.app, raise_server_exceptions=False)

    unauthenticated = client.post("/match-roles")
    invalid_top_n = client.post("/match-roles", params={"top_n": 11})

    assert unauthenticated.status_code == 401
    assert "error" in unauthenticated.json()
    assert invalid_top_n.status_code == 422


def test_match_roles_endpoint_returns_ranked_roles_for_docx_upload():
    client = TestClient(app.app, raise_server_exceptions=False)
    document = Document()
    document.add_paragraph(
        "Data analyst with 2 years experience. Skills: SQL, Excel, Power BI, "
        "Python, data analysis. Built reporting dashboards."
    )
    content = io.BytesIO()
    document.save(content)

    with patch.object(app, "authenticated_uid", return_value="role-test-user"):
        response = client.post(
            "/match-roles",
            params={"top_n": 3},
            files={"resume": ("resume.docx", content.getvalue())},
        )

    assert response.status_code == 200
    result = response.json()
    assert len(result["roles"]) == 3
    assert result["roles"][0]["role"] in {"Data Analyst", "Business Intelligence Analyst"}
    assert {"role", "match_score", "score_breakdown", "matched_skills",
            "missing_skills", "why_this_role_fits", "skills_to_learn",
            "skill_profile"} <= result["roles"][0].keys()
    assert "SQL" in result["detected_skills"]
    assert result["years_of_experience"] == 2


def test_app_startup_keeps_service_available_without_embedding_dependency(monkeypatch):
    import builtins

    original_import = builtins.__import__

    def reject_sentence_transformers(name, *args, **kwargs):
        if name == "sentence_transformers":
            raise ImportError("Simulated unavailable embedding dependency.")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", reject_sentence_transformers)
    with TestClient(app.app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert app.ROLE_MATCHER.semantic_model_available is False
