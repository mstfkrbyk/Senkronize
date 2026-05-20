export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission === 'denied') {
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showDesktopNotification(title: string, body: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }
  new Notification(title, { body });
}
