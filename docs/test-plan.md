# Routes — Test Plan

Related: [BRD](brd.md) · [Technical design](technical-design.md) · [UX sketch](ux-sketch.md) · [Plan](PLAN.md)

This plan tells the coding agent how to prove each piece works. Every issue lists the test IDs it must add or make pass. A test ID below is "done" when an automated test with that ID in its name (e.g. `it("RC-COST-01: fuel cost from distance, mpg and price", …)`) exists and passes in CI. Manual (`MAN-`) tests are run by a human before beta.

## 1. Test levels

| Level | Tool | Runs where | Scope | Prefix |
|---|---|---|---|---|
| Unit | Jest | Any OS, CI (ubuntu) | `packages/routing-core`, `packages/api-types`, pure app modules (`handoff/`, `storage/` logic, `api/` mapping) | `RC-`, `AT-`, `APP-` |
| Integration (proxy) | Jest + supertest + nock | Any OS, CI (ubuntu) | `apps/proxy` endpoints with Google stubbed | `PX-` |
| Component | Jest + React Native Testing Library | Any OS, CI (ubuntu) | Screens and components, with fixture API responses and mocked native modules | `UI-` |
| End-to-end | Maestro on iOS simulator | macOS only, CI (macos runner) | Real app build against the proxy in `PROVIDER=mock` | `E2E-` |
| Manual | Human on a real iPhone | Before beta | Handoff with and without Google Maps, VoiceOver, live Google data | `MAN-` |

**Commands** (defined in R-01 and kept working by every issue):

| Command | What it runs |
|---|---|
| `npm run lint` | ESLint and Prettier check, all workspaces |
| `npm run typecheck` | `tsc --noEmit`, all workspaces |
| `npm test` | Jest, all workspaces (unit, integration, component) |
| `npm run test:coverage` | Jest with coverage thresholds enforced |
| `npm run proxy:dev` | Proxy on `:8080` with `PROVIDER=mock`, `ATTEST_MODE=off` |
| `npm run e2e` | Maestro flows in `apps/mobile/e2e/` (macOS with a booted simulator and a running mock proxy) |

**Coverage gates** (CI fails below these):

| Package | Line coverage |
|---|---|
| `routing-core` | ≥ 95% |
| `api-types` | ≥ 90% |
| `proxy` | ≥ 85% |
| Mobile non-UI modules (`handoff/`, `storage/`, `api/`, `state/`, `location/`) | ≥ 80% |

## 2. Canonical fixture and expected values

Source: [UX screen 4](ux-sketch.md#screen-4--results). Destination place ID: `fixture-union-station`. Vehicle: defaults (25 mpg, $3.50/gal → $0.14/mi).

**Raw provider data**

| Route | Source call | durationSec | distanceM | description | Toll |
|---|---|---|---|---|---|
| A | tolls | 1320 (22 min) | 15772 (9.8 mi) | Hwy 12 | $3.75 USD |
| B | tolls **and** avoidTolls (same geometry; must dedupe to one) | 1620 (27 min) | 17059 (10.6 mi) | Elm Ave & 3rd St | none |
| C | avoidTolls | 1860 (31 min) | 14323 (8.9 mi) | Main St | none |

**Derived costs**

| Route | Fuel (exact) | Fuel shown | Trip shown |
|---|---|---|---|
| A | 1.37204 | $1.37 | $5.12 |
| B | 1.48400 | $1.48 | $1.48 |
| C | 1.24599 | $1.25 | $1.25 |

**Fastest mode:**

| Card | Line 1 | Line 3 | Cost | Pill |
|---|---|---|---|---|
| A | 22 min · 9.8 mi · FASTEST | Best of 3 | $5.12 est. | $3.75 toll |
| B | 27 min · 10.6 mi | 5 min slower · saves $3.64 | $1.48 est. | No tolls |
| C | 31 min · 8.9 mi | 9 min slower · saves $3.87 | $1.25 est. | No tolls |

**Cheapest mode:**

| Card | Route | Line 1 | Line 3 | Cost |
|---|---|---|---|---|
| A | (was C) | 31 min · 8.9 mi · CHEAPEST | Best of 3 | $1.25 est. |
| B | (was B) | 27 min · 10.6 mi | 4 min faster · $0.23 more | $1.48 est. |
| C | (was A) | 22 min · 9.8 mi | 9 min faster · $3.87 more | $5.12 est. |

With vehicle set to 40 mpg, $4.00/gal ($0.10/mi), the Fastest trip costs are A $4.73, B $1.06 and C $0.89.

**Edge-case fixtures** (selected by destination place ID in mock mode):

| Place ID | Search text | Behaviour |
|---|---|---|
| `fixture-two-routes` | "Two Routes Test" | 2 distinct routes → "Only 2 routes found", "Best of 2" |
| `fixture-one-route` | "One Route Test" | 1 route → "Only 1 route found" |
| `fixture-unknown-toll` | "Unknown Toll Test" | Route X: toll info with no price (24 min, 12.0 mi); Route Y: no tolls (30 min, 11.0 mi) |
| `fixture-near-duplicates` | "Near Duplicates Test" | 4 routes, two of which overlap ~90% → 3 shown |
| `fixture-no-route` | "No Route Test" | Google returns `{}` for both calls → `NO_ROUTE` |
| `fixture-upstream-error` | "Error Test" | Both calls return HTTP 500 → `UPSTREAM_ERROR` |
| `fixture-partial-error` | "Partial Error Test" | Tolls call 500, avoidTolls call OK → routes returned |
| `fixture-slow` | "Slow Test" | Responds after 2 s (for loading states) |

Autocomplete fixture: query starting "Union" returns Union Station (100 Union Plaza), Union Street Market (42 Union St) and Union St & 9th Ave (Intersection), with distances 9.1, 4.3 and 6.8 mi. Each edge-case search text returns its fixture place.

## 3. Unit tests — routing-core (`RC-`)

| ID | Test | Req |
|---|---|---|
| RC-POLY-01 | Decodes the example from Google's Encoded Polyline Algorithm docs to (38.5, -120.2), (40.7, -120.95), (43.252, -126.453) | — |
| RC-POLY-02 | `encode(decode(x)) === x` round-trip for fixture polylines | — |
| RC-GEO-01 | Point-to-segment distance within 0.5 m of a reference haversine value for short segments | — |
| RC-GEO-02 | Resampling a 1 km line every 25 m yields 41 points (inclusive ends) | — |
| RC-OVL-01 | Identical polylines → overlap 1.0 | BR-3 |
| RC-OVL-02 | Disjoint polylines (> 1 km apart) → overlap 0 | BR-3 |
| RC-OVL-03 | Route sharing the first 90% then diverging → overlap ≈ 0.9 (±0.03) | BR-3 |
| RC-OVL-04 | Overlap uses the larger of the two directional fractions (short route contained in long route → ≈ 1.0) | BR-3 |
| RC-COST-01 | Fuel = miles ÷ mpg × price; canonical A → 1.37204 (±1e-4) | BR cost |
| RC-COST-02 | Toll sum: `units` + `nanos/1e9` across multiple `estimatedPrice` entries | BR cost |
| RC-COST-03 | Toll info with no USD price → `tollUnknown: true`, `tripUSD: null` | BR cost |
| RC-COST-04 | Non-USD price only → treated as unknown | BR cost |
| RC-COST-05 | Default vehicle (25 mpg, $3.50) is applied when none is given | BR cost |
| RC-RANK-01 | Fastest: canonical order A, B, C | FR-9 |
| RC-RANK-02 | Cheapest: canonical order C, B, A | FR-10 |
| RC-RANK-03 | Cheapest tie on cost broken by duration | FR-10 |
| RC-RANK-04 | Fastest tie on duration broken by distance | FR-9 |
| RC-RANK-05 | Cheapest: unknown-toll routes rank after all priced routes, even if their fuel is lower | BR cost |
| RC-RANK-06 | Cheapest includes routes from the avoidTolls source | FR-10 |
| RC-DEDUP-01 | Canonical B (present in both sources) appears once | BR-3 |
| RC-DEDUP-02 | Of two overlapping routes, the better-ranked one *for the current mode* is kept (can differ between modes) | BR-3 |
| RC-DEDUP-03 | Overlap exactly at threshold (0.80) is kept; above it is dropped | BR-3 |
| RC-TOP3-01 | More than three distinct routes → exactly three returned | FR-8 |
| RC-TOP3-02 | Two routes → two returned with `onlyN = 2`; one → one; zero → empty | FR-8, BR-5 |
| RC-TOP3-03 | Letters A, B, C assigned in ranked order and reassigned on mode change | FR-12 |
| RC-DIFF-01 | Fastest canonical diffs: B "5 min slower · saves $3.64", C "9 min slower · saves $3.87" | BR-4 |
| RC-DIFF-02 | Cheapest canonical diffs: B "4 min faster · $0.23 more", C "9 min faster · $3.87 more" | BR-4 |
| RC-DIFF-03 | Equal times → "Same time"; difference < 1 min → "Same time" | BR-4 |
| RC-DIFF-04 | Equal cents → "Same cost" | BR-4 |
| RC-DIFF-05 | Either route's toll unknown → cost part "cost unknown" | BR-4 |
| RC-DIFF-06 | Diffs computed from cent-rounded costs (C's saving is $3.87, not $3.88) | BR-4 |
| RC-FMT-01 | Duration: 59 s → "1 min", 1320 → "22 min", 3900 → "1 hr 5 min", 7200 → "2 hr" | FR-13 |
| RC-FMT-02 | Distance: 15772 m → "9.8 mi", 160 m → "0.1 mi" | NFR-11 |
| RC-FMT-03 | Money: 5.1220 → "$5.12", 0.005 → "$0.01" (half-up) | BR cost |
| RC-FMT-04 | Toll status strings: "$3.75 toll", "No tolls", "Toll, price unknown" | FR-13 |
| RC-FMT-05 | Card cost: "$5.12" priced, "$1.37 + toll" unknown | FR-13 |
| RC-FMT-06 | Card accessibility label matches the UX example format | NFR-6, 7 |
| RC-FMT-07 | Key-steps selection: first step, steps ≥ 0.5 mi, arrival row; max 8 + `hasMore` | FR-15 |
| RC-PERF-01 | `rankRoutes` on 10 routes with 500-point polylines completes in < 50 ms | NFR-1 |

## 4. Unit tests — api-types (`AT-`)

| ID | Test |
|---|---|
| AT-01 | Valid `POST /routes` body parses; missing destination, out-of-range lat/lng, or extra unknown fields fail |
| AT-02 | `ProviderRoute` schema accepts fixtures and rejects a missing `encodedPolyline` |
| AT-03 | Autocomplete query: `q` shorter than 2 characters fails; `session` required |
| AT-04 | Error envelope schema matches every documented error code |

## 5. Integration tests — proxy (`PX-`)

Google is stubbed with `nock`. No test may make a real network call (`nock.disableNetConnect()`).

| ID | Test | Req |
|---|---|---|
| PX-HEALTH-01 | `GET /healthz` → 200 `{ ok: true }` | — |
| PX-VAL-01 | Invalid body → 400 `BAD_REQUEST` and no upstream call | — |
| PX-VAL-02 | Missing `X-Device-Id` → 400 | — |
| PX-ROUTES-01 | Sends exactly two `computeRoutes` calls in parallel; the second has `routeModifiers.avoidTolls: true` | FR-10 |
| PX-ROUTES-02 | Both calls carry `travelMode DRIVE`, `TRAFFIC_AWARE`, `computeAlternativeRoutes`, `extraComputations ["TOLLS"]` and the exact field mask header | FR-9, NFR-9 |
| PX-ROUTES-03 | Waypoint mapping: `placeId` used when present, else `latLng` | — |
| PX-ROUTES-04 | Normalization: duration "1320s" → 1320; toll units/nanos → priceUSD; no `tollInfo` → `hasTolls false`; `tollInfo` without price → `priceUSD null` | BR cost |
| PX-ROUTES-05 | Merged response tags each route's `source` | — |
| PX-ROUTES-06 | One call fails, other succeeds → 200 with the successful routes | NFR-8 |
| PX-ROUTES-07 | Both fail → 502 `UPSTREAM_ERROR`; upstream > 8 s → 504 `UPSTREAM_TIMEOUT` | NFR-8 |
| PX-ROUTES-08 | Both return no routes → 404 `NO_ROUTE` | FR-8 |
| PX-ROUTES-09 | API key is sent to Google as a header and never appears in responses | NFR-3 |
| PX-PLACES-01 | Autocomplete calls Places (New) with `input`, `origin`, `locationBias`, `includedRegionCodes ["us"]`, `sessionToken`; maps `distanceMeters` | FR-5 |
| PX-PLACES-02 | Details returns `{placeId, name, address, lat, lng}` using the session token and a minimal field mask | — |
| PX-CACHE-01 | Second identical `/routes` request within 60 s makes no upstream call; after 60 s it does | NFR-9 |
| PX-CACHE-02 | Origins differing by < 4th decimal share a cache entry; different destinations don't | NFR-9 |
| PX-CACHE-03 | Autocomplete cached 5 min; details 24 h | NFR-9 |
| PX-RATE-01 | 61st route request in an hour from one device → 429 `RATE_LIMITED`; another device unaffected | NFR-9 |
| PX-LOG-01 | Captured logs for routes, autocomplete and details contain no lat, lng, address or query text | NFR-3 |
| PX-MOCK-01 | `PROVIDER=mock` serves every fixture in §2 with no network access and the same response shapes | — |
| PX-ATTEST-01 | `ATTEST_MODE=enforce`: missing or invalid assertion → 401; valid test vector → 200 | — |
| PX-ATTEST-02 | `ATTEST_MODE=off`: requests pass without an assertion | — |
| PX-DOCKER-01 | CI builds the Docker image and the container answers `/healthz` | — |

## 6. Unit tests — mobile non-UI modules (`APP-`)

| ID | Test | Req |
|---|---|---|
| APP-STORE-01 | Migrations run on an empty DB and are idempotent | — |
| APP-STORE-02 | Adding a recent upserts by `placeId`, updates `lastUsedAt`, orders most-recent first, trims to 10 | FR-6 |
| APP-STORE-03 | Clear recents deletes recents only; Home/Work remain | FR-6 |
| APP-STORE-04 | Set, replace and remove Home/Work | FR-7 |
| APP-STORE-05 | Vehicle defaults on first read (`isUserSet false`); save persists and sets `isUserSet true` | FR-19 |
| APP-STORE-06 | `lastMode` persists across reloads; defaults to `fastest` | FR-11 |
| APP-STORE-07 | `deviceId` generated once and stable | — |
| APP-API-01 | Client sends `X-Device-Id` and the correct base URL from config | — |
| APP-API-02 | Maps HTTP / network failures to UI error kinds: `offline`, `noRoute`, `rateLimited`, `generic` | FR-21, NFR-8 |
| APP-API-03 | Autocomplete hook debounces 300 ms and skips queries shorter than 2 characters (fake timers) | NFR-2, NFR-9 |
| APP-API-04 | Routes query key excludes mode; toggling mode issues no new request | FR-9, FR-10 |
| APP-API-05 | One autocomplete session token is reused until a details call, then rotated | NFR-9 |
| APP-STATE-01 | `useRankedRoutes` returns canonical Fastest and Cheapest results (§2) from the fixture | FR-9, FR-10 |
| APP-STATE-02 | Changing the vehicle re-ranks and updates costs with no refetch | FR-19 |
| APP-STATE-03 | Swap exchanges start and destination, including `current` | FR-4 |
| APP-STATE-04 | Selecting a route by letter; mode change selects new A | FR-14 |
| APP-LOC-01 | Permission flow: never requests before explicit call; granted → coordinates + address; denied → `denied` state | FR-1, 2, 3 |
| APP-LOC-02 | No fix within 5 s → `unavailable` | FR-3 |
| APP-LOC-03 | Only foreground permission APIs are used (no background) | NFR-4 |
| APP-HAND-01 | Link for current-location start omits `origin`; has `destination`, `destination_place_id`, `travelmode=driving`, `dir_action=navigate` | FR-16 |
| APP-HAND-02 | Typed start → `origin=lat,lng`; destination `current` (after swap) → `destination=lat,lng`, no place ID | FR-16 |
| APP-HAND-03 | Names with `&`, `#`, spaces, unicode are URL-encoded | FR-16 |
| APP-HAND-04 | Installed → `openURL(link)`; not installed → `notInstalled` result (no openURL); `openURL` rejects → `notInstalled` | FR-17 |
| APP-HAND-05 | App Store URL is `https://apps.apple.com/app/id585027354` | FR-17 |
| APP-HAND-06 | Share text matches the UX format for priced, toll-free and unknown-toll routes | FR-18 |
| APP-CFG-01 | `app.config.ts` contains `LSApplicationQueriesSchemes: ["comgooglemaps"]`, a when-in-use location string, and no background location modes | FR-17, NFR-4 |
| APP-I18N-01 | Every user-visible string in screens comes from the strings table (lint rule or test scanning for raw JSX text) | NFR-11 |

## 7. Component tests — screens (`UI-`)

Use RNTL with mocked native modules (maps, location, linking, sqlite) and fixture data.

| ID | Screen | Test | Req |
|---|---|---|---|
| UI-ONB-01 | 1 | Renders title, both buttons, footnote; no permission request on mount | FR-1 |
| UI-ONB-02 | 1 | "Allow" requests foreground permission then navigates to Home; "Enter a start address" navigates to Search for From with no permission request | FR-1, US-2 |
| UI-HOME-01 | 2 | Granted: From shows "Current location" with the street address in its a11y label | FR-2 |
| UI-HOME-02 | 2 | Denied: placeholder "Enter a start address" and "Turn on in Settings" link opening `app-settings:` | FR-3 |
| UI-HOME-03 | 2 | Swap button swaps the fields | FR-4 |
| UI-HOME-04 | 2 | Mode toggle shows persisted mode; changing it persists | FR-11 |
| UI-HOME-05 | 2 | Recents listed most-recent first; tapping one with a start set navigates to Results | US-4 |
| UI-HOME-06 | 2 | Clear → confirm → recents gone, Home/Work kept | FR-6 |
| UI-HOME-07 | 2 | Unset Home shows "Set Home" → opens Set Home | FR-7 |
| UI-HOME-08 | 2 | Offline: banner with Retry; recents still tappable | FR-21 |
| UI-SRCH-01 | 3 | Typing "Union" shows 3 suggestions with distances "9.1 mi" etc. | FR-5 |
| UI-SRCH-02 | 3 | No "Choose on map" row | Scope |
| UI-SRCH-03 | 3 | Picking a result saves a recent and navigates to Results when both ends are set | US-3, FR-6 |
| UI-SRCH-04 | 3 | No-results and error states with Retry | NFR-8 |
| UI-SRCH-05 | S2 | Set Home flow saves Home and returns to Home | FR-7 |
| UI-RES-01 | 4 | Canonical Fastest cards match §2 exactly (text content) | FR-8, 9, 13 |
| UI-RES-02 | 4 | Toggle to Cheapest: cards match §2, subtitle "Ranked by trip cost", no refetch | FR-10 |
| UI-RES-03 | 4 | Tapping card B selects it; button reads "Go with route B" | FR-14 |
| UI-RES-04 | 4 | Map receives 3 polylines with A/B/C colors; selected has higher zIndex and width; bubbles read "A · 22 min" | FR-12, NFR-7 |
| UI-RES-05 | 4 | Pressing polyline C selects C | FR-14 |
| UI-RES-06 | 4 | `fitToCoordinates` called with bottom edge padding ≥ sheet height | FR-12 |
| UI-RES-07 | 4 | Two-route fixture → "Only 2 routes found", "Best of 2" | FR-8, BR-5 |
| UI-RES-08 | 4 | Unknown-toll fixture → "Toll, price unknown" pill, "$X.XX + toll", diff "cost unknown", ranked last in Cheapest | BR cost |
| UI-RES-09 | 4 | Loading skeleton; map shows start/destination pins | NFR-8 |
| UI-RES-10 | 4 | No-route, error, offline and rate-limited states with correct copy and Retry; map pins still rendered | NFR-8, FR-21 |
| UI-RES-11 | 4 | Every card cost shows "est." | FR-20 |
| UI-RES-12 | 4 | Vehicle prompt shows on first Cheapest view with default vehicle; dismiss hides it permanently; not shown once vehicle set | FR-22 |
| UI-DET-01 | 5 | Canonical A: header, "9.8 mi · arrive h:mm", Tolls $3.75, Fuel (estimated) $1.37, Trip cost (estimated) $5.12 | FR-15, FR-20 |
| UI-DET-02 | 5 | Arrival time = now + duration (fake clock) and refreshes after a minute | FR-15 |
| UI-DET-03 | 5 | Key steps capped at 8 with "Show all steps" expanding the list; no toll row | FR-15 |
| UI-DET-04 | 5 | Handoff note copy; toll-free route adds the Avoid tolls hint, tolled route doesn't | BR handoff |
| UI-DET-05 | 5 | Default vehicle footnote vs. user-set footnote; link opens Edit vehicle | FR-19 |
| UI-DET-06 | 5 | Share button opens share with the expected text | FR-18 |
| UI-DET-07 | 5, S3 | Open in Google Maps: installed → openURL; not installed → S3 sheet; sheet buttons open web link / App Store; Cancel closes | FR-16, FR-17 |
| UI-VEH-01 | S1 | Defaults shown; invalid mpg (0, 151, "abc") and price (0.49, 15.01) show errors and disable Save | FR-19 |
| UI-VEH-02 | S1 | Save persists, returns, and results/detail costs update (40 mpg, $4.00 → A $4.73) | FR-19 |
| UI-A11Y-01 | All | Every pressable has `accessibilityRole` and `accessibilityLabel` (tree walk per screen) | NFR-6 |
| UI-A11Y-02 | All | Pressable hit areas ≥ 44×44 (style + hitSlop) | NFR-6 |
| UI-A11Y-03 | All | Theme token pairs (text/background, light and dark) meet 4.5:1 contrast (computed) | NFR-6, NFR-10 |
| UI-A11Y-04 | 4 | Route cards and bubbles include the letter; color is never the only differentiator | NFR-7 |

## 8. End-to-end tests — Maestro (`E2E-`)

Run on the iOS simulator against `npm run proxy:dev` (mock). `EXPO_PUBLIC_MAP_PROVIDER=default`. Simulator location set via Maestro `setLocation`. Each flow starts from a fresh install unless noted.

| ID | Flow | Req |
|---|---|---|
| E2E-01 | First launch → onboarding → Allow (grant) → Home shows "Current location" | FR-1, FR-2 |
| E2E-02 | First launch → "Enter a start address instead" → type and pick start → Home shows it | US-2 |
| E2E-03 | Permission denied → Home shows "Enter a start address" and "Turn on in Settings" | FR-3 |
| E2E-04 | Search "Union" → pick Union Station → Results shows 3 cards; card A "22 min", "$5.12" | FR-5, FR-8, FR-13 |
| E2E-05 | On Results, tap Cheapest → first card "31 min" with CHEAPEST; relaunch app → Home toggle shows Cheapest | FR-10, FR-11 |
| E2E-06 | Tap card B → "Go with route B" → Route detail shows B's cost breakdown | FR-14, FR-15 |
| E2E-07 | Route detail → Edit vehicle → 40 mpg, $4.00 → Save → costs update | FR-19 |
| E2E-08 | Back to Home → Union Station in recents → tap → Results in one tap | US-4, FR-6 |
| E2E-09 | Clear recents → list empty | FR-6 |
| E2E-10 | "Two Routes Test" → "Only 2 routes found" | BR-5 |
| E2E-11 | "Error Test" → "Couldn't load routes" → Retry visible; map visible | NFR-8 |
| E2E-12 | "No Route Test" → "No driving route found" | — |
| E2E-13 | Open in Google Maps (simulator has no Google Maps) → "Google Maps isn't installed" sheet → Cancel | FR-17 |
| E2E-14 | Set Home via "Set Home" → Home row shows the address | FR-7 |
| E2E-15 | Swap start and destination on Home | FR-4 |
| E2E-16 | Airplane-style offline (proxy stopped) → "You're offline" / error banner with Retry; recents listed | FR-21 |
| E2E-17 | Performance smoke: time from tapping a result to 3 cards visible < 3 s (mock proxy) | NFR-1 |

## 9. Manual tests (`MAN-`) — human, real iPhone, before beta

| ID | Test | Req |
|---|---|---|
| MAN-01 | With Google Maps installed: Open in Google Maps launches navigation to the right place, from current location | FR-16 |
| MAN-02 | With a typed start: Google Maps starts from that start | FR-16 |
| MAN-03 | Without Google Maps: sheet appears; Open in browser loads directions; Get Google Maps opens the App Store page | FR-17 |
| MAN-04 | VoiceOver pass on every screen and state: everything reachable, labels meaningful, route letters announced | NFR-6, 7 |
| MAN-05 | Largest accessibility text size on every screen: nothing truncated or overlapping | NFR-6 |
| MAN-06 | Dark mode on every screen | NFR-10 |
| MAN-07 | Live Google data (staging): 5 real trips in a toll region; tolls and "via" labels plausible; 3 distinct routes on most trips; tune overlap threshold | FR-8, BR-3 |
| MAN-08 | NFR-1 on LTE: 10 trips, p90 < 3 s | NFR-1 |
| MAN-09 | App Attest enforced on staging: genuine build works; curl without assertion gets 401 | — |
| MAN-10 | Privacy: proxy logs on staging contain no coordinates/addresses; App Store privacy label matches the data inventory | NFR-3, NFR-5 |

## 10. Requirement traceability

| Req | Tests |
|---|---|
| FR-1 | APP-LOC-01, UI-ONB-01, UI-ONB-02, E2E-01 |
| FR-2 | APP-LOC-01, UI-HOME-01, E2E-01 |
| FR-3 | APP-LOC-01, APP-LOC-02, UI-HOME-02, E2E-03 |
| FR-4 | APP-STATE-03, UI-HOME-03, E2E-15 |
| FR-5 | PX-PLACES-01, UI-SRCH-01, E2E-04 |
| FR-6 | APP-STORE-02, APP-STORE-03, UI-HOME-06, E2E-08, E2E-09 |
| FR-7 | APP-STORE-04, UI-HOME-07, UI-SRCH-05, E2E-14 |
| FR-8 | RC-TOP3-01, RC-TOP3-02, PX-ROUTES-08, UI-RES-07, E2E-10 |
| FR-9 | RC-RANK-01, RC-RANK-04, APP-STATE-01, UI-RES-01, E2E-04 |
| FR-10 | RC-RANK-02, RC-RANK-03, RC-RANK-06, PX-ROUTES-01, UI-RES-02, E2E-05 |
| FR-11 | APP-STORE-06, UI-HOME-04, E2E-05 |
| FR-12 | RC-TOP3-03, UI-RES-04, UI-RES-06 |
| FR-13 | RC-FMT-01, RC-FMT-04, RC-FMT-05, UI-RES-01 |
| FR-14 | APP-STATE-04, UI-RES-03, UI-RES-05, E2E-06 |
| FR-15 | RC-FMT-07, UI-DET-01, UI-DET-02, UI-DET-03 |
| FR-16 | APP-HAND-01…03, UI-DET-07, MAN-01, MAN-02 |
| FR-17 | APP-HAND-04, APP-HAND-05, APP-CFG-01, UI-DET-07, E2E-13, MAN-03 |
| FR-18 | APP-HAND-06, UI-DET-06 |
| FR-19 | APP-STORE-05, APP-STATE-02, UI-VEH-01, UI-VEH-02, E2E-07 |
| FR-20 | UI-RES-11, UI-DET-01 |
| FR-21 | APP-API-02, UI-HOME-08, UI-RES-10, E2E-16 |
| FR-22 | UI-RES-12 |
| NFR-1 | RC-PERF-01, E2E-17, MAN-08 |
| NFR-2 | APP-API-03 |
| NFR-3 | PX-ROUTES-09, PX-LOG-01, MAN-10 |
| NFR-4 | APP-LOC-03, APP-CFG-01 |
| NFR-5 | MAN-10 |
| NFR-6 | UI-A11Y-01…03, MAN-04, MAN-05 |
| NFR-7 | RC-FMT-06, UI-RES-04, UI-A11Y-04, MAN-04 |
| NFR-8 | PX-ROUTES-06, PX-ROUTES-07, UI-RES-09, UI-RES-10, E2E-11 |
| NFR-9 | PX-CACHE-01…03, PX-RATE-01, APP-API-03, APP-API-05 |
| NFR-10 | UI-A11Y-03, MAN-06 |
| NFR-11 | RC-FMT-02, APP-I18N-01 |

## 11. Definition of done (every issue)

1. All test IDs listed in the issue exist and pass.
2. `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:coverage` pass locally and in CI.
3. If the issue touches screens and the E2E job exists, the E2E job passes.
4. No real network calls in automated tests; no secrets committed.
5. The issue's acceptance checklist is ticked in the PR description.
