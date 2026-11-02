CREATE TABLE IF NOT EXISTS user_progress (
    uid VARCHAR(200) NOT NULL,
    resource_id VARCHAR(160) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'not_started',
    completed_at VARCHAR(40),
    notes TEXT NOT NULL DEFAULT '',
    proof_url TEXT NOT NULL DEFAULT '',
    proof_filename VARCHAR(255) NOT NULL DEFAULT '',
    proof_content_type VARCHAR(100) NOT NULL DEFAULT '',
    proof_content BLOB,
    PRIMARY KEY (uid, resource_id),
    FOREIGN KEY (uid) REFERENCES user_profiles(uid)
);

CREATE INDEX IF NOT EXISTS idx_user_progress_uid_status
    ON user_progress (uid, status);
