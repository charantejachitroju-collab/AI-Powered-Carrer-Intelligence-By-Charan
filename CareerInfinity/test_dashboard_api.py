import io
from datetime import date, timedelta

from docx import Document
from fastapi.testclient import TestClient

import app


def create_docx(text="Data analyst. Python SQL Excel Power BI data analysis. Education projects experience."):
    document = Document()
    document.add_paragraph(text)
    content = io.BytesIO()
    document.save(content)
    return content.getvalue()


def setup_client(monkeypatch, tmp_path):
    monkeypatch.setattr(app, "DATABASE_PATH", str(tmp_path / "dashboard.sqlite3"))
    monkeypatch.setattr(app, "authenticated_uid", lambda _authorization: "dashboard-test-user")
    client = TestClient(app.app, raise_server_exceptions=False)
    return client


def test_dashboard_settings_market_and_skill_gap_endpoints(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    connection = app.get_database()
    profile, analysis = app.load_profile("dashboard-test-user", connection)
    profile["target_role"] = "Legacy role not in catalog"
    with connection:
        app.save_profile("dashboard-test-user", profile, analysis, connection)
    connection.close()

    summary = client.get("/dashboard/summary")
    settings = client.get("/settings")
    intelligence = client.get("/career/intelligence")
    gap = client.get("/skills/gap?role=Data%20Analyst")
    default_gap = client.get("/skills/gap")
    updated = client.patch(
        "/settings",
        json={"name": "Alex", "target_role": "Data Analyst", "preferred_location": "Hyderabad", "theme": "dark"},
    )
    saved_settings = client.get("/settings")
    updated_gap = client.get("/skills/gap")

    assert summary.status_code == 200
    assert summary.json()["analysis"] is None
    assert settings.status_code == 200
    assert intelligence.json()["market"]["is_sample"] is True
    assert intelligence.json()["market"]["roles"]
    assert intelligence.json()["market"]["roles"][0]["growth_badge"].endswith("% Growth")
    assert intelligence.json()["market"]["roles"][0]["job_count_label"].endswith("(sample)")
    assert gap.status_code == 200
    assert "SQL" in gap.json()["missing_skills"]
    assert default_gap.status_code == 200
    assert default_gap.json()["role"] == app.ROLE_MATCHER.roles[0]["title"]
    assert client.get("/skills/gap?role=Not%20A%20Role").status_code == 404
    assert updated.status_code == 200
    assert saved_settings.json()["theme"] == "dark"
    assert "Agentic AI Engineer" in saved_settings.json()["available_roles"]
    assert updated_gap.json()["role"] == "Data Analyst"
    assert updated_gap.json()["learning_path"]

    invalid_theme = client.patch("/settings", json={"theme": "system"})
    assert invalid_theme.status_code == 400


def test_resume_upload_and_document_download_compare_delete(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)

    first = client.post(
        "/resume/analyze",
        files={"resume": ("alex.docx", create_docx(), "application/octet-stream")},
    )
    second = client.post(
        "/documents",
        files={"document": ("alex-v2.docx", create_docx("Python SQL Git APIs experience projects education."), "application/octet-stream")},
    )

    assert first.status_code == 200, first.text
    assert first.json()["analysis"]["resume_score"] > 0
    assert first.json()["role_matching"]["roles"]
    assert second.status_code == 200, second.text
    first_id, second_id = first.json()["document_id"], second.json()["id"]
    listing = client.get("/documents")
    comparison = client.get("/documents/compare", params={"first": first_id, "second": second_id})
    download = client.get(f"/documents/{first_id}/download")
    summary = client.get("/dashboard/summary")

    assert listing.status_code == 200
    assert len(listing.json()["documents"]) == 2
    assert comparison.status_code == 200
    assert len(comparison.json()["versions"]) == 2
    assert download.status_code == 200
    assert download.content.startswith(b"PK")
    assert summary.json()["document"]["id"] == second_id
    assert client.delete(f"/documents/{first_id}").status_code == 200
    assert len(client.get("/documents").json()["documents"]) == 1


def test_legacy_resume_analysis_feeds_role_and_skill_dashboards(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    analyzed = client.post(
        "/api/analyze-resume",
        files={"resume": ("alex.docx", create_docx(), "application/octet-stream")},
    )
    connection = app.get_database()
    profile, analysis = app.load_profile("dashboard-test-user", connection)
    profile["target_role"] = "Outdated target role"
    with connection:
        app.save_profile("dashboard-test-user", profile, analysis, connection)
    connection.close()
    intelligence = client.get("/career/intelligence")
    summary = client.get("/dashboard/summary")
    gap = client.get("/skills/gap?role=Data%20Analyst")
    default_gap = client.get("/skills/gap")

    assert analyzed.status_code == 200
    assert intelligence.status_code == 200
    assert intelligence.json()["role_match_source"] == "saved_analysis_skill_signals"
    assert intelligence.json()["roles"]
    assert summary.json()["best_fit_role"]
    assert summary.json()["role_match_source"] == "saved_analysis_skill_signals"
    assert "SQL" in gap.json()["matched_skills"]
    assert default_gap.json()["role"] == intelligence.json()["roles"][0]["role"]


def test_roadmap_progress_calculation_uses_completed_resources_and_study_hours():
    roadmap = {
        "stages": [
            {
                "id": "foundation",
                "title": "Foundations",
                "resources": [
                    {"id": "course-a", "estimated_hours": 4},
                    {"id": "course-b", "estimated_hours": 6},
                ],
            },
            {
                "id": "advanced",
                "title": "Advanced",
                "resources": [{"id": "course-c", "estimated_hours": 10}],
            },
        ],
    }

    progress = app.calculate_roadmap_progress(
        roadmap,
        {"course-a": {"status": "completed"}, "course-b": {"status": "in_progress"}},
        weekly_study_hours=5,
        today=date(2026, 3, 1),
    )

    assert progress["overall_percent"] == 33
    assert progress["completed_resources"] == 1
    assert progress["total_resources"] == 3
    assert progress["hours_done"] == 4
    assert progress["hours_remaining"] == 16
    assert progress["current_stage"]["stage_id"] == "foundation"
    assert progress["stages"][0]["progress_percent"] == 50
    assert progress["stages"][1]["progress_percent"] == 0
    assert progress["estimated_finish_date"] == "2026-03-23"


def test_roadmap_catalog_progress_proof_and_certificate_integration(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    summary = client.get("/dashboard/summary")
    catalog = client.get("/roadmaps")
    assert summary.json()["roadmap_progress"]["role"] == "Agentic AI Engineer"
    assert catalog.status_code == 200
    assert len(catalog.json()["roles"]) == 34
    assert sum(role["priority"] for role in catalog.json()["roles"]) == 12

    role = client.get("/roadmaps/agentic-ai-engineer/progress")
    assert role.status_code == 200
    assert role.json()["overall_percent"] == 0
    assert role.json()["current_stage"]["stage_id"] == "agentic-ai-foundations"

    first_stage = role.json()["stages"][0]
    assert first_stage["id"] == "agentic-ai-foundations"
    assert first_stage["progress"]["progress_percent"] == 0
    assert first_stage["resources"][0]["progress"]["status"] == "not_started"

    updated = client.patch(
        "/progress/agentic-ai-anthropic-course",
        json={
            "status": "completed",
            "notes": "Completed the introductory materials.",
            "proof_url": "https://example.com/credential",
        },
    )
    refreshed = client.get("/roadmaps/agentic-ai-engineer/progress")
    assert updated.status_code == 200
    assert updated.json()["verified"] is True
    assert refreshed.json()["overall_percent"] == 17
    assert refreshed.json()["verified_skills"]
    assert refreshed.json()["stages"][0]["progress"]["progress_percent"] == 50
    assert refreshed.json()["stages"][0]["resources"][0]["progress"]["verified"] is True

    uploaded = client.post(
        "/progress/agentic-ai-hf-agents/proof",
        files={"proof": ("completion.pdf", b"%PDF-1.4 test proof", "application/pdf")},
    )
    downloaded = client.get("/progress/agentic-ai-hf-agents/proof")
    assert uploaded.status_code == 200
    assert uploaded.json()["verified"] is True
    assert downloaded.status_code == 200
    assert downloaded.content == b"%PDF-1.4 test proof"

    monkeypatch.setattr(app, "authenticated_uid", lambda _authorization: "different-user")
    other_user_progress = client.get("/roadmaps/agentic-ai-engineer/progress")
    other_user_proof = client.get("/progress/agentic-ai-hf-agents/proof")
    assert other_user_progress.json()["overall_percent"] == 0
    assert other_user_proof.status_code == 404

    monkeypatch.setattr(app, "authenticated_uid", lambda _authorization: "dashboard-test-user")
    client.patch(
        "/progress/dataanalyst-google-cert",
        json={"status": "completed", "proof_url": "https://example.com/data-credential"},
    )
    certificates = client.get("/certificates")
    completed = next(item for item in certificates.json()["roadmap_certifications"] if item["id"] == "dataanalyst-google-cert")
    assert completed["verified"] is True
    assert completed["verify_url"] == "https://example.com/data-credential"


def test_jobs_analysis_requires_resume_and_matches_resume_skills(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    job = "Required skills: Python, SQL, Excel, Tableau and machine learning for analytics."

    missing_resume = client.post("/jobs/analyze", json={"job_description": job})
    uploaded = client.post(
        "/resume/analyze",
        files={"resume": ("alex.docx", create_docx(), "application/octet-stream")},
    )
    match = client.post("/jobs/analyze", json={"job_description": job})

    assert missing_resume.status_code == 409
    assert uploaded.status_code == 200
    assert match.status_code == 200
    assert match.json()["match_score"] > 0
    assert "Python" in match.json()["matched_skills"]
    assert "Machine Learning" in match.json()["missing_skills"]


def test_interview_session_persists_answers_and_report(monkeypatch, tmp_path):
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    client = setup_client(monkeypatch, tmp_path)
    started = client.post(
        "/interview/start",
        json={"role": "Data Analyst", "difficulty": "Beginner"},
    )
    assert started.status_code == 200, started.text
    session_id = started.json()["id"]
    answer_result = None
    for index in range(3):
        answer_result = client.post(
            f"/interview/{session_id}/answer",
            json={"answer": f"I would clarify the problem, analyze the data, test an approach, and share result {index}."},
        )
        assert answer_result.status_code == 200, answer_result.text
    report = client.get(f"/interview/{session_id}/report")

    assert answer_result.json()["completed"] is True
    assert report.status_code == 200
    assert report.json()["complete"] is True
    assert len(report.json()["answers"]) == 3


def test_drives_filters_applications_and_admin_crud(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    monkeypatch.setenv("DRIVE_ADMIN_TOKEN", "test-admin-token")
    payload = {
        "company": "Test Analytics",
        "role": "Data Analyst",
        "eligibility": "Graduates",
        "package_lpa": "To be confirmed",
        "date": (date.today() + timedelta(days=30)).isoformat(),
        "mode": "Virtual",
        "type": "Virtual",
        "required_skills": ["Python", "SQL"],
        "apply_url": "",
    }

    denied = client.post("/drives", json=payload)
    created = client.post("/drives", json=payload, headers={"X-Admin-Token": "test-admin-token"})
    assert denied.status_code == 403
    assert created.status_code == 200
    drive_id = created.json()["id"]
    drives = client.get("/drives", params={"type": "Virtual", "sort": "match"})
    application = client.post(f"/drives/{drive_id}/apply")
    updated = client.patch(
        f"/drives/{drive_id}",
        json={"eligibility": "Graduates with relevant coursework"},
        headers={"X-Admin-Token": "test-admin-token"},
    )
    deleted = client.delete(f"/drives/{drive_id}", headers={"X-Admin-Token": "test-admin-token"})

    assert drives.status_code == 200
    assert any(item["id"] == drive_id for item in drives.json()["drives"])
    assert application.status_code == 200
    assert updated.status_code == 200
    assert deleted.status_code == 200


def test_certificates_and_feedback_are_user_scoped(monkeypatch, tmp_path):
    client = setup_client(monkeypatch, tmp_path)
    certificates = client.get("/certificates")
    feedback = client.post("/feedback", json={"category": "Feature request", "message": "Please add weekly reminders."})
    invalid = client.post("/feedback", json={"category": "Other", "message": "bad"})

    assert certificates.status_code == 200
    assert certificates.json()["certificates"] == []
    assert certificates.json()["catalog"]
    assert feedback.status_code == 200
    assert invalid.status_code == 400
