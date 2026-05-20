import { PasswordPolicyService } from '../password-policy.service';

describe('PasswordPolicyService', () => {
  const service = new PasswordPolicyService();

  it('güçlü şifreyi geçerli saymalı', () => {
    const result = service.validatePassword('Guvenli!Sifre9');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('yaygın şifreyi reddetmeli', () => {
    const result = service.validatePassword('password123');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('yaygın'))).toBe(true);
  });

  it('eksik kuralları listelemeli', () => {
    const result = service.validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.strength).toBe('weak');
  });
});
