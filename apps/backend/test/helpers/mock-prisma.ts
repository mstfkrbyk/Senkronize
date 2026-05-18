import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { PrismaService } from '../../src/prisma/prisma.service';

export function createMockPrisma(): DeepMockProxy<PrismaService> {
  return mockDeep<PrismaService>();
}
