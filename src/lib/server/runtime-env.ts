import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getRuntimeEnvironmentValue(name: string): string {
  try {
    const env = getCloudflareContext().env as Partial<Record<string, unknown>>;
    const value = env[name];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  } catch {
    // Cloudflare request bindings are unavailable during local builds and Node.js tests.
  }

  return process.env[name]?.trim() || '';
}
