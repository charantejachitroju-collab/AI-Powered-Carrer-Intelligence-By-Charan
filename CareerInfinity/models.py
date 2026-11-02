from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, Integer, LargeBinary, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "user_profiles"

    uid: Mapped[str] = mapped_column(String(200), primary_key=True)
    profile_json: Mapped[str] = mapped_column(Text, nullable=False)
    analysis_json: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Resume(Base):
    __tablename__ = "resumes"
    __table_args__ = (Index("idx_resumes_uid_date", "uid", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = (Index("idx_analyses_uid_date", "uid", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    resume_id: Mapped[str] = mapped_column(ForeignKey("resumes.id"), nullable=False)
    analysis_json: Mapped[str] = mapped_column(Text, nullable=False)
    role_matches_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    __table_args__ = (Index("idx_interview_sessions_uid_date", "uid", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    questions_json: Mapped[str] = mapped_column(Text, nullable=False)
    answers_json: Mapped[str] = mapped_column(Text, nullable=False)
    report_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
    completed_at: Mapped[str | None] = mapped_column(String(40))


class Drive(Base):
    __tablename__ = "placement_drives"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    company: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(160), nullable=False)
    eligibility: Mapped[str] = mapped_column(Text, nullable=False)
    package_lpa: Mapped[str] = mapped_column(String(80), nullable=False)
    date: Mapped[str] = mapped_column(String(10), nullable=False)
    mode: Mapped[str] = mapped_column(String(30), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    required_skills_json: Mapped[str] = mapped_column(Text, nullable=False)
    apply_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class DriveApplication(Base):
    __tablename__ = "drive_applications"

    drive_id: Mapped[str] = mapped_column(ForeignKey("placement_drives.id", ondelete="CASCADE"), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), primary_key=True)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Document(Base):
    __tablename__ = "resume_documents"
    __table_args__ = (Index("idx_resume_documents_uid_date", "uid", "created_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    extracted_text: Mapped[str] = mapped_column(Text, nullable=False)
    resume_score: Mapped[int | None] = mapped_column(Integer)
    analysis_json: Mapped[str | None] = mapped_column(Text)
    role_matches_json: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)


class Certificate(Base):
    __tablename__ = "earned_certificates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    issued_at: Mapped[str] = mapped_column(String(40), nullable=False)
    verify_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    download_url: Mapped[str] = mapped_column(Text, nullable=False, default="")


class Settings(Base):
    __tablename__ = "user_settings"

    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), primary_key=True)
    settings_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(String(40), nullable=False)


class UserProgress(Base):
    __tablename__ = "user_progress"
    __table_args__ = (Index("idx_user_progress_uid_status", "uid", "status"),)

    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="not_started")
    completed_at: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    proof_url: Mapped[str] = mapped_column(Text, nullable=False, default="")
    proof_filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    proof_content_type: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    proof_content: Mapped[bytes | None] = mapped_column(LargeBinary)


class Feedback(Base):
    __tablename__ = "feedback_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    uid: Mapped[str] = mapped_column(ForeignKey("user_profiles.uid"), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
