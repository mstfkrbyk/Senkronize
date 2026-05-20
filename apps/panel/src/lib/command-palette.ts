export const COMMAND_PALETTE_EVENT = 'senkronize-open-command-palette';

export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT));
}

/** @deprecated openCommandPalette kullanın */
export const GLOBAL_SEARCH_EVENT = COMMAND_PALETTE_EVENT;

/** @deprecated openCommandPalette kullanın */
export function openGlobalSearch(): void {
  openCommandPalette();
}
