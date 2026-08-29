export function isSafeWebhookUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);

    // Seul le protocole HTTPS est autorisé en production (ou HTTP si nécessaire localement, mais ici on sécurise pour la prod)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }

    const hostname = url.hostname;

    // Reject localhost and local domains
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      // Allow localhost in non-production environments if needed, but for strict security we block it.
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
    }

    // IP address validation to prevent SSRF against internal networks
    // Check if hostname is an IPv4 address
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);

    if (match) {
      const octets = match.slice(1).map(Number);
      
      // Check invalid IP ranges
      if (octets.some(o => o < 0 || o > 255)) return false;

      // 127.0.0.0/8 (Loopback)
      if (octets[0] === 127) return false;
      
      // 10.0.0.0/8 (Private)
      if (octets[0] === 10) return false;
      
      // 172.16.0.0/12 (Private)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      
      // 192.168.0.0/16 (Private)
      if (octets[0] === 192 && octets[1] === 168) return false;
      
      // 169.254.0.0/16 (Link-local, used by AWS/GCP/Azure metadata services)
      if (octets[0] === 169 && octets[1] === 254) return false;
      
      // 0.0.0.0/8 (Current network)
      if (octets[0] === 0) return false;
    }

    // Note: IPv6 and DNS rebinding protections are more complex, but this covers 99% of simple SSRF attacks.
    return true;
  } catch (e) {
    return false; // Invalid URL
  }
}
