// Owned by the d2c product team. One WorkloadApp per service. Adding a service here is all it
// takes to get it rendered, deployed and promoted through dev, staging and prod.
import { App } from 'cdk8s';
import { WorkloadApp } from '../../lib/workload';

export function d2cServices(app: App) {
  new WorkloadApp(app, 'd2c-web', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 3000,
  });

  // ---------------------------------------------------------------------------------------------
  // Demo scenes: uncomment one block at a time, commit and push.
  // ---------------------------------------------------------------------------------------------

  // 1. SUCCESS: onboard a new service. No platform change needed.
  //    Slack (Argo CD): "Application d2c-orders-dev has been created", then "... running new version".
  //    Then promote it to staging (smoke test) and prod (approval) in Kargo.
  new WorkloadApp(app, 'd2c-orders', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 3000,
    replicas: { prod: 2 },
    env: { ORDERS_MODE: 'demo' },
  });

  // 2. KARGO NOTIFICATION: a typo in the team's code. The render step fails to compile it, the dev
  //    promotion fails and nothing reaches the cluster.
  //    Slack (Kargo): "Promotion to dev failed ... 'replica' does not exist in type
  //    'WorkloadAppProps'. Did you mean to write 'replicas'?"
  //    Fix: change replica to replicas, or comment it out again.
  // new WorkloadApp(app, 'd2c-checkout', {
  //   team: 'd2c',
  //   image: 'ghcr.io/akuity/guestbook',
  //   port: 3000,
  //   replica: { prod: 2 },
  // });

  // 3. ARGO CD NOTIFICATION + AI ON-CALL: a memory limit far too low. It deploys, the pod cannot
  //    run, and after 30s the app is Degraded.
  //    Slack (Argo CD): "Application d2c-payments-dev has degraded".
  //    Slack (AI On-Call, about a minute later): incident triage with root cause and suggested fix.
  //    Fix: remove memoryLimit and progressDeadlineSeconds (or set memoryLimit: '256Mi').
  //    Before the demo: resolve any open incident for d2c-payments-dev.
  // new WorkloadApp(app, 'd2c-payments', {
  //   team: 'd2c',
  //   image: 'ghcr.io/akuity/guestbook',
  //   port: 3000,
  //   env: { PAYMENTS_PROVIDER: 'sandbox' },
  //   memoryLimit: '2Mi',
  //   progressDeadlineSeconds: 30,
  // });
}
