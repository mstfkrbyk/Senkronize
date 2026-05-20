import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateHelpArticleDto, HelpArticleQueryDto } from './help.dto';
import type {
  HelpArticleDetailDto,
  HelpArticleListItemDto,
} from './help.types';

@Injectable()
export class HelpService {
  constructor(private readonly prisma: PrismaService) {}

  private mapListItem(article: {
    id: string;
    title: string;
    slug: string;
    category: string;
    tags: string[];
    views: number;
    helpful: number;
    createdAt: Date;
    updatedAt: Date;
  }): HelpArticleListItemDto {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      category: article.category,
      tags: article.tags,
      views: article.views,
      helpful: article.helpful,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };
  }

  async listPublished(
    filters: HelpArticleQueryDto,
  ): Promise<{ data: HelpArticleListItemDto[] }> {
    const where: Prisma.HelpArticleWhereInput = {
      isPublished: true,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { content: { contains: filters.search, mode: 'insensitive' } },
              { tags: { has: filters.search } },
            ],
          }
        : {}),
    };

    const articles = await this.prisma.helpArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        tags: true,
        views: true,
        helpful: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { data: articles.map((a) => this.mapListItem(a)) };
  }

  async getBySlug(slug: string): Promise<HelpArticleDetailDto> {
    const article = await this.prisma.helpArticle.findFirst({
      where: { slug, isPublished: true },
    });
    if (!article) {
      throw new NotFoundException('Yardım makalesi bulunamadı');
    }

    const updated = await this.prisma.helpArticle.update({
      where: { id: article.id },
      data: { views: { increment: 1 } },
    });

    return {
      ...this.mapListItem(updated),
      content: updated.content,
    };
  }

  async markHelpful(slug: string): Promise<{ helpful: number }> {
    const article = await this.prisma.helpArticle.findFirst({
      where: { slug, isPublished: true },
    });
    if (!article) {
      throw new NotFoundException('Yardım makalesi bulunamadı');
    }

    const updated = await this.prisma.helpArticle.update({
      where: { id: article.id },
      data: { helpful: { increment: 1 } },
      select: { helpful: true },
    });

    return { helpful: updated.helpful };
  }

  async create(dto: CreateHelpArticleDto): Promise<HelpArticleDetailDto> {
    const existing = await this.prisma.helpArticle.findUnique({
      where: { slug: dto.slug.trim() },
    });
    if (existing) {
      throw new ConflictException('Bu slug zaten kullanılıyor');
    }

    const article = await this.prisma.helpArticle.create({
      data: {
        title: dto.title.trim(),
        slug: dto.slug.trim(),
        content: dto.content.trim(),
        category: dto.category.trim(),
        tags: dto.tags ?? [],
        isPublished: dto.isPublished === true,
      },
    });

    return {
      ...this.mapListItem(article),
      content: article.content,
    };
  }
}
