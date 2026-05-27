import { PostHog } from 'posthog-node';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!client) {
    const key = process.env.POSTHOG_KEY;
    if (!key) return null;

    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST || 'https://eu.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function trackServer(
  userId: string,
  eventName: string,
  properties?: Record<string, unknown>
) {
  const c = getClient();
  if (!c) return;

  c.capture({
    distinctId: userId,
    event: eventName,
    properties,
  });

  await c.shutdown();
  // Reset client after shutdown so next call creates fresh instance
  client = null;
}
