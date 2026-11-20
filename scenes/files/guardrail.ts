// Owned by the d2c product team. One WorkloadApp per service. Adding a service here is all it
// takes to get it rendered, deployed and promoted through dev, staging and prod.
import { App, Chart } from 'cdk8s';
import { KubeClusterRoleBinding, KubeNamespace } from '../../imports/k8s';
import { WorkloadApp } from '../../lib/workload';

export function d2cServices(app: App) {
  new WorkloadApp(app, 'd2c-web', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 3000,
  });

  new WorkloadApp(app, 'd2c-payments', {
    team: 'd2c',
    image: 'ghcr.io/akuity/guestbook',
    port: 3000,
    replicas: { prod: 3 },
    env: { PAYMENTS_PROVIDER: 'sandbox' },
  });

  // "Just for debugging": give d2c-payments cluster-admin, and a namespace outside the team's
  // d2c-* prefix for some shared tools. Argo CD refuses both.
  const access = new Chart(app, 'd2c-payments-access');
  new KubeNamespace(access, 'shared-tools', { metadata: { name: 'shared-tools' } });
  new KubeClusterRoleBinding(access, 'cluster-admin', {
    metadata: { name: 'd2c-payments-cluster-admin' },
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
    subjects: [{ kind: 'ServiceAccount', name: 'default', namespace: 'd2c-payments' }],
  });
}
