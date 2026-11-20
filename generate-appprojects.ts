// Generates each team's Argo CD AppProject from platform/ into argocd/generated/.
// Run `npm run platform` after changing platform/ and commit the result; argocd/generated/ is
// applied to the Argo CD instance with `akuity argocd apply`.
import { ApiObject, App, Chart, YamlOutputType } from 'cdk8s';
import { ENVIRONMENTS, GIT_REPO, TEAMS } from './platform/index';

const app = new App({ outdir: 'argocd/generated', yamlOutputType: YamlOutputType.FILE_PER_CHART });

for (const [team, config] of Object.entries(TEAMS)) {
  const chart = new Chart(app, `appproject-${team}`);
  new ApiObject(chart, 'appproject', {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'AppProject',
    metadata: { name: team, namespace: 'argocd' },
    spec: {
      description: `Generated from platform/teams.ts for team ${team}`,
      sourceRepos: [GIT_REPO],
      // Only the team's own namespaces, on every environment's cluster.
      destinations: Object.values(ENVIRONMENTS).map((env) => ({
        name: env.cluster,
        namespace: `${config.namespacePrefix}*`,
      })),
      // The only cluster-scoped kind a team may create is its namespaces. ClusterRoles,
      // ClusterRoleBindings, CRDs and webhooks are refused.
      clusterResourceWhitelist: [{ group: '', kind: 'Namespace' }],
      // Developers can view, sync, run actions and read logs on their team's Applications. They
      // cannot delete them, override what is deployed or edit the project.
      roles: [{
        name: 'developer',
        groups: [...config.ssoGroups],
        policies: [
          `p, proj:${team}:developer, applications, get, ${team}/*, allow`,
          `p, proj:${team}:developer, applications, sync, ${team}/*, allow`,
          `p, proj:${team}:developer, applications, action/*, ${team}/*, allow`,
          `p, proj:${team}:developer, logs, get, ${team}/*, allow`,
        ],
      }],
    },
  });
}

app.synth();
