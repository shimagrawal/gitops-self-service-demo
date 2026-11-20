// Owned by the platform (Infra) team. Every environment, the cluster it runs on and how releases
// reach it. The WorkloadApp construct and the generated AppProject read this file, so adding an
// environment is a change here, not in every team's code.

export interface Environment {
  /** Argo CD cluster name the environment deploys to. */
  readonly cluster: string;
  /** Kargo shard (agent) that runs this environment's promotions. */
  readonly shard: string;
  /** Default replica count for a service, unless the service overrides it. */
  readonly replicas: number;
}

export const ENVIRONMENTS = {
  dev: { cluster: 'kargo-quickstart', shard: 'self-hosted', replicas: 1 },
  staging: { cluster: 'cluster-uat', shard: 'self-hosted-uat', replicas: 1 },
  prod: { cluster: 'cluster-prod', shard: 'self-hosted-prod', replicas: 2 },
} as const satisfies Record<string, Environment>;

export type EnvironmentName = keyof typeof ENVIRONMENTS;

/** The environment being rendered. Kargo sets ENVIRONMENT to the Stage name. */
export function currentEnvironment(): EnvironmentName {
  const name = process.env.ENVIRONMENT ?? 'dev';
  if (!(name in ENVIRONMENTS)) {
    throw new Error(`ENVIRONMENT=${name} is not one of ${Object.keys(ENVIRONMENTS).join(', ')}`);
  }
  return name as EnvironmentName;
}
