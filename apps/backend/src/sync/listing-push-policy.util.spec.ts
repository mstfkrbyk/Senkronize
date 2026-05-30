import {
  isPricePushEnabled,
  isStockPushEnabled,
} from './listing-push-policy.util';

describe('listing push policy', () => {
  const connOn = { pushStock: true, pushPrice: true };
  const connOff = { pushStock: false, pushPrice: false };

  it('respects connection stock toggle', () => {
    expect(isStockPushEnabled(connOn)).toBe(true);
    expect(isStockPushEnabled(connOff)).toBe(false);
  });

  it('respects product stock override', () => {
    expect(isStockPushEnabled(connOn, { pushStockEnabled: false, pushPriceEnabled: null })).toBe(
      false,
    );
    expect(isStockPushEnabled(connOn, { pushStockEnabled: null, pushPriceEnabled: null })).toBe(
      true,
    );
  });

  it('respects connection price toggle', () => {
    expect(isPricePushEnabled(connOn)).toBe(true);
    expect(isPricePushEnabled(connOff)).toBe(false);
  });

  it('respects product price override', () => {
    expect(isPricePushEnabled(connOn, { pushStockEnabled: null, pushPriceEnabled: false })).toBe(
      false,
    );
  });
});
