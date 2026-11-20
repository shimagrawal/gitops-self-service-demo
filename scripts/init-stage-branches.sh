#!/usr/bin/env bash
# Creates the stage/dev, stage/staging and stage/prod branches on origin, each with only a README.
# Kargo renders into these branches. They must exist before the first promotion: the
# ApplicationSet reads all three, and a missing branch stops it generating Applications for any
# environment. Run once after the first push of main. Existing branches are left alone.
set -euo pipefail

cd "$(dirname "$0")/.."
blob=$(printf '# Rendered manifests\n\nWritten by Kargo. Do not edit by hand.\n' | git hash-object -w --stdin)
tree=$(printf '100644 blob %s\tREADME.md\n' "$blob" | git mktree)

for env in dev staging prod; do
  if git ls-remote --exit-code --heads origin "stage/$env" > /dev/null; then
    echo "stage/$env already exists on origin, skipping"
    continue
  fi
  commit=$(git commit-tree "$tree" -m "Initialize stage/$env")
  git push origin "$commit:refs/heads/stage/$env"
done
