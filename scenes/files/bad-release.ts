// Owned by the d2c product team. One WorkloadApp per service. Adding a service here is all it
// takes to get it rendered, deployed and promoted through dev, staging and prod.
import { App } from 'cdk8s';
import { WorkloadApp } from '../../lib/workload';

export function d2cServices(app: App) {
  new WorkloadApp(app, 'd2c-web', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 8080,
  });

  new WorkloadApp(app, 'd2c-payments', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 3000,
    replicas: { prod: 3 },
    env: { PAYMENTS_PROVIDER: 'sandbox' },
  });
}
