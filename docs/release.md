# Releasing the iOS app (EAS)

Related: [Deploying the proxy](deploy.md) · workflow [`.github/workflows/app-release.yml`](../.github/workflows/app-release.yml) · [`apps/mobile/eas.json`](../apps/mobile/eas.json)

Store builds are made on EAS (Expo's build service) and sent to TestFlight. Local dev builds (`npm run ios -w @routes/mobile -- --device`) are unchanged and don't use EAS.

## Profiles

Both profiles build the same App Store app, `com.rebound.routes`, signed by team `5T7CA68Q3C`, with Google map tiles. They differ only in which proxy they call.

| Profile | EAS environment | Proxy | Use |
|---|---|---|---|
| `staging` | `preview` | `https://routes-proxy-43ten57gha-uc.a.run.app` | TestFlight builds for everyday use and testing |
| `production` | `production` | `https://routes-proxy-mpq2ul73ra-uc.a.run.app` | The build you submit for App Review |

Non-secret settings (bundle ID, team, proxy URLs, map provider) are committed in `eas.json`. EAS assigns build numbers (`appVersionSource: remote`, `autoIncrement`). The marketing version is `version` in `app.config.ts` (now `1.0.0`). Bump it for each App Store release.

There's no over-the-air update channel (`expo-updates`) yet. Every change ships as a new build.

## One-time setup

| What | Where | Status |
|---|---|---|
| EAS project `routes` (owner `triet05`) | `app.config.ts` `owner` and `extra.eas.projectId` | Done |
| `EXPO_TOKEN` | GitHub → repository secrets | Done |
| `GOOGLE_MAPS_IOS_KEY` | expo.dev → project → Environment variables, visibility **Sensitive**, in **preview** and **production** | To do |
| Signing (distribution certificate and provisioning profile) | Created by EAS on the first build, run from a terminal (see below) | To do |
| App Store Connect API key, for submitting | Created by EAS on the first `eas submit`, run from a terminal | To do |

Use the **iOS** Maps key from `routes-prod`, restricted to Maps SDK for iOS and `com.rebound.routes`, for both environments. The server key never goes into the app.

## First build (from your Mac, once)

The first build has to be interactive, so EAS can log in to Apple and create the signing credentials. Later builds can run from GitHub.

```
npx eas-cli@latest login
cd apps/mobile
npx eas-cli@latest build --profile staging --platform ios
npx eas-cli@latest submit --profile staging --platform ios --latest
```

- **`build`:** answer **yes** to "log in to your Apple account" and let EAS generate the distribution certificate and provisioning profile.
- **`submit`:** let EAS create an App Store Connect API key. It's stored on EAS, so later submits (including from GitHub) need no Apple login.

After processing (about 10–30 minutes), the build appears in App Store Connect → TestFlight. Install it on your phone with the TestFlight app.

## Later builds (GitHub)

GitHub → **Actions** → **App release** → **Run workflow**:

- **profile:** `staging` (default) or `production`. Production waits for your approval in the `production` environment.
- **submit:** send the build to TestFlight when it finishes (default on).

The job queues the build on EAS and exits (`--no-wait`). Follow progress on expo.dev → project → Builds. Without `EXPO_TOKEN` the workflow skips with a notice and stays green.

Each run uses one build from the EAS plan; the free plan has a monthly allowance. To build without using it, run `npx eas-cli@latest build --profile staging --platform ios --local` on your Mac (needs Xcode), then upload the `.ipa` with `npx eas-cli@latest submit --path <file>.ipa`.

## Releasing to the App Store

1. Bump `version` in `app.config.ts` if this is a new release. Merge.
2. Run **App release** with profile `production`. Approve it.
3. In App Store Connect, select the build on the version page, complete the listing (#37) and **Add for Review**.
