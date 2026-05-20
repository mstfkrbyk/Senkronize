import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const service = new PasswordPolicyService();

  it('"Password123!" güçlü şifre kabul edilir', () => {
    const result = service.validatePassword('Password123!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  it('"123456" zayıf şifre reddedilir', () => {
    const result = service.validatePassword('123456');
    expect(result.valid).toBe(false);
    expect(result.strength).toBe('weak');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('"password" yaygın şifre olarak reddedilir', () => {
    const result = service.validatePassword('password');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('yaygın'))).toBe(true);
  });
});
