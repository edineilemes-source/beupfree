import { cleanupRegressionUsers } from "./support/environment";

export default async function globalTeardown() {
  await cleanupRegressionUsers();
}
