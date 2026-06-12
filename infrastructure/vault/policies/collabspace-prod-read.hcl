# Read-only policy for Droplet deploy sync scripts.
# Mount: secret/ (KV v2)

path "secret/data/collabspace/prod" {
  capabilities = ["read"]
}

path "secret/metadata/collabspace/prod" {
  capabilities = ["read"]
}
