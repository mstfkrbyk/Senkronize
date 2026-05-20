import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const prisma = {
    organization: { findFirst: jest.fn() },
    passwordHistory: { findMany: jest.fn() },
  };
  const service = new PasswordPolicyService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue(null);
  });

  it('"Password123!" güçlü şifre kabul edilir', () => {
    const result = service.validatePassword('Password123!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(['strong', 'very-strong']).toContain(result.strength);
  });

  it('"123456" zayıf şifre reddedilir', () => {
    const result = service.validatePassword('123456');
    expect(result.valid).toBe(false);
    expect(result.strength).toBe('weak');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('minimum 8 karakter kuralı uygulanır', () => {
    const result = service.validatePassword('Pass1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('En az 8 karakter');
  });

  it('büyük harf zorunluluğu uygulanır', () => {
    const result = service.validatePassword('password123!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('En az 1 büyük harf gerekli');
  });

  it('kurumsal minLength politikası uygulanır', () => {
    const result = service.validatePassword('Pass1!', {
      minLength: 12,
      requireSpecial: true,
      requireNumber: true,
      maxAgeDays: 90,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('En az 12 karakter');
  });

  it('şifre yaşı zorunlu değişim durumunu hesaplar', () => {
    const old = new Date();
    old.setDate(old.getDate() - 100);
    const status = service.getPasswordAgeStatus(old, old, 90);
    expect(status.mustChange).toBe(true);
  });
});
