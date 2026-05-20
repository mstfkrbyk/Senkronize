import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const service = new PasswordPolicyService();

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
});
