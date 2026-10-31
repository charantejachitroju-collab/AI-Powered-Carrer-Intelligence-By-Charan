import io
import os
import tempfile
import unittest
from unittest.mock import patch

from docx import Document
from fastapi.testclient import TestClient
from google.auth.exceptions import GoogleAuthError, TransportError
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

import app


class ResumeApiTests(unittest.TestCase):
    def setUp(self):
        self.database_directory = tempfile.TemporaryDirectory()
        self.previous_database_path = app.DATABASE_PATH
        app.DATABASE_PATH = os.path.join(
            self.database_directory.name, "test.sqlite3"
        )
        self.addCleanup(self.restore_database)
        self.valid_claims = {
            "iss": f"https://securetoken.google.com/{app.FIREBASE_PROJECT_ID}",
            "sub": "test-user",
        }
        self.token_verifier = patch.object(
            app, "verify_firebase_token", return_value=self.valid_claims
        )
        self.token_verifier.start()
        self.addCleanup(self.token_verifier.stop)
        self.headers = {"Authorization": "Bearer test-token"}
        self.client = TestClient(app.app, raise_server_exceptions=False)

    def restore_database(self):
        app.DATABASE_PATH = self.previous_database_path
        self.database_directory.cleanup()

    @staticmethod
    def create_docx():
        document = Document()
        for paragraph in (
            "Alex Example alex@example.com",
            "Skills: Python, SQL, Git, Flask, Excel",
            "Education: Computer Science",
            "Experience: Built data analysis projects with Python and SQL.",
            "Projects: Resume analyzer dashboard.",
        ):
            document.add_paragraph(paragraph)
        content = io.BytesIO()
        document.save(content)
        return content.getvalue()

    @staticmethod
    def create_pdf():
        writer = PdfWriter()
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        font_ref = writer._add_object(font)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
        })
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 72 720 Td (Python SQL) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)
        content = io.BytesIO()
        writer.write(content)
        return content.getvalue()

    def upload(self, content, filename):
        return self.client.post(
            "/api/analyze-resume",
            headers=self.headers,
            files={"resume": (filename, io.BytesIO(content), "application/octet-stream")},
        )

    def test_docx_upload_returns_dashboard_response_shape(self):
        response = self.upload(self.create_docx(), "resume.docx")

        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(
            set(result),
            {
                "resume_score",
                "resume_breakdown",
                "resume_explanations",
                "career_match_score",
                "profile_strength",
                "skills",
                "career_matches",
                "suggestions",
                "disclaimer",
            },
        )
        self.assertTrue(any(skill["name"] == "Python" for skill in result["skills"]))
        self.assertTrue(any(
            career["title"] == "Python Developer"
            for career in result["career_matches"]
        ))
        python_role = next(
            career
            for career in result["career_matches"]
            if career["title"] == "Python Developer"
        )
        self.assertIn("Python", python_role["matched_skills"])
        self.assertIn("Django", python_role["gaps"])
        self.assertEqual(
            set(result["resume_breakdown"]),
            {"skills", "projects", "impact", "structure", "keywords"},
        )
        self.assertEqual(set(result["resume_explanations"]), set(result["resume_breakdown"]))
        self.assertLess(result["resume_score"], 100)

    def test_python_variants_match_python_developer_role(self):
        for resume_text in (
            "Skills: Python",
            "Skills: Python 3",
            "Skills: Python3",
            "Skills: Python 2",
        ):
            with self.subTest(resume_text=resume_text):
                result = app.analyze_resume(resume_text)
                self.assertTrue(any(
                    skill["name"] == "Python" for skill in result["skills"]
                ))
                self.assertIn(
                    next(skill["level"] for skill in result["skills"] if skill["name"] == "Python"),
                    {"Beginner", "Intermediate", "Strong"},
                )
                python_role = next(
                    career for career in result["career_matches"]
                    if career["title"] == "Python Developer"
                )
                self.assertIn("Python", python_role["matched_skills"])

    def test_resume_suggestions_are_specific_to_the_target_role(self):
        result = app.analyze_resume(
            "Email: graduate@example.com\nSkills: Python\nProjects: Built a small API",
            "Python Developer",
        )

        self.assertTrue(any(
            suggestion.startswith("ATS keyword check for Python Developer:")
            and "SQL" in suggestion
            for suggestion in result["suggestions"]
        ))
        self.assertTrue(any("Add a metric" in suggestion for suggestion in result["suggestions"]))
        self.assertLess(result["resume_score"], 100)
        self.assertLess(result["profile_strength"], 100)

    def test_automation_and_agentic_ai_roles_match_resume_skills(self):
        result = app.analyze_resume(
            "Python, Playwright, test automation, APIs, workflow automation, "
            "LLMs, RAG, AI agents",
            "Agentic AI Engineer",
        )
        matches = {career["title"]: career for career in result["career_matches"]}

        self.assertIn("Automation Engineer", matches)
        self.assertIn("Agentic AI Engineer", matches)
        self.assertIn("Playwright", matches["Automation Engineer"]["matched_skills"])
        self.assertIn("Workflow Automation", matches["Automation Engineer"]["matched_skills"])
        self.assertIn("AI Agents", matches["Agentic AI Engineer"]["matched_skills"])
        self.assertIn("RAG", matches["Agentic AI Engineer"]["matched_skills"])
        self.assertEqual(result["career_match_score"], matches["Agentic AI Engineer"]["match"])

    def test_profile_is_authenticated_and_persisted_by_firebase_uid(self):
        initial = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(initial.status_code, 200)
        self.assertEqual(initial.json()["profile"]["target_role"], "")
        self.assertIsNone(initial.json()["analysis"])

        updated = self.client.patch(
            "/api/profile",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"profile": {
                "name": "Alex",
                "target_role": "Frontend Developer",
                "progress": {
                    "selectedRole": "frontend",
                    "progress": {"frontend": {"topics": ["0-0"], "projects": []}},
                    "bookmarks": [],
                    "addedSkills": ["React"],
                    "completedSkills": [],
                },
                "drives": [{"company": "Example Co", "details": "Graduate engineer"}],
                "interview_answers": {
                    "frontend-developer-project-javascript": "I built an accessible project and tested it with keyboard navigation."
                },
            }},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["profile"]["name"], "Alex")

        reloaded = self.client.get("/api/profile", headers=self.headers)
        self.assertEqual(reloaded.json()["profile"]["target_role"], "Frontend Developer")
        self.assertEqual(reloaded.json()["profile"]["drives"][0]["company"], "Example Co")
        self.assertEqual(
            reloaded.json()["profile"]["interview_answers"]["frontend-developer-project-javascript"],
            "I built an accessible project and tested it with keyboard navigation.",
        )
        self.assertEqual(
            reloaded.json()["profile"]["progress"]["progress"]["frontend"]["topics"],
            ["0-0"],
        )

    def test_profile_requires_authentication_and_rejects_invalid_fields(self):
        unauthorized = self.client.get("/api/profile")
        invalid = self.client.patch(
            "/api/profile",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"profile": {"unexpected": "value"}},
        )
        self.assertEqual(unauthorized.status_code, 401)
        self.assertEqual(invalid.status_code, 400)
        self.assertIn("error", invalid.json())

    def test_profile_rejects_malformed_or_oversized_interview_answers(self):
        malformed = self.client.patch(
            "/api/profile",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"profile": {"interview_answers": {"Bad ID": "answer"}}},
        )
        oversized = self.client.patch(
            "/api/profile",
            headers={**self.headers, "Content-Type": "application/json"},
            json={"profile": {"interview_answers": {"valid-id": "a" * 4001}}},
        )

        self.assertEqual(malformed.status_code, 400)
        self.assertEqual(oversized.status_code, 400)

    def test_resume_analysis_is_saved_to_the_authenticated_profile(self):
        uploaded = self.upload(self.create_docx(), "resume.docx")
        profile = self.client.get("/api/profile", headers=self.headers)

        self.assertEqual(uploaded.status_code, 200)
        self.assertEqual(profile.status_code, 200)
        saved = profile.json()["analysis"]
        self.assertEqual(saved["filename"], "resume.docx")
        self.assertEqual(saved["data"]["resume_score"], uploaded.json()["resume_score"])
        self.assertIn("impact", saved["data"]["resume_breakdown"])

    def test_pdf_upload_extracts_text(self):
        response = self.upload(self.create_pdf(), "resume.pdf")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(
            skill["name"] == "Python"
            for skill in response.json()["skills"]
        ))

    def test_missing_authentication_is_rejected(self):
        response = self.client.post(
            "/api/analyze-resume",
            files={},
        )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_invalid_firebase_claims_are_rejected(self):
        with patch.object(
            app,
            "verify_firebase_token",
            return_value={"iss": "https://invalid.example", "sub": "test-user"},
        ):
            response = self.client.post(
                "/api/analyze-resume",
                headers=self.headers,
                files={},
            )

        self.assertEqual(response.status_code, 401)

    def test_invalid_bearer_token_is_rejected(self):
        with patch.object(
            app,
            "verify_firebase_token",
            side_effect=GoogleAuthError("invalid token"),
        ):
            response = self.client.post(
                "/api/analyze-resume",
                headers=self.headers,
                files={},
            )

        self.assertEqual(response.status_code, 401)
        self.assertIn("error", response.json())

    def test_authentication_service_failure_returns_unavailable(self):
        with patch.object(
            app,
            "verify_firebase_token",
            side_effect=TransportError("network unavailable"),
        ):
            response = self.client.post(
                "/api/analyze-resume",
                headers=self.headers,
                files={},
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("temporarily unavailable", response.json()["error"])

    def test_missing_or_unreadable_files_return_validation_errors(self):
        missing = self.client.post(
            "/api/analyze-resume",
            headers=self.headers,
        )
        invalid_docx = self.upload(b"not a DOCX", "resume.docx")
        invalid_pdf = self.upload(b"not a PDF", "resume.pdf")

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(invalid_docx.status_code, 400)
        self.assertEqual(invalid_pdf.status_code, 400)
        self.assertTrue(all(
            "error" in response.json()
            for response in (missing, invalid_docx, invalid_pdf)
        ))

    def test_unsupported_file_type_is_rejected(self):
        response = self.upload(b"plain text", "resume.txt")

        self.assertEqual(response.status_code, 400)
        self.assertIn("PDF or DOCX", response.json()["error"])

    def test_oversized_file_is_rejected(self):
        response = self.upload(
            b"x" * (app.MAX_RESUME_SIZE + 1),
            "resume.pdf",
        )

        self.assertEqual(response.status_code, 413)
        self.assertIn("error", response.json())

    def test_unknown_api_route_returns_json_not_found(self):
        response = self.client.get("/api/unknown")

        self.assertEqual(response.status_code, 404)
        self.assertIn("error", response.json())

    def test_backend_source_is_not_served_as_a_static_asset(self):
        response = self.client.get("/app.py")

        self.assertEqual(response.status_code, 404)

    def test_unexpected_api_failure_returns_safe_json_error(self):
        with patch("app.analyze_resume", side_effect=RuntimeError("internal detail")):
            response = self.upload(self.create_docx(), "resume.docx")

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {"error": "An unexpected server error occurred."},
        )

    def test_cors_is_limited_to_local_frontend_origins(self):
        allowed = self.client.get(
            "/api/health",
            headers={"Origin": "http://localhost:5000"},
        )
        denied = self.client.get(
            "/api/health",
            headers={"Origin": "https://untrusted.example"},
        )

        self.assertEqual(
            allowed.headers.get("access-control-allow-origin"),
            "http://localhost:5000",
        )
        self.assertIsNone(denied.headers.get("access-control-allow-origin"))


if __name__ == "__main__":
    unittest.main()
