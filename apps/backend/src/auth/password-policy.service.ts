import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { isCommonPassword } from './common-passwords';

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface OrgPasswordPolicy {
  minLength: number;
  requireSpecial: boolean;
  requireNumber: boolean;
  maxAgeDays: number;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
  score: number;
}

export interface PasswordAgeStatus {
  passwordChangedAt: Date | null;
  maxAgeDays: number;
  daysSinceChange: number | null;
  mustChange: boolean;
  warning: boolean;
}

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;
const DEFAULT_POLICY: OrgPasswordPolicy = {
  minLength: 8,
  requireSpecial: true,
  requireNumber: true,
  maxAgeDays: 90,
};
const PASSWORD_HISTORY_LIMIT = 5;

@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgPolicy(organizationId: string): Promise<OrgPasswordPolicy> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: {
        passwordMinLength: true,
        passwordRequireSpecial: true,
        passwordRequireNumber: true,
        passwordMaxAgeDays: true,
      },
    });
    if (!org) {
      return DEFAULT_POLICY;
    }
    return {
      minLength: org.passwordMinLength,
      requireSpecial: org.passwordRequireSpecial,
      requireNumber: org.passwordRequireNumber,
      maxAgeDays: org.passwordMaxAgeDays,
    };
  }

  validatePassword(
    password: string,
    policy: OrgPasswordPolicy = DEFAULT_POLICY,
  ): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    if (password.length < policy.minLength) {
      errors.push(`En az ${policy.minLength} karakter`);
    } else {
      score += 15;
      if (password.length >= 12) {
        score += 10;
      }
      if (password.length >= 16) {
        score += 5;
      }
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('En az 1 büyük harf gerekli');
    } else {
      score += 15;
    }

    if (!/[a-z]/.test(password)) {
      errors.push('En az 1 küçük harf gerekli');
    } else {
      score += 15;
    }

    if (policy.requireNumber && !/\d/.test(password)) {
      errors.push('En az 1 rakam gerekli');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    if (policy.requireSpecial && !SPECIAL_CHAR_REGEX.test(password)) {
      errors.push('En az 1 özel karakter gerekli (!@#$%...)');
    } else if (SPECIAL_CHAR_REGEX.test(password)) {
      score += 15;
    }

    if (isCommonPassword(password)) {
      errors.push('Bu şifre çok yaygın; daha benzersiz bir şifre seçin');
      score = Math.min(score, 25);
    } else {
      score += 10;
    }

    const uniqueChars = new Set(password).size;
    if (uniqueChars >= 8) {
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    const strength = this.scoreToStrength(score, errors.length > 0);

    return {
      valid: errors.length === 0,
      errors,
      strength,
      score,
    };
  }

  async assertValidPasswordForOrg(
    organizationId: string,
    password: string,
  ): Promise<void> {
    const policy = await this.getOrgPolicy(organizationId);
    const result = this.validatePassword(password, policy);
    if (!result.valid) {
      throw new BadRequestException(result.errors[0] ?? 'Şifre politikasına uygun değil');
    }
  }

  async assertNotReusedPassword(
    userId: string,
    currentPasswordHash: string,
    newPassword: string,
  ): Promise<void> {
    const histories = await this.prisma.passwordHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_LIMIT,
      select: { passwordHash: true },
    });

    const bcrypt = await import('bcrypt');
    const candidates = [currentPasswordHash, ...histories.map((h) => h.passwordHash)];
    for (const hash of candidates) {
      const match = await bcrypt.compare(newPassword, hash);
      if (match) {
        throw new BadRequestException(
          'Bu şifre daha önce kullanılmış. Son 5 şifreden farklı bir şifre seçin.',
        );
      }
    }
  }

  async recordPasswordChange(userId: string, oldPasswordHash: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.passwordHistory.create({
        data: { userId, passwordHash: oldPasswordHash },
      });
      const excess = await tx.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: PASSWORD_HISTORY_LIMIT,
        select: { id: true },
      });
      if (excess.length > 0) {
        await tx.passwordHistory.deleteMany({
          where: { id: { in: excess.map((e) => e.id) } },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { passwordChangedAt: new Date() },
      });
    });
  }

  getPasswordAgeStatus(
    passwordChangedAt: Date | null,
    createdAt: Date,
    maxAgeDays: number,
  ): PasswordAgeStatus {
    const reference = passwordChangedAt ?? createdAt;
    const daysSinceChange = Math.floor(
      (Date.now() - reference.getTime()) / (24 * 60 * 60 * 1000),
    );
    const mustChange = daysSinceChange >= maxAgeDays;
    const warning = !mustChange && daysSinceChange >= maxAgeDays - 14;

    return {
      passwordChangedAt,
      maxAgeDays,
      daysSinceChange,
      mustChange,
      warning,
    };
  }

  private scoreToStrength(
    score: number,
    hasErrors: boolean,
  ): PasswordStrength {
    if (hasErrors || score < 40) {
      return 'weak';
    }
    if (score < 60) {
      return 'medium';
    }
    if (score < 80) {
      return 'strong';
    }
    return 'very-strong';
  }
}
