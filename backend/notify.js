// Simple notification helper: webhook or email stub (ESM)
export async function sendNotification({ webhookUrl, subject, payload }) {
  if (webhookUrl) {
    try {
      const fetcher = global.fetch ? global.fetch.bind(global) : (await import('node-fetch')).default;
      await fetcher(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, payload }) });
      return { ok: true };
    } catch (err) {
      console.warn('Webhook send failed', err?.message || err);
      return { ok: false, error: err };
    }
  }
  // Email stub: log to console
  console.log('Notification (stub):', subject, payload);
  return { ok: true, stub: true };
}
