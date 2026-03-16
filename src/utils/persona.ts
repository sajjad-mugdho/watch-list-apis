import crypto from 'crypto';
import { config } from '../config';

/**
 * Verify Persona webhook signature
 * Persona signs webhooks with HMAC-SHA256
 */
export function verifyPersonaWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined | string[]
): boolean {
  if (!signatureHeader || Array.isArray(signatureHeader)) return false;

  // Persona sends: t=timestamp,v1=signature
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('='))
  );

  const timestamp = parts['t'];
  const receivedSig = parts['v1'];

  if (!timestamp || !receivedSig) return false;

  // Replay attack protection — reject if older than 5 minutes
  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (diff > 300) {
    return false;
  }

  // Compute expected signature
  const payload = `${timestamp}.${rawBody}`;
  const expectedSig = crypto
    .createHmac('sha256', config.persona.webhookSecret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Map Persona inquiry status to our internal status
 */
export function mapPersonaStatus(
  status: string
): 'verified' | 'failed' | 'pending' | 'expired' {
  switch (status) {
    case 'approved':
      return 'verified';
    case 'declined':
    case 'failed':
      return 'failed';
    case 'expired':
      return 'expired';
    default:
      return 'pending';
  }
}
