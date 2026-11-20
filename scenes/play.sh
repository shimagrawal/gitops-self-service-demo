#!/usr/bin/env bash
# Puts the d2c team's services file into the state of a demo scene, then prints the commit to make.
# It does not commit or push: do that live, so the audience sees the developer's step.
#
#   scenes/play.sh baseline     d2c-web only (the starting point)
#   scenes/play.sh onboard      + d2c-payments, a new service with no platform changes
#   scenes/play.sh guardrail    + a ClusterRoleBinding to cluster-admin, refused by the AppProject
#   scenes/play.sh broken       a typo in the team's code, the promotion fails with file and line
#   scenes/play.sh bad-release  d2c-web on the wrong port: deploys, pods run, the smoke test fails
set -euo pipefail

cd "$(dirname "$0")/.."
scene="${1:-}"
file="scenes/files/${scene}.ts"
if [ -z "$scene" ] || [ ! -f "$file" ]; then
  echo "usage: $0 <scene>" >&2
  echo "scenes: $(ls scenes/files | sed 's/\.ts$//' | tr '\n' ' ')" >&2
  exit 1
fi

cp "$file" teams/d2c/services.ts
git --no-pager diff --stat -- teams/d2c/services.ts
echo
echo "Next:"
echo "  git commit -am 'd2c: ${scene}' && git push"
