/**
 * Utilitaire léger pour parser un User-Agent et en extraire :
 * - Le navigateur (nom + version)
 * - Le système d'exploitation
 * - Le type d'appareil (Desktop, Mobile, Tablet)
 * 
 * Implémentation sans dépendance externe.
 */

export interface ParsedUserAgent {
  browser: string;
  os: string;
  device: string;
}

export function parseUserAgent(ua: string): ParsedUserAgent {
  if (!ua) {
    return { browser: 'Inconnu', os: 'Inconnu', device: 'Inconnu' };
  }

  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
    device: detectDevice(ua),
  };
}

function detectBrowser(ua: string): string {
  // Order matters — more specific patterns first

  // Edge (Chromium-based)
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/(\d+[\d.]*)/);
  if (edgeMatch) return `Microsoft Edge ${edgeMatch[1]}`;

  // Opera / OPR
  const operaMatch = ua.match(/(?:OPR|Opera)\/(\d+[\d.]*)/);
  if (operaMatch) return `Opera ${operaMatch[1]}`;

  // Samsung Internet
  const samsungMatch = ua.match(/SamsungBrowser\/(\d+[\d.]*)/);
  if (samsungMatch) return `Samsung Internet ${samsungMatch[1]}`;

  // Brave (identifies as Chrome but with "Brave" in UA sometimes)
  if (ua.includes('Brave')) {
    const braveMatch = ua.match(/Brave\/(\d+[\d.]*)/);
    return braveMatch ? `Brave ${braveMatch[1]}` : 'Brave';
  }

  // Vivaldi
  const vivaldiMatch = ua.match(/Vivaldi\/(\d+[\d.]*)/);
  if (vivaldiMatch) return `Vivaldi ${vivaldiMatch[1]}`;

  // Firefox
  const firefoxMatch = ua.match(/Firefox\/(\d+[\d.]*)/);
  if (firefoxMatch) return `Firefox ${firefoxMatch[1]}`;

  // Chrome (must be after Edge, Opera, Samsung, Brave, Vivaldi)
  const chromeMatch = ua.match(/Chrome\/(\d+[\d.]*)/);
  if (chromeMatch && !ua.includes('Chromium')) return `Chrome ${chromeMatch[1]}`;

  // Chromium
  const chromiumMatch = ua.match(/Chromium\/(\d+[\d.]*)/);
  if (chromiumMatch) return `Chromium ${chromiumMatch[1]}`;

  // Safari (must be after Chrome)
  const safariMatch = ua.match(/Version\/(\d+[\d.]*).*Safari/);
  if (safariMatch) return `Safari ${safariMatch[1]}`;

  // Mobile Safari without Version
  if (ua.includes('Safari') && ua.includes('Mobile')) return 'Safari Mobile';

  // Curl, bots, etc.
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('PostmanRuntime')) return 'Postman';

  return 'Navigateur inconnu';
}

function detectOS(ua: string): string {
  // iOS
  const iosMatch = ua.match(/iPhone OS (\d+[_\d]*)/);
  if (iosMatch) return `iOS ${iosMatch[1].replace(/_/g, '.')}`;

  const ipadMatch = ua.match(/iPad.*OS (\d+[_\d]*)/);
  if (ipadMatch) return `iPadOS ${ipadMatch[1].replace(/_/g, '.')}`;

  // Android
  const androidMatch = ua.match(/Android (\d+[\d.]*)/);
  if (androidMatch) return `Android ${androidMatch[1]}`;

  // Windows
  const windowsMatch = ua.match(/Windows NT (\d+\.\d+)/);
  if (windowsMatch) {
    const version = windowsMatch[1];
    const windowsVersionMap: Record<string, string> = {
      '10.0': 'Windows 10/11',
      '6.3': 'Windows 8.1',
      '6.2': 'Windows 8',
      '6.1': 'Windows 7',
      '6.0': 'Windows Vista',
      '5.1': 'Windows XP',
    };
    return windowsVersionMap[version] || `Windows NT ${version}`;
  }

  // macOS
  const macMatch = ua.match(/Mac OS X (\d+[_\d]*)/);
  if (macMatch) return `macOS ${macMatch[1].replace(/_/g, '.')}`;

  // Linux distros
  if (ua.includes('Ubuntu')) return 'Ubuntu Linux';
  if (ua.includes('Fedora')) return 'Fedora Linux';
  if (ua.includes('Linux')) return 'Linux';

  // ChromeOS
  if (ua.includes('CrOS')) return 'Chrome OS';

  return 'OS inconnu';
}

function detectDevice(ua: string): string {
  // Tablets first (before mobile, as some tablets include "Mobile")
  if (ua.includes('iPad') || (ua.includes('Android') && !ua.includes('Mobile'))) {
    return 'Tablette';
  }

  // Mobile
  if (
    ua.includes('Mobile') ||
    ua.includes('iPhone') ||
    ua.includes('Android') ||
    ua.includes('webOS') ||
    ua.includes('BlackBerry') ||
    ua.includes('Opera Mini') ||
    ua.includes('IEMobile')
  ) {
    return 'Mobile';
  }

  return 'Desktop';
}
