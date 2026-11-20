// The cdk8s app Kargo renders on every promotion (cdk8s-synth step), once per environment.
// Each service becomes its own folder, which the ApplicationSet turns into an Argo CD Application.
import { App, YamlOutputType } from 'cdk8s';
import { d2cServices } from './teams/d2c/services';

const app = new App({ yamlOutputType: YamlOutputType.FOLDER_PER_CHART_FILE_PER_RESOURCE });
d2cServices(app);
app.synth();
