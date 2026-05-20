export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
}

export function modKeyLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl';
}

export function formatShortcut(keys: string): string {
  const mod = modKeyLabel();
  return keys
    .replace(/\bcmd\b/gi, mod)
    .replace(/\bctrl\b/gi, 'Ctrl')
    .split('+')
    .map((part) => part.trim())
    .join(isMacPlatform() ? '' : '+');
}
