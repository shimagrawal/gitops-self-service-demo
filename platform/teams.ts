// Owned by the platform (Infra) team. Every product team and its boundaries. Onboarding a team is
// one entry here; its AppProject is generated from it (npm run platform).

export interface Team {
  /** Every namespace the team deploys to must start with this prefix. */
  readonly namespacePrefix: string;
  /** SSO groups that get the team's developer role in Argo CD. */
  readonly ssoGroups: readonly string[];
}

export const TEAMS = {
  d2c: { namespacePrefix: 'd2c-', ssoGroups: ['kargo-developers'] },
} as const satisfies Record<string, Team>;

export type TeamName = keyof typeof TEAMS;
