import { assertEnvironmentHealthy, cleanupRegressionUsers } from "./support/environment";

export default async function globalSetup() {
  await assertEnvironmentHealthy();
  await cleanupRegressionUsers();
  console.log("[regression] Ambiente saudável: PostgreSQL, aplicação, migrations e endpoints essenciais disponíveis.");
}
