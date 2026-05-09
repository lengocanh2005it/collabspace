CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  full_name varchar NOT NULL,
  avatar_url varchar NULL,
  bio text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON profiles (user_id);
