-- Enable pg_trgm for fuzzy/LIKE search on text columns
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN indexes for case-insensitive LIKE search on profiles
CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_fullname_trgm"
  ON "profiles" USING GIN (LOWER(full_name) gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_username_trgm"
  ON "profiles" USING GIN (LOWER(username) gin_trgm_ops)
  WHERE username IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "IDX_profiles_displayname_trgm"
  ON "profiles" USING GIN (LOWER(COALESCE(display_name, '')) gin_trgm_ops)
  WHERE display_name IS NOT NULL;
