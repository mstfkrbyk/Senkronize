import { Prisma } from '@prisma/client';

import type { ProductFilters, ProductQueryDto } from './product.dto';

export function buildProductFilterWhere(
  organizationId: string,
  query: ProductQueryDto | ProductFilters = {},
): Prisma.ProductWhereInput {
  const andClauses: Prisma.ProductWhereInput[] = [];

  const priceRange =
    query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
          ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
        }
      : undefined;

  const stockRange =
    query.minStock !== undefined || query.maxStock !== undefined
      ? {
          ...(query.minStock !== undefined ? { gte: query.minStock } : {}),
          ...(query.maxStock !== undefined ? { lte: query.maxStock } : {}),
        }
      : undefined;

  if (query.search) {
    andClauses.push({
      OR: [
        {
          name: {
            contains: query.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          barcode: {
            contains: query.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          sku: {
            contains: query.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      ],
    });
  }

  if (priceRange) {
    andClauses.push({
      OR: [
        {
          variants: {
            some: {
              deletedAt: null,
              price: priceRange,
            },
          },
        },
        {
          listings: {
            some: {
              deletedAt: null,
              salePrice: priceRange,
            },
          },
        },
      ],
    });
  }

  const costQuery = query as ProductQueryDto;
  const costRange =
    costQuery.minCostPrice !== undefined || costQuery.maxCostPrice !== undefined
      ? {
          ...(costQuery.minCostPrice !== undefined
            ? { gte: costQuery.minCostPrice }
            : {}),
          ...(costQuery.maxCostPrice !== undefined
            ? { lte: costQuery.maxCostPrice }
            : {}),
        }
      : undefined;

  return {
    organizationId,
    deletedAt: null,
    ...(andClauses.length > 0 && { AND: andClauses }),
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...('category' in query &&
      query.category !== undefined && { category: query.category }),
    ...(query.categoryId !== undefined && { categoryId: query.categoryId }),
    ...(costRange && { costPrice: costRange }),
    ...(stockRange && {
      variants: {
        some: {
          deletedAt: null,
          stock: stockRange,
        },
      },
    }),
    ...(query.hasVariants === true && {
      variants: { some: { deletedAt: null } },
    }),
    ...(query.hasVariants === false && {
      variants: { none: { deletedAt: null } },
    }),
    ...(query.platform && {
      listings: {
        some: {
          deletedAt: null,
          platform: query.platform,
        },
      },
    }),
  };
}
