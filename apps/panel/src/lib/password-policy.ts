export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: PasswordStrength;
  score: number;
  rules: Array<PasswordRule & { passed: boolean }>;
}

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  'qwerty',
  'qwerty123',
  'admin',
  'admin123',
  'letmein',
  'welcome',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'mustang',
  'access',
  'shadow',
  'sunshine',
  'princess',
  'login',
  'passw0rd',
  'senkronize1',
  'turkiye',
  'istanbul',
  'merhaba',
  'sifre123',
  'deneme123',
  'test123',
  'changeme',
  'secret123',
  'p@ssw0rd',
  'galatasaray',
  'fenerbahce',
  'besiktas',
]);

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    label: 'En az 8 karakter',
    test: (p) => p.length >= 8,
  },
  {
    id: 'upper',
    label: 'En az 1 büyük harf',
    test: (p) => /[A-Z]/.test(p),
  },
  {
    id: 'lower',
    label: 'En az 1 küçük harf',
    test: (p) => /[a-z]/.test(p),
  },
  {
    id: 'digit',
    label: 'En az 1 rakam',
    test: (p) => /\d/.test(p),
  },
  {
    id: 'special',
    label: 'En az 1 özel karakter (!@#$%...)',
    test: (p) => SPECIAL_CHAR_REGEX.test(p),
  },
  {
    id: 'common',
    label: 'Yaygın şifre listesinde değil',
    test: (p) => !COMMON_PASSWORDS.has(p.toLowerCase()),
  },
];

function scoreToStrength(score: number, hasErrors: boolean): PasswordStrength {
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

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;

  const rules = PASSWORD_RULES.map((rule) => {
    const passed = rule.test(password);
    if (!passed) {
      errors.push(rule.label);
    }
    return { ...rule, passed };
  });

  if (password.length >= 8) {
    score += 15;
    if (password.length >= 12) {
      score += 10;
    }
    if (password.length >= 16) {
      score += 5;
    }
  }
  if (/[A-Z]/.test(password)) {
    score += 15;
  }
  if (/[a-z]/.test(password)) {
    score += 15;
  }
  if (/\d/.test(password)) {
    score += 15;
  }
  if (SPECIAL_CHAR_REGEX.test(password)) {
    score += 15;
  }
  if (!COMMON_PASSWORDS.has(password.toLowerCase())) {
    score += 10;
  } else {
    score = Math.min(score, 25);
  }
  if (new Set(password).size >= 8) {
    score += 5;
  }

  score = Math.min(100, Math.max(0, score));

  return {
    valid: errors.length === 0,
    errors,
    strength: scoreToStrength(score, errors.length > 0),
    score,
    rules,
  };
}

export function strengthBarColor(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'bg-red-500';
    case 'medium':
      return 'bg-orange-500';
    case 'strong':
      return 'bg-yellow-500';
    case 'very-strong':
      return 'bg-green-500';
    default:
      return 'bg-muted';
  }
}

export function strengthLabel(strength: PasswordStrength): string {
  switch (strength) {
    case 'weak':
      return 'Zayıf';
    case 'medium':
      return 'Orta';
    case 'strong':
      return 'Güçlü';
    case 'very-strong':
      return 'Çok güçlü';
    default:
      return '';
  }
}
