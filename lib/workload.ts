// Owned by the platform (Infra) team. The one construct product teams use to describe a service.
// It turns a few lines of team config into everything the service needs in an environment, with
// the platform's defaults and rules built in:
//   - its own namespace, created first (sync wave -1), so nothing runs before its namespace exists,
//     with the team label and Pod Security enforced
//   - the team label on every object, so ownership and alerts follow the team
//   - per-environment settings from platform/environments.ts
//   - the image pinned to the digest Kargo promoted
import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { KubeDeployment, KubeNamespace, KubeService, IntOrString, Quantity } from '../imports/k8s';
import { ENVIRONMENTS, EnvironmentName, TEAMS, TeamName, currentEnvironment } from '../platform';

export interface WorkloadAppProps {
  /** The owning team, from platform/teams.ts. */
  readonly team: TeamName;
  /** Image repository, without a tag or digest. Kargo supplies the digest. */
  readonly image: string;
  /** Port the container listens on. */
  readonly port: number;
  /** Per-environment replica counts. Defaults come from platform/environments.ts. */
  readonly replicas?: Partial<Record<EnvironmentName, number>>;
  /** Environment variables for the container. */
  readonly env?: Record<string, string>;
  /** Memory limit for the container. Defaults to 256Mi. */
  readonly memoryLimit?: string;
  /** Seconds before a stuck rollout is reported as failed (Degraded). Defaults to Kubernetes' 600. */
  readonly progressDeadlineSeconds?: number;
}

export class WorkloadApp extends Chart {
  constructor(scope: Construct, name: string, props: WorkloadAppProps) {
    super(scope, name);

    const prefix = TEAMS[props.team].namespacePrefix;
    if (!name.startsWith(prefix)) {
      throw new Error(`service ${name} must start with ${prefix}, the namespace prefix of team ${props.team}`);
    }

    const environment = currentEnvironment();
    const labels = { 'app.kubernetes.io/name': name, team: props.team, environment };

    const ns = new KubeNamespace(this, 'namespace', {
      metadata: {
        name,
        labels: { 'team': props.team, 'pod-security.kubernetes.io/enforce': 'baseline' },
      },
    });
    ns.metadata.addAnnotation('argocd.argoproj.io/sync-wave', '-1');

    new KubeDeployment(this, 'deployment', {
      metadata: { name, namespace: name, labels },
      spec: {
        replicas: props.replicas?.[environment] ?? ENVIRONMENTS[environment].replicas,
        progressDeadlineSeconds: props.progressDeadlineSeconds,
        selector: { matchLabels: { 'app.kubernetes.io/name': name } },
        template: {
          metadata: { labels },
          spec: {
            containers: [{
              name,
              image: imageRef(props.image),
              ports: [{ containerPort: props.port }],
              env: Object.entries(props.env ?? {}).map(([key, value]) => ({ name: key, value })),
              resources: {
                requests: {
                  cpu: Quantity.fromString('50m'),
                  memory: Quantity.fromString(props.memoryLimit ?? '64Mi'),
                },
                limits: { memory: Quantity.fromString(props.memoryLimit ?? '256Mi') },
              },
            }],
          },
        },
      },
    });

    new KubeService(this, 'service', {
      metadata: { name, namespace: name, labels },
      spec: {
        selector: { 'app.kubernetes.io/name': name },
        ports: [{ port: 80, targetPort: IntOrString.fromNumber(props.port) }],
      },
    });
  }
}

// Kargo passes the promoted images as IMAGE_REFS, a comma-separated list of <repository>@<digest>.
// Outside a promotion (a local synth) the image falls back to :latest.
function imageRef(repository: string): string {
  const refs = (process.env.IMAGE_REFS ?? '').split(',').map((ref) => ref.trim()).filter(Boolean);
  const ref = refs.find((r) => r.startsWith(`${repository}@`));
  if (ref) {
    return ref;
  }
  if (refs.length > 0) {
    throw new Error(`no promoted image for ${repository}; IMAGE_REFS has ${refs.join(', ')}`);
  }
  return `${repository}:latest`;
}
