import { Injectable } from '@nestjs/common';

import { isCommonPassword } from './common-passwords';

export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
  score: number;
}

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

@Injectable()
export class PasswordPolicyService {
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    if (password.length < 8) {
      errors.push('En az 8 karakter');
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

    if (!/\d/.test(password)) {
      errors.push('En az 1 rakam gerekli');
    } else {
      score += 15;
    }

    if (!SPECIAL_CHAR_REGEX.test(password)) {
      errors.push('En az 1 özel karakter gerekli (!@#$%...)');
    } else {
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

  assertValidPassword(password: string): void {
    const result = this.validatePassword(password);
    if (!result.valid) {
      throw new Error(result.errors[0] ?? 'Şifre politikasına uygun değil');
    }
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
