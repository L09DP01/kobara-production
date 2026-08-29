export async function verifyTurnstileToken(
  token?: string | null,
  ip?: string
): Promise<{ success: boolean; error?: string }> {
  // If no token is provided
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { success: false, error: 'Vérification humaine requise. Veuillez valider le captcha.' };
  }

  // Cloudflare test tokens must never bypass verification in production.
  if (
    process.env.NODE_ENV !== 'production' &&
    (token === '1x00000000000000000000AA' || token === 'XXXX.DUMMY.TOKEN.XXXX')
  ) {
    return { success: true };
  }

  const configuredSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  const secretKey =
    configuredSecretKey ||
    (process.env.NODE_ENV !== 'production'
      ? '1x0000000000000000000000000000000AA'
      : '');

  if (!secretKey) {
    console.error('TURNSTILE_SECRET_KEY is not configured.');
    return {
      success: false,
      error: "La vérification humaine n'est pas configurée. Veuillez contacter le support.",
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token.trim());
    if (ip) formData.append('remoteip', ip);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = await res.json();
    if (data.success) {
      return { success: true };
    }

    console.warn("Turnstile verification failed:", data);
    return { success: false, error: "La vérification humaine a échoué. Veuillez réessayer." };
  } catch (err) {
    console.error("Turnstile verification error:", err);
    if (process.env.NODE_ENV !== 'production' && secretKey.startsWith('1x000000')) {
      return { success: true };
    }
    return { success: false, error: "Impossible de vérifier la présence humaine pour le moment." };
  }
}
