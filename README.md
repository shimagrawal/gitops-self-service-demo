# GitOps self-service demo

A product team onboards and ships services on its own, on rails the platform (Infra) team builds
once. The team writes a few lines of TypeScript cdk8s. Kargo renders them per environment and
promotes them through dev, staging and prod, Argo CD deploys them within the team's boundaries, and
failures are blocked, explained or rolled back automatically.

## Who owns what

| | Platform (Infra) team, once | Product team (d2c), every day |
|---|---|---|
| Environments, clusters, teams | `platform/` | |
| The construct with the platform's defaults | `lib/workload.ts` | |
| Team boundaries (AppProject), generated from `platform/` | `argocd/generated/` | |
| One Application per service, created automatically | `argocd/appset.yaml` | |
| The release pipeline: render, verify, approve, alert | `kargo/` | |
| The team's services | | `teams/d2c/services.ts` |
| Promoting releases | | Kargo UI |

`CODEOWNERS.example` shows how the split would be enforced.

## How it works

```
teams/d2c/services.ts ─┐   (one WorkloadApp per service)
image ghcr.io/akuity/guestbook ─┤
                        ▼
Warehouse d2c ─► Freight (image digest + commit)
                        │
  dev (auto) ─► staging (smoke test, auto-rollback) ─► prod (approval, audit events)
                        │
  each promotion: cdk8s-synth renders every service for the Stage's environment
                  ─► one folder per service on branch stage/<env> ─► argocd-update
                        │
ApplicationSet d2c: environment × service folder ─► Application <service>-<env>
                    in AppProject d2c (namespaces d2c-* only, no cluster-scoped kinds but Namespace)
                        │
Failed promotions and verifications ─► Slack (EventRouter)
```

- **A new service needs no platform change.** Adding a `WorkloadApp` renders a new folder, and the
  ApplicationSet creates its Applications. The AppProject already allows its `d2c-*` namespace, and
  the pipeline already renders every service.
- **No ordering problems.** The namespace comes from the same construct as the workload and syncs
  first (wave -1).
- **One sync policy** for every service: automated, prune, self-heal, `PruneLast`,
  `FailOnSharedResource`, retries.
- **Per-environment settings** come from `platform/environments.ts`, or from the service for
  overrides (`replicas: { prod: 3 }`).

## Repository structure

```text
.
├── platform/                  # Platform team: environments, clusters, teams (single source of truth)
├── lib/workload.ts            # Platform team: the WorkloadApp construct
├── teams/d2c/services.ts      # d2c team: their services
├── main.ts, cdk8s.yaml        # The cdk8s app Kargo renders
├── generate-appprojects.ts    # npm run platform: platform/ → argocd/generated/
├── argocd/
│   ├── generated/             # AppProject per team (generated, committed)
│   ├── appset.yaml            # Application per service per environment
│   └── kargo-resources.yaml   # Syncs kargo/ into the Kargo instance
├── kargo/
│   ├── project.yaml           # Project d2c, auto-promotion to dev, auto-rollback on staging
│   ├── warehouse.yaml
│   ├── deploy-task.yaml       # git-clone → cdk8s-synth → copy → git-push → argocd-update
│   ├── stages.yaml            # dev → staging → prod
│   ├── smoke-test.yaml        # Staging verification
│   ├── notifications.yaml     # Slack MessageChannel + EventRouters
│   └── cluster/cdk8s-synth.yaml   # Custom step, registered once (not synced)
├── scenes/                    # Demo scenes: scenes/play.sh <scene>
└── scripts/init-stage-branches.sh
```

## Setup

Requirements:

- A Kargo instance on the Akuity Platform (v1.12+) with **self-hosted** Kargo agents `self-hosted`,
  `self-hosted-uat` and `self-hosted-prod`. Custom steps and the Job-based smoke test do not run on
  Akuity-managed agents.
- An Argo CD instance with the clusters `kargo-quickstart`, `cluster-uat` and `cluster-prod`, and the
  Kargo instance registered as `kargo-resources`.
- Egress from the clusters to `registry.npmjs.org` (`cdk8s-synth` runs `npm ci`).

Steps:

1. Create the GitHub repository, push `main`, then create the rendered branches:

   ```shell
   scripts/init-stage-branches.sh
   ```

2. Register the `cdk8s-synth` custom step, unless the instance already has it:

   ```shell
   kargo apply -f kargo/cluster/cdk8s-synth.yaml
   ```

3. Apply the Argo CD resources:

   ```shell
   akuity argocd apply --name <argo-cd-instance> \
     -f argocd/generated/appproject-d2c.k8s.yaml -f argocd/appset.yaml -f argocd/kargo-resources.yaml
   ```

4. Once the `d2c` project exists, add a GitHub token with write access to this repository (the CLI
   prompts for it):

   ```shell
   kargo create repo-credentials --project=d2c github --git \
     --repo-url=https://github.com/shimagrawal/gitops-self-service-demo.git --username=<github-user>
   ```

5. Slack (optional): set `channelID` in `kargo/notifications.yaml`, push, and add the bot token:

   ```shell
   read -rs SLACK_TOKEN
   kargo create generic-credentials --project d2c slack-token --set apiKey="$SLACK_TOKEN"
   ```

6. Map your SSO group to the project's `kargo-promoter` role (Kargo UI → d2c → Roles), so
   developers can promote. Only the approver in `kargo/stages.yaml` can approve prod.

7. Do a first full pass: the first Freight goes to dev on its own; promote it to staging, then to
   prod and approve it.

After changing `platform/`, run `npm run platform` and apply `argocd/generated/` again.

## Demo

Play each scene with `scenes/play.sh <scene>`, then commit and push it live. Reset with
`scenes/play.sh baseline`.

| # | Scene | Command | What happens |
|---|---|---|---|
| 1 | Onboard a new service | `onboard` | `d2c-payments` is added in a few lines. Dev renders it, the ApplicationSet creates `d2c-payments-dev` and its namespace comes up first. No platform change. |
| 2 | Ship it to prod | (Kargo UI) | Promote to staging (smoke test passes), then prod: a developer promotes, the approver approves, prod runs 3 replicas. Audit events record both. |
| 3 | Guardrail | `guardrail` | The team adds a ClusterRoleBinding to cluster-admin. Argo CD refuses it: not permitted in project `d2c`. |
| 4 | Broken code | `broken` | A typo in the team's code. The promotion to dev fails with the file and line, and Slack is notified. Dev keeps running the previous release. |
| 5 | Bad release | `bad-release` | `d2c-web` listens on the wrong port. It deploys and its pods run, but the staging smoke test fails, the Freight cannot reach prod, and staging rolls back on its own. |
| 6 | Rollback and hotfix | (Kargo UI) | Re-promote the previous Freight to prod. For a hotfix, approve a Freight for prod directly, skipping staging. |

Notes:

- The ApplicationSet checks the branches every 30 seconds, so a new service's Application appears
  shortly after its first render. Promotions update the Applications that exist at the time.
- In the guardrail scene the promotion succeeds; the refusal shows on the new Application in Argo CD.
- The construct has no probes, so the bad release looks healthy until the smoke test runs.
