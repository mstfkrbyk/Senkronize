import {
  countExtraErpSlots,
  effectiveErpSlotLimit,
  EXTRA_ERP_SLOT_ADDON_CODE,
  INCLUDED_ERP_CONNECTION_SLOTS,
  mergeExtraErpSlotAddon,
} from './erp-slot-limit.util';

describe('erp-slot-limit.util', () => {
  it('includes one ERP slot by default', () => {
    expect(
      effectiveErpSlotLimit({
        subscription: { addons: [] },
        isInternalAccount: false,
      }),
    ).toBe(INCLUDED_ERP_CONNECTION_SLOTS);
  });

  it('adds extra slots from subscription addons', () => {
    expect(
      countExtraErpSlots([
        { code: EXTRA_ERP_SLOT_ADDON_CODE, quantity: 2 },
        { code: 'other', quantity: 5 },
      ]),
    ).toBe(2);
    expect(
      effectiveErpSlotLimit({
        subscription: {
          addons: [{ code: EXTRA_ERP_SLOT_ADDON_CODE, quantity: 1 }],
        },
        isInternalAccount: false,
      }),
    ).toBe(INCLUDED_ERP_CONNECTION_SLOTS + 1);
  });

  it('returns null for internal accounts', () => {
    expect(
      effectiveErpSlotLimit({
        subscription: { addons: [] },
        isInternalAccount: true,
      }),
    ).toBeNull();
  });

  it('merges extra ERP slot addons', () => {
    const merged = mergeExtraErpSlotAddon([], 1);
    expect(merged).toEqual([{ code: EXTRA_ERP_SLOT_ADDON_CODE, quantity: 1 }]);
    const again = mergeExtraErpSlotAddon(merged, 2);
    expect(again).toEqual([{ code: EXTRA_ERP_SLOT_ADDON_CODE, quantity: 3 }]);
  });
});
