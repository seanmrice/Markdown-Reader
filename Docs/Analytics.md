# Why we track, what we track and how we track it

## Why we track

We track these events and properties to help us understand how the application is used and to help us improve the application.

## What we track

### Events
- `first_run`: Triggered when the application is first run.
- `app_open`: Triggered when the application is opened.
- `app_closed`: Triggered when the application is closed.
- `$exception`: Triggered when an uncaught exception or unhandled rejection occurs (captured via PostHog's native error tracking).
- `renderer_crash`: Triggered when the renderer process crashes.
- `app_updated`: Triggered when the application is updated.

### Properties

**Sent on all events:**
- `app_version`: The version of the application.

**Sent on `first_run`, `app_open`, `$exception`, and `renderer_crash`:**
- `os_version`: The version of the operating system (e.g. `darwin 25.5.0`).

**Sent on `app_updated`:**
- `new_app_version`: The version the application is updating to.

**Sent on `$exception`:**
- `$exception_list`: Exception details including type, message, and stack trace (automatically structured by PostHog).
- `$exception_fingerprint`: Used by PostHog to group exceptions into issues.
- `error_source`: Where the error originated (`main` or `renderer`).

**Sent on `renderer_crash`:**
- `reason`: The crash reason reported by Electron (e.g. `crashed`, `oom`, `killed`).
- `exit_code`: The process exit code.

## How we track it

- We use [PostHog](https://posthog.com/) to track events and properties.
- All data is routed through the proxy: `https://ph.untasker.com`, which you may block in your firewall or network settings if desired.
- We use a random UUID to identify the machine, stored locally via Electron-Store. This ID is not linked to any personal information.
- IP addresses are anonymized and then dropped server-side in the PostHog project configuration before event ingestion. No IP addresses are stored.
- Stack traces in exception events have user directory paths redacted (e.g. `/Users/username/...` becomes `/Users/<redacted>/...`).

## How to opt out
- You can disable the analytics toggle in the application settings (lower right corner of the welcome screen) at any time.
- You can build the application from source, without the `POSTHOG_API_KEY` and `POSTHOG_HOST` environment variables set (or if you desire, set them to your own proxy/api key for your own instance of PostHog).
- You can block the proxy: `https://ph.untasker.com` in your firewall or network settings.

## What we do NOT track

- What files you open or navigate to.
- What folders you open or navigate to.
- What you do in the application.
- Any personal information or IP addresses.
- Any other data that is not directly related to the application's usage or performance.
- Your pet's name (but feel free to send us a picture of them if you want to! - petphotos@untasker.com)

## Incidentals
- We manage our reverse proxy via Cloudflare, which may log IP addresses for up to 24 hours.