import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';
import type { Queue } from 'bull';

import { PrismaService } from '../../src/prisma/prisma.service';
import { CacheService } from '../../src/common/cache/cache.service';

export function createMockPrisma(): DeepMockProxy<PrismaService> {
  return mockDeep<PrismaService>();
}

export function createMockCache(): DeepMockProxy<CacheService> {
  return mockDeep<CacheService>();
}

export function createMockQueue<T = unknown>(): DeepMockProxy<Queue<T>> {
  return mockDeep<Queue<T>>();
}

/** ioredis benzeri minimal mock */
export function createMockRedis(): {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  publish: jest.Mock;
  quit: jest.Mock;
} {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue('OK'),
  };
}
