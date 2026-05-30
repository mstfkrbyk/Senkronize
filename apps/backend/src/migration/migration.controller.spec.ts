import type { CurrentOrgPayload } from '../auth/current-org.decorator';

import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import type { MigrationHistoryItem } from './migration.types';

describe('MigrationController', () => {
  const orgId = 'org-aaaaaaaa';

  describe('getHistory', () => {
    it('JWT org ile getImportHistory çağırıp listeyi döner', async () => {
      const history: MigrationHistoryItem[] = [];
      const getImportHistory = jest.fn().mockResolvedValue(history);
      const migrationService = { getImportHistory } as unknown as MigrationService;

      const controller = new MigrationController(migrationService);
      const org: CurrentOrgPayload = { id: orgId, isImpersonating: false };
      const result = await controller.getHistory(org);

      expect(getImportHistory).toHaveBeenCalledWith(orgId);
      expect(result).toEqual([]);
    });
  });
});
