import crypto from 'node:crypto';

export const PANDORA_MODEL_TRAINING_COOKIE = 'nimbus_pandora_model_training';

const SOURCE = process.env.PANDORA_SOURCE || 'nimbus';

export function modelTrainingAllowed(req) {
  return req.cookies?.[PANDORA_MODEL_TRAINING_COOKIE] !== 'off';
}

export function scopeFor(req) {
  return modelTrainingAllowed(req) ? 'model_training' : 'product_improvement';
}

export function anonymousUserId(req) {
  return req.cookies?.nimbus_sid || req.ip || 'anonymous';
}

export async function trackPandora(req, { type, data = {}, userId, scope }) {
  const endpoint = process.env.PANDORA_URL?.replace(/\/$/, '');
  const keyId = process.env.PANDORA_KEY;
  const secret = process.env.PANDORA_SECRET;
  if (!endpoint || !keyId || !secret) return false;

  const body = JSON.stringify({
    eventId: crypto.randomUUID(),
    source: SOURCE,
    scope: scope || scopeFor(req),
    type,
    userId: String(userId || anonymousUserId(req)),
    sessionId: req.cookies?.nimbus_sid || undefined,
    ts: new Date().toISOString(),
    schemaVersion: 1,
    data,
    context: { sdkVersion: 'nimbus-pandora-adapter-1', lib: 'nimbus/server' },
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = sign(secret, timestamp, body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(`${endpoint}/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-pandora-key': keyId,
        'x-pandora-source': SOURCE,
        'x-pandora-timestamp': timestamp,
        'x-pandora-signature': signature,
      },
      body,
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    console.warn('[pandora]', err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function sign(secret, timestamp, body) {
  const mac = crypto.createHmac('sha256', secret);
  mac.update(`${timestamp}.${body}`);
  return `sha256=${mac.digest('hex')}`;
}
