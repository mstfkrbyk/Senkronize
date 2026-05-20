import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/** Zod 4 şemaları için react-hook-form resolver (standard-schema uyumlu). */
export function zodFormResolver<T extends FieldValues>(
  schema: z.ZodType<T>,
): Resolver<T> {
  return standardSchemaResolver(
    schema as Parameters<typeof standardSchemaResolver>[0],
  ) as Resolver<T>;
}
