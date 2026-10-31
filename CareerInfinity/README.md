# CareerInfinity

CareerInfinity is a Python FastAPI application with static HTML pages and
Firebase Authentication. Its resume analyzer extracts text from PDF and DOCX
uploads and returns keyword-based career suggestions.

## Run locally (Windows PowerShell)

```powershell
cd CareerInfinity
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000/`. The dashboard is at
`http://127.0.0.1:5000/dashboard`. The development server binds to loopback by
default and uses Uvicorn's reload mode.

The static pages use the Firebase web-app configuration in `index.html` and
`dashboard.html`. Firebase web API keys identify a web app; they are not server
credentials. Restrict the key to the intended APIs and authorized domains in
the Firebase/Google Cloud console. The backend verifies Firebase ID tokens
against `FIREBASE_PROJECT_ID` and does not require service-account credentials.

Copy `.env.example` to `.env` as a reference, then set the variables in your
shell or hosting environment. `FIREBASE_PROJECT_ID` must match the `projectId`
in both HTML pages. The application does not automatically load `.env`.
`CORS_ORIGINS` is a comma-separated allowlist for a separately hosted frontend;
the default allows the two local frontend origins. Keep any added origins
specific to the frontend hosts you control.

## Data and API

- `GET /api/health` reports whether the FastAPI backend is responding.
- `GET /api/profile` returns the signed-in user's profile, roadmap progress,
  saved placement drives, and latest resume analysis.
- `PATCH /api/profile` updates profile fields, roadmap progress, saved drives,
  and interview practice answers.
  Both profile endpoints require a valid Firebase ID token.
- `POST /api/analyze-resume` accepts a signed-in user's `resume` PDF or DOCX,
  up to 5 MB, and returns resume, profile, and skill estimates plus ranked
  career matches with detected skills and skills to improve for each role.
  The result and uploaded filename are saved to the signed-in user's profile.
- Resume file contents are processed in memory and are not stored by the backend.
- Profile, latest analysis, saved drives, roadmap progress, and interview
  practice answers are stored in SQLite at `instance/career-infinity.sqlite3`
  by default. Set `CAREERINFINITY_DB_PATH` to an absolute path on persistent
  storage in hosted environments. Back up this database and restrict access
  to its directory.
- Theme and sidebar display preferences remain in browser local storage; career
  profile and progress data do not.

The resume score and skill matches are heuristics, not formal assessments.
The resume score is capped below 100 and breaks down detected skills, projects,
impact/metrics, resume structure, and role keywords. Skill levels describe
keyword frequency in the resume; they do not prove proficiency.
Scanned/image-only PDFs need OCR, which is not included.
The Roadmap includes Automation Engineer and Agentic AI Engineer paths. The
dashboard visualizes detected target-role skills and account-saved topic and
project progress; matches remain keyword-based estimates.

The Jobs & Drives page provides role matches from resume analysis and lets users
save opportunities they find. This app does not have a live vacancy-feed
provider or an external jobs endpoint, so it does not claim that suggested
roles are current openings. Interview Prep creates guided practice prompts from
the selected target role and skills detected in the latest resume analysis.
Prompts use deterministic templates, not an AI model, and answers are saved to
the signed-in user's profile; the app does not score or evaluate responses.

## Tests

```powershell
python -m unittest discover -s . -p "*test.py" -v
```
