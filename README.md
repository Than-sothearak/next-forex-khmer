# ForexKhmer calendar

A public, Khmer-first economic calendar for Cambodian Forex readers. Next.js App Router, TypeScript, React, Tailwind CSS, and MongoDB/Mongoose. Visitors do not need accounts. The existing project's framework and directory layout are retained.

## Start locally

Use Node.js 22 LTS (Node 20.9+ also supports this Next.js version).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The default **demo mode works without a database or API keys**. Demo event names, descriptions and dates are authored examples, not a real release schedule. Actual, forecast and previous values are deliberately absent. Demo data is not stored in the production cache; its last-sync time stays unset.

The interface includes Cambodia-time date ranges, currency/country/impact filters, highlighted high-impact rows, English-name visibility, expandable descriptions, loading/empty/error states, and manual refresh. Opening a provider-backed event on demand asks OpenAI in Khmer for a plain-language explanation of what the release measures, how it could affect gold (XAU/USD), and how to read its Actual, Forecast and Previous values. The explanation is cached in MongoDB for the exact event revision; changing the event's title or values creates a new cache entry. It uses conditional language and is not trading advice. Demo rows do not trigger AI requests. Narrow screens can swipe the calendar horizontally to see every value. Khmer country labels cover the main Forex economies; other country names retain the provider's text.

## Calendar source

Live calendar data comes from the [Xtracto Forex Factory Actor](https://apify.com/xtracto/forexfactory-calendar). The Actor is started only by the protected sync route. Keep the Apify token in server-side environment variables and follow the permission and terms that apply to your account.
## Environment variables

All variables below are **server-only**. Do not use `NEXT_PUBLIC_` for secrets.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string, required for provider mode and sync |
| `CALENDAR_SYNC_SECRET` | Random secret of at least 32 characters, used only by server-side scheduling |
| `CALENDAR_SYNC_INTERVAL_MINUTES` | Background sync interval; defaults to 60 minutes and is bounded to 5–1440 minutes |
| `APIFY_API_TOKEN` | Server-only Apify token, required for the Apify adapter |
| `APIFY_CALENDAR_SOURCE` | Actor source; currently `xtracto/forexfactory-calendar` |
| `OPENAI_API_KEY` | Enables Khmer translations for calendar events and news |
| `OPENAI_MODEL` | Structured-output-capable model, default `gpt-4o-mini` |
| `ADMIN_API_KEY` | Protects the server-side news publishing endpoint |

Generate a sync secret with `openssl rand -hex 32`. For local MongoDB use `mongodb://127.0.0.1:27017/khmer-forex`; for Atlas use the provided connection string and allow network access from the application server. MongoDB credentials need read/write and index creation access. No secrets are returned by the calendar API.

## Scheduled synchronization

Run the app on a host supporting Node.js API routes and at least a 240-second request duration for synchronization. A Next.js deployment does not create an external scheduler automatically.

For local development or a continuously running Node server, set `CALENDAR_AUTO_SYNC=true` and `CALENDAR_SYNC_INTERVAL_MINUTES=5`, then restart `npm run dev` or `npm start`. After each successful sync, the server schedules the next request at the earlier of the background interval or 15 seconds after a known, non-tentative event release with a missing Actual. Simultaneous releases share a request; pending results continue to be checked at the background interval. Slow requests and translation can delay this timing. Release requests can increase Actor costs and cannot guarantee that the upstream source has published Actual values. The database lease prevents concurrent requests and preserves provider retry delays across processes. Existing cooldowns remain until the next successful sync. The browser automatically reads updated data every 60 seconds. No manual button or open browser is required for provider fetching while the server is running. Successful runs are logged as `[calendar-auto-sync] completed`, and `[calendar-sync] next request scheduled` shows the next request time and reason. External cron jobs only execute at their configured frequency. This uses the Next.js instrumentation startup hook: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation.

Background timers stop when the server stops or sleeps. For serverless hosting, use the external scheduler below; the built-in timer is disabled on Vercel. Changing the interval does not override an existing persisted retry/cooldown deadline.

After configuration, trigger the initial sync from a trusted shell (set the secret in that shell; `.env.local` is read by Next.js, not curl):

```sh
curl --fail-with-body -X POST http://localhost:3000/api/calendar/sync \
  -H "Authorization: Bearer $CALENDAR_SYNC_SECRET"
```

Configure your hosting scheduler or a cron job to POST to `/api/calendar/sync`. For example, check every minute; the server MongoDB-backed interval guard limits provider fetches to approximately once per hour by default:

```cron
* * * * * /usr/bin/curl --fail --silent --show-error --max-time 240 -X POST https://YOUR_DOMAIN/api/calendar/sync -H "Authorization: Bearer $CALENDAR_SYNC_SECRET"
```

Supply the secret through your scheduler's protected environment. A normal user's crontab does not inherit shell startup variables. Choose an interval and subscription quota suitable for your license. At the 60-minute default, expect about 720 calendar requests per month, plus initial/testing calls. No guest/browser action bypasses the sync guard.

- Each sync targets **yesterday through seven days ahead**, interpreted as Cambodia dates and stored in UTC. Requests outside the latest covered window show an explicit coverage warning; cached older events may still appear.
- A unique `(provider, providerId)` index and upserts prevent duplicates and apply revisions. Successful responses reconcile current and future cancellations while retaining the past event archive. Existing starter records in the old `economicevents` collection are left untouched; licensed events use the new `calendarevents` collection.
- A five-minute MongoDB lease prevents concurrent scheduled jobs across application instances. Apify runs have a 120-second execution limit and a 130-second HTTP deadline. HTTP 429 `Retry-After` values persist as backoff in MongoDB; errors preserve previously cached data and mark it stale. Other failures back off at least five minutes or the configured interval.
- Browsers poll the event cache every 60 seconds while visible and refresh on returning to the tab. If a displayed event name or provider-supplied description has no Khmer cache entry, the page separately requests one server-side translation batch; this does not start an upstream calendar run. A MongoDB lease and retry delay prevent repeated OpenAI calls across visitors. Source sync time and browser check time are separate. Data becomes stale after twice the configured interval or a recorded sync failure.
- UTC timestamps are rendered with `Asia/Phnom_Penh` (UTC+7). Date filters use inclusive Cambodia calendar dates, implemented as a half-open UTC range. Maximum range: 31 days.

## OpenAI translations

Sync translates original English event names and short descriptions **when the provider supplies descriptions**. It does not invent descriptions or financial facts. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) constrains responses to a translation array; the server also checks completion status, count, type and length.

Original text remains on the event record. Translations are stored in a separate MongoDB collection using a unique SHA-256 key over the exact original text, language and prompt version. Repeated text is reused across events and restarts. Up to 30 missing texts are translated per batch, during provider sync or on demand when a visitor opens a calendar range. A MongoDB lease serializes batches across app instances; remaining texts are retried later and failed requests use a five-minute cooldown. A change to the English text generates a new key. Changing the model does not automatically invalidate previously cached translations.

Missing OpenAI credentials, refusals, rate limits or invalid output leave the English text visible with a pending-translation notice; they never replace it with made-up Khmer. Translation failure does not prevent a valid provider calendar from being displayed. Successful output is cached; an interrupted/failed write may require a retry. Have a fluent Khmer financial editor review translations before broad production use.

Opening a provider event asks OpenAI for the supplied Khmer event-explainer format: translated event heading and beginner overview; event-specific Actual/Forecast/Previous explanation (including speech handling); a responsive scenario table for USD, Gold/XAU/USD and any relevant currency; and a short conditional summary. It only uses the event title, verified provider description if present, currency, impact, Cambodia-time date and values stored in MongoDB. Only a provider event ID is accepted from the browser. A unique content key and MongoDB lease reuse cached explanations and prevent concurrent duplicate requests. A changed value set gets a new explanation. This feature needs `OPENAI_API_KEY`, MongoDB, and provider mode; it does not run on demo fixtures. Gold implications are conditional educational context, not a prediction or investment advice.

## News in Khmer

The homepage has a responsive news section that reads published items from `GET /api/news`. Publishing an English article through the protected `POST /api/news` endpoint uses the server-side OpenAI key once to produce a Khmer title, summary, body, and short explanation of possible market channels. The English source text is preserved in `titleEn`, `summaryEn`, and `bodyEn`; the Khmer impact explanation is stored with the article and is revealed by tapping/clicking its disclosure, which also works by keyboard on desktop. Public visitors do not trigger paid AI requests.

No news provider/feed is configured by this project, and no news stories are fabricated. Supply only articles from a provider whose terms permit public redistribution, database storage, and sending the text to OpenAI. The publish endpoint accepts `title`/`summary`/`body` or their `titleEn`/`summaryEn`/`bodyEn` equivalents, plus optional `slug`, `source`, `sourceUrl`, `category`, `impact`, `publishedAt`, and `status`. It requires a valid `ADMIN_API_KEY` and OpenAI key; failed AI generation returns an error without publishing a half-translated article. The explanation uses conditional language and is informational, not trading advice.

## Code structure and request flow

- `app/` contains the page, calendar/news UI and Next.js API routes.
- `lib/calendar/` contains date handling, demo events, Apify configuration, event normalization, MongoDB sync, translations and event explanations.
- `lib/calendar/providers/` contains the Xtracto Apify request and shared provider error/date helpers.
- `models/` defines MongoDB collections for calendar events, sync state, translations, news and explanations.

Calendar flow:

1. The browser loads `/api/calendar`. The route validates Cambodia date filters, reads matching cached MongoDB events, and returns demo events when provider setup is missing.
2. `instrumentation.ts` starts the optional background loop when `CALENDAR_AUTO_SYNC=true`. A hosting scheduler can call the same protected `POST /api/calendar/sync` route.
3. `lib/calendar/sync.ts` checks configuration, acquires a MongoDB lease, and calls the Xtracto provider in `lib/calendar/providers/apify.ts`.
4. The provider sends the Actor request. `apify-data.ts` validates and normalizes its rows. Sync upserts new events, removes cancelled current/future events, and keeps the previous cache if the Actor request fails.
5. Sync translates missing event text and stores the next attempt time. The browser polls the cached calendar; it does not start an Actor run.

Other routes handle on-demand calendar translation and explanations, and public news reading plus protected news publishing.
## Checks

```sh
npm run typecheck
npm test
npm run build
```

MongoDB integration tests use a real isolated database and mocked provider/OpenAI HTTP responses. They create and drop only a uniquely named test database on the explicitly provided server:

```sh
TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm run test:integration
```

Browser tests start a demo-mode development server on port 3100:

```sh
npx playwright install chromium
npm run test:browser
# Or use an installed Chromium/Chrome:
# PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chrome" npm run test:browser
```

They cover filters, English names, refresh, date validation, sync authorization, loading/error/retry states, and mobile overflow. Screenshots are saved under `artifacts/` (gitignored).

PostCSS is overridden to a patched 8.x release to address audit findings in the inherited Next.js dependency tree, without a major framework upgrade.

## Still needed for production

An appropriately licensed provider contract and working key; a persistent MongoDB deployment; an OpenAI key for uncached translations; hosting secrets and a scheduled POST job. No production provider or OpenAI request has been verified with working credentials. No Apify Actor run has been started; tests use mocked responses. The integration tests use authored fixtures, never copied Forex Factory data. Cache retention and any provider-specific branding/delay requirements must match your contract.

## Styling

The interface uses Tailwind CSS utility classes in `app/calendar.tsx` and `app/layout.tsx`. `app/globals.css` only imports Tailwind and declares theme tokens (colors and the locally bundled Khmer/Latin font stack); it contains no custom component selectors. `postcss.config.mjs` configures the Tailwind PostCSS plugin. Responsive variants, focus states and motion-reduction variants are kept with the components.

## Apify integration

The calendar uses the xtracto/forexfactory-calendar Actor through Apify synchronous run and dataset-items endpoint. It sends the token in a bearer header and starts runs only through the protected sync route. Public browsing never starts an Actor run.

Configure **`.env.local` or hosting secrets**, not `.env.example`:

```dotenv
APIFY_API_TOKEN=your-private-apify-token
APIFY_CALENDAR_SOURCE=xtracto/forexfactory-calendar
CALENDAR_SYNC_INTERVAL_MINUTES=60
MONGODB_URI=your-mongodb-connection
CALENDAR_SYNC_SECRET=your-random-secret-at-least-32-characters
```

The app uses this Actor as its only live calendar source. Missing credentials keep public demo mode and reject sync without calling Apify.

Once configured and authorized, use the existing protected `POST /api/calendar/sync` and scheduler instructions above. Apify defaults to an hourly interval because each run can incur Actor/platform charges. Review the Actor's current pricing before scheduling: the request asks for at most 100 events, **not a guaranteed dollar spending cap**. Failed or timed-out runs can still incur charges. Requests are not immediately retried; normal persisted sync backoff applies. Alerts and webhooks are not configured or sent.

The adapter sends a dynamic range with USD, EUR and AUD currencies, low minimum impact and at most 100 items. It maps the Actor event, currency, country, timestamp, impact and Actual/Forecast/Previous fields. Provider timestamps are converted to UTC, then events are limited to the sync interval. Rescheduling is reconciled by the existing fetched-window cleanup.

Only event records enter the calendar. A tagged `type: "week_outlook"` summary is ignored. Unexpected schemas, other sources, conflicting duplicate events fail validation. Empty/summary-only responses also fail conservatively, retaining the cache because an upstream outage cannot be distinguished from an empty feed. A validated nonempty feed with no events inside the target UTC window may still legitimately produce an empty calendar. There is no invented upstream last-update timestamp and no real-time claim.



**Secrets:** `.env.example` is a shareable template and must contain no real keys. Keep keys in the gitignored `.env.local`. A previously exposed OpenAI key was removed from the template and preserved locally; rotate that key in your OpenAI account and replace the local value. It was not used to run Apify or test production translations.
# next-forex-khmer
