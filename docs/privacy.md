# Routes — Privacy inventory and App Store privacy answers

Related: [Privacy policy](privacy-policy.md) (public) · [Release](release.md) · [Technical design § Proxy, security and privacy](technical-design.md#proxy-security-and-privacy)

This is the internal record behind the public [privacy policy](privacy-policy.md) and the App Store **App Privacy** label. Update all three together whenever the app starts sending, storing or logging something new.

## Data inventory

| Data | Where it's created | Where it goes | Retention |
|---|---|---|---|
| Search text | Search screen | App → proxy → Google Places Autocomplete | Proxy in-memory cache, 5 min; not logged |
| Trip start and destination (coordinates, place IDs) | Home, Search, current location | App → proxy → Google Routes and Place Details | Proxy in-memory cache: routes 60 s (rounded coordinates), place details 24 h (by place ID); not logged |
| Current location | `expo-location`, while in use | Used on the device; sent only as a trip start or search bias (above) | Not stored off the device |
| Device ID (random UUID, `X-Device-Id`) | First launch, stored in SQLite preferences | App → proxy (rate limiting only) | Proxy memory, up to 1 h (rate-limit bucket); not logged |
| Places session token | Per search session | App → proxy → Google (billing grouping) | Not stored |
| Recents, Home and Work, vehicle profile, preferences | The app | **Device only** (SQLite) | Until cleared or the app is deleted |
| Proxy logs | Proxy | Cloud Logging | Method, route template, status, latency, cache hit, error code only (allow-list in `apps/proxy/src/logging.ts`); 30-day default retention |
| Cloud Run request logs | Cloud Run platform | **Excluded** from Cloud Logging in both projects (they record full URLs, including search text and coordinates) | Not stored |
| Map SDK telemetry | Google Maps SDK for iOS (store builds use the Google provider) | Google | Per Google; declared in the SDK's privacy manifest (below) |

**Rules that keep this true:**
- the log allow-list (NFR-3);
- no analytics SDK of our own;
- the Cloud Run log exclusion ([deploy.md](deploy.md#current-setup-frugal));
- no server-side database.

## Privacy manifest

Expo generates `PrivacyInfo.xcprivacy` at prebuild. The app's own manifest declares the required-reason APIs React Native and Expo use (UserDefaults, file timestamps, system boot time), and **no collected data types**.

Bundled SDKs contribute their own manifests. The relevant one is the Google Maps SDK's, shipped by `react-native-maps` (`ios/AirGoogleMaps/Resources/GoogleMapsPrivacy.bundle`). It declares:

| Data type | Purpose | Linked to the user | Tracking |
|---|---|---|---|
| Crash data | Analytics | No | No |
| Performance data | Analytics | No | No |
| Product interaction | Analytics | No | No |
| Device ID | Analytics, App functionality | No | No |
| User ID | Analytics | **Yes** | No |

To see the merged report for a build: archive in Xcode (Product → Archive), then Organizer → right-click the archive → **Generate Privacy Report**.

## App Store Connect → App Privacy answers

**Do you or your third-party partners collect data from this app?** Yes.

The answers below are deliberately conservative. Routes doesn't store search or location data, but it does send them off the device to Google, and the Google Maps SDK declares its own collection.

| Category → data type | Collected by | Purposes | Linked to the user? | Used for tracking? |
|---|---|---|---|---|
| Location → **Precise Location** | Routes (sent to Google to compute routes) | App Functionality | No | No |
| Search History → **Search History** | Routes (search text sent to Google Places) | App Functionality | No | No |
| Identifiers → **Device ID** | Routes (rate limiting); Google Maps SDK | App Functionality, Analytics | No | No |
| Identifiers → **User ID** | Google Maps SDK | Analytics | Yes | No |
| Usage Data → **Product Interaction** | Google Maps SDK | Analytics | No | No |
| Diagnostics → **Crash Data** | Google Maps SDK | Analytics | No | No |
| Diagnostics → **Performance Data** | Google Maps SDK | Analytics | No | No |

Everything else is **not collected**:

- contact info, health, financial info, contacts and user content;
- browsing history, purchases, sensitive info;
- coarse location (the app asks for precise location, while in use only);
- other data types.

**Privacy policy URL:** `https://github.com/trietlu/Routes/blob/main/docs/privacy-policy.md`
