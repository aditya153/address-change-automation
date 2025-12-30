-- Migration 004: Users table for Google OAuth authentication

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255),
    picture         VARCHAR(500),
    google_id       VARCHAR(255) UNIQUE,
    role            VARCHAR(50) DEFAULT 'user',  -- 'user' or 'admin'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login      TIMESTAMPTZ
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Insert default admin user (can be updated to real Google account later)
INSERT INTO users (email, name, role) 
VALUES ('admin@example.com', 'Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;
