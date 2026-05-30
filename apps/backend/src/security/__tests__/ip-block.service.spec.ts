import { isTrustedLocalIp } from '../ip-block.service';

describe('isTrustedLocalIp', () => {
  it('trusts loopback addresses', () => {
    expect(isTrustedLocalIp('127.0.0.1')).toBe(true);
    expect(isTrustedLocalIp('::1')).toBe(true);
    expect(isTrustedLocalIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('does not trust public IPs', () => {
    expect(isTrustedLocalIp('203.0.113.1')).toBe(false);
  });
});
