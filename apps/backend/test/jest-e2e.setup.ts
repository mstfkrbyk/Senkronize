import { truncateAllTables } from './setup';

afterEach(async () => {
  await truncateAllTables();
});
