import { SetMetadata } from '@nestjs/common';

import { Permission } from './permissions';

export const PERMISSION_KEY = 'requiredPermission';

export const RequiresPermission = (
  permission: Permission,
): ReturnType<typeof SetMetadata> =>
  SetMetadata(PERMISSION_KEY, permission);
