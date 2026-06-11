# Read-only policy for local dev AppRole / CI sync scripts.
# Mount: secret/ (KV v2)

path "secret/data/collabspace/dev" {
  capabilities = ["read"]
}

path "secret/metadata/collabspace/dev" {
  capabilities = ["read"]
}
