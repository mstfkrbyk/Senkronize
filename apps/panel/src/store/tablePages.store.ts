import { create } from 'zustand';

interface ListingsPageState {
  selectedListingIds: string[];
  setSelectedListingIds: (ids: string[]) => void;
  toggleListingRow: (id: string, selected: boolean) => void;
  toggleAllOnPage: (pageIds: string[], selected: boolean) => void;
  clearListingSelection: () => void;
}

export const useListingsPageStore = create<ListingsPageState>((set, get) => ({
  selectedListingIds: [],
  setSelectedListingIds: (ids) => set({ selectedListingIds: ids }),
  toggleListingRow: (id, selected) => {
    const prev = get().selectedListingIds;
    const setIds = new Set(prev);
    if (selected) {
      setIds.add(id);
    } else {
      setIds.delete(id);
    }
    set({ selectedListingIds: [...setIds] });
  },
  toggleAllOnPage: (pageIds, selected) => {
    const prev = new Set(get().selectedListingIds);
    for (const id of pageIds) {
      if (selected) {
        prev.add(id);
      } else {
        prev.delete(id);
      }
    }
    set({ selectedListingIds: [...prev] });
  },
  clearListingSelection: () => set({ selectedListingIds: [] }),
}));

interface OrdersPageState {
  selectedOrderIds: string[];
  setSelectedOrderIds: (ids: string[]) => void;
  toggleOrderRow: (id: string, selected: boolean) => void;
  toggleAllOrdersOnPage: (pageIds: string[], selected: boolean) => void;
  clearOrderSelection: () => void;
}

export const useOrdersPageStore = create<OrdersPageState>((set, get) => ({
  selectedOrderIds: [],
  setSelectedOrderIds: (ids) => set({ selectedOrderIds: ids }),
  toggleOrderRow: (id, selected) => {
    const prev = get().selectedOrderIds;
    const setIds = new Set(prev);
    if (selected) {
      setIds.add(id);
    } else {
      setIds.delete(id);
    }
    set({ selectedOrderIds: [...setIds] });
  },
  toggleAllOrdersOnPage: (pageIds, selected) => {
    const prev = new Set(get().selectedOrderIds);
    for (const id of pageIds) {
      if (selected) {
        prev.add(id);
      } else {
        prev.delete(id);
      }
    }
    set({ selectedOrderIds: [...prev] });
  },
  clearOrderSelection: () => set({ selectedOrderIds: [] }),
}));
