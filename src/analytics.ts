import { PostHog } from 'posthog-node';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import Store from 'electron-store';

declare const __POSTHOG_API_KEY__: string;
declare const __POSTHOG_HOST__: string;

const analyticsStore = new Store<{ id: string; enabled: boolean }>({
  name: 'analytics',
  defaults: { id: '', enabled: true },
});

let client: PostHog | null = null;
let anonymousUserId = '';

function sanitizeStack(stack?: string): string | undefined {
  if (!stack) return undefined;
  return stack.replace(/\/Users\/[^/]+/g, '/Users/<redacted>');
}

export function isAnalyticsEnabled(): boolean {
  return analyticsStore.get('enabled');
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  analyticsStore.set('enabled', enabled);
  if (enabled) {
    initAnalytics();
  } else {
    await shutdownAnalytics();
  }
}

export function initAnalytics(): void {
  try {
    if (!__POSTHOG_API_KEY__ || !__POSTHOG_HOST__) return;
    if (!analyticsStore.get('enabled')) return;

    const isFirstRun = !analyticsStore.get('id');
    if (isFirstRun) {
      anonymousUserId = randomUUID();
      analyticsStore.set('id', anonymousUserId);
    } else {
      anonymousUserId = analyticsStore.get('id');
    }

    client = new PostHog(__POSTHOG_API_KEY__, {
      host: __POSTHOG_HOST__,
      flushAt: 1,
      flushInterval: 0,
    });

    const appVersion = app.getVersion();
    const osVersion = `${os.platform()} ${os.release()}`;

    if (isFirstRun) {
      client.capture({
        distinctId: anonymousUserId,
        event: 'first_run',
        properties: { app_version: appVersion, os_version: osVersion },
      });
    }

    client.capture({
      distinctId: anonymousUserId,
      event: 'app_open',
      properties: { app_version: appVersion, os_version: osVersion },
    });
  } catch {
    client = null;
  }
}

export function captureAppClosed(): void {
  if (!client) return;
  try {
    client.capture({
      distinctId: anonymousUserId,
      event: 'app_closed',
      properties: { app_version: app.getVersion() },
    });
  } catch { /* analytics should never crash the app */ }
}

export function captureException(error: Error, source: 'main' | 'renderer'): void {
  if (!client) return;
  try {
    const sanitized = new Error(error.message);
    sanitized.name = error.name;
    sanitized.stack = sanitizeStack(error.stack);
    client.captureException(sanitized, anonymousUserId, {
      error_source: source,
      app_version: app.getVersion(),
      os_version: `${os.platform()} ${os.release()}`,
    });
  } catch { /* analytics should never crash the app */ }
}

export function captureAppUpdated(newVersion: string): void {
  if (!client) return;
  try {
    client.capture({
      distinctId: anonymousUserId,
      event: 'app_updated',
      properties: { app_version: app.getVersion(), new_app_version: newVersion },
    });
  } catch { /* analytics should never crash the app */ }
}

export function captureRendererCrash(reason: string, exitCode: number): void {
  if (!client) return;
  try {
    client.capture({
      distinctId: anonymousUserId,
      event: 'renderer_crash',
      properties: {
        app_version: app.getVersion(),
        os_version: `${os.platform()} ${os.release()}`,
        reason,
        exit_code: exitCode,      },
    });
  } catch { /* analytics should never crash the app */ }
}

const SHUTDOWN_TIMEOUT_MS = 2000;

export async function shutdownAnalytics(): Promise<void> {
  if (!client) return;
  try {
    await Promise.race([
      client.shutdown(),
      new Promise((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);
  } catch { /* best effort */ }
  client = null;
}
