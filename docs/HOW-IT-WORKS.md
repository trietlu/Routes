# Routes — How the iOS app is built and run

Related: [Device testing](DEVICE-TESTING.md) (step by step) · [Command reference](COMMANDS.md) · [Architecture](architecture.md) (code structure)

How your TypeScript code becomes an app on a simulator or iPhone, what each server does, what code signing is, and how the tools find your phone. For step-by-step instructions, see [DEVICE-TESTING.md](DEVICE-TESTING.md).

## The big picture

```
 YOUR CODE                         GENERATED / INSTALLED              ON THE DEVICE
 apps/mobile (React, TypeScript)
 packages/* (routing-core, ...)  ──Metro──▶  JavaScript bundle ─────┐
                                                                    ▼
 apps/mobile/app.config.ts ──prebuild──▶ apps/mobile/ios/            Routes.app
                                         ├─ Routes  (native shell) ─▶ native code
                                         └─ Pods    (React Native,    + JS engine
                                                     Expo modules)    runs the bundle
                                    Xcode compiles ─────────────────┘
```

`apps/mobile/ios/Routes.xcworkspace` is the **native iOS shell that wraps the React Native code**. It's generated, not written by hand.

## From code to app, step by step

1. **Prebuild generates the shell.** Expo turns `apps/mobile/app.config.ts` into a native Xcode project in `apps/mobile/ios/`:
   - the app name and bundle ID;
   - the location permission text;
   - the `comgooglemaps` query scheme;
   - the minimum iOS version (16.4).

   The workspace contains two projects:

   | Project | What it is |
   |---|---|
   | **Routes** | The app's own native code: `AppDelegate.swift` (starts React Native), `Info.plist` (permission texts, settings), the splash screen, icons and the privacy manifest. Code signing is set here. |
   | **Pods** | Native libraries installed by CocoaPods: React Native itself (including the Hermes JavaScript engine) and Expo's native modules: location, SQLite, maps, linking. |

   Nothing in `apps/mobile/ios/` is hand-written, so deleting it is always safe: the next build regenerates it.
2. **CocoaPods installs the native libraries** (`pod install`): the Objective-C, Swift and C++ code behind React Native and the Expo modules.
3. **Xcode compiles `Routes.app`.** This is the native binary. It knows how to run JavaScript and talk to iOS, but contains none of your screens.
   - Simulator builds and iPhone builds are different binaries, compiled for different chips; one can't run on the other.
4. **Metro bundles your code** into one JavaScript file: all the TypeScript and React in `apps/mobile`, plus the shared packages (`@routes/routing-core`, `@routes/api-types`).
   - **Debug builds** (what `npm run ios` makes) download the bundle from Metro on your Mac at every launch. That's why saved edits show up within a second (Fast Refresh), and why the Metro terminal must stay open.
   - **Release builds** (TestFlight, App Store) have the bundle built in, so no Mac is needed.
5. **At runtime:**
   - The native shell starts, and the Hermes engine runs your bundle.
   - React decides what's on screen, and React Native renders it as real iOS views.
   - Calls to location, SQLite, maps and so on go through Expo's native modules.
   - Data comes from the proxy, which serves fixtures or calls Google.

## The two servers on your Mac

| Port | Server | Started by | Serves |
|---|---|---|---|
| **8080** | The **proxy** (`apps/proxy`) | You: `npm run proxy:dev` (fixtures) or `npm run proxy:live` (Google) | The app's **data**: routes and places |
| **8081** | **Metro**, the JavaScript bundler | `npm run ios -w @routes/mobile` (or `npm run start -w @routes/mobile`) | The app's **code**: the JavaScript bundle |

**Metro starts as the last step of `npm run ios`.** That command (`expo run:ios`) runs prebuild if needed, `pod install`, the Xcode build, then installs and launches the app, and finally **starts Metro in the same terminal and keeps it running**. So the build terminal becomes the Metro terminal; closing it disconnects the app from its code.

To start **only Metro** when the app is already installed and you've only changed TypeScript or React code:

```
npm run start -w @routes/mobile
```

Rebuild with `npm run ios …` only after native changes: new native packages, edits to `app.config.ts`, or Expo upgrades.

To see what's running:

```
lsof -nP -iTCP:8081 -sTCP:LISTEN    # Metro
lsof -nP -iTCP:8080 -sTCP:LISTEN    # proxy
```

**Simulator and phone reach the servers differently:**
- The **simulator** shares your Mac's network, so `localhost:8080` and `localhost:8081` just work.
- **On a phone**, `localhost` is the phone itself:
  - A Debug build for a device records your Mac's network address when it's built, and uses it to find Metro.
  - The proxy address comes from `EXPO_PUBLIC_PROXY_URL` in `apps/mobile/.env`, which you set to your Mac's IP.
  - Both must be on the same Wi-Fi.

## Code signing ("Signing & Capabilities")

iPhones only run apps that are **signed**, meaning cryptographically stamped by a developer Apple knows. The simulator doesn't require it; a phone does. Signing has four pieces. With **Automatically manage signing** on, Xcode creates and maintains them for you:

| Piece | What it is | For local development |
|---|---|---|
| **Team** | The developer identity everything belongs to | Your free **Personal Team**, or a paid Developer Program team |
| **Certificate** | Your signing key, stored in the Mac's keychain; proves you built the app | An **Apple Development** certificate. Signing in to Xcode doesn't create one, hence the first-build error "No code signing certificates are available to use" |
| **App ID (bundle ID)** | The app's unique identity, e.g. `com.<yourname>.routes.dev` | Must be unique to you on a free team; set with `IOS_BUNDLE_IDENTIFIER` in `apps/mobile/.env` |
| **Provisioning profile** | Apple's permission slip: *this certificate* may install *this app* on *these devices*, with *these capabilities* | Covers your iPhone's device ID. Free-team profiles expire after **7 days**. |

Where to find it in Xcode: open `apps/mobile/ios/Routes.xcworkspace` → click the blue **Routes** project → **Routes** under TARGETS → the **Signing & Capabilities** tab.

**Capabilities** are extra permissions an app asks Apple for, such as push notifications, iCloud and **App Attest** (needed for #27). They're added in the same tab with **+ Capability** and recorded in the provisioning profile. Some, including App Attest, need the paid Developer Program (#32).

**TestFlight and App Store builds** use a separate *distribution* certificate. EAS (#28) creates and manages those in the cloud.

## How Expo finds your iPhone

`npm run ios -w @routes/mobile -- --device` shows a picker with your simulators and any connected iPhone:

- **iPhones come from Apple's device service:** a background service on macOS tracks every iPhone that's connected (USB, or Wi-Fi after pairing) **and trusted**. It's the same list `xcrun devicectl list devices` prints. A phone only appears after the cable, **Trust This Computer** and **Developer Mode** steps in [DEVICE-TESTING.md](DEVICE-TESTING.md).
- **Simulators come from `xcrun simctl`.**

When you pick the phone, Expo:
1. builds for real iPhone hardware instead of the simulator;
2. signs the app with your certificate and profile;
3. installs it over the connection;
4. launches it, then starts Metro.

## The QR code

`npm run start -w @routes/mobile` prints a QR code. Scanning it with the iPhone Camera opens a link starting with `routes://`. That's the app's own URL scheme (`scheme: 'routes'` in `app.config.ts`), so iOS opens **Routes**, if it's installed on the phone.

- **Before the app is installed, scanning does nothing,** because no app owns `routes://` yet. Install it once over USB.
- **After that, scanning just opens the app,** which loads its code from Metro using the address recorded in the Debug build. The extra details in the QR link are ignored.
- **A full QR workflow,** where the code tells the app which Metro server to load from (useful with several Macs or over the internet), needs the `expo-dev-client` package, which the project doesn't include.

Expo Go can't run this app, because the app needs its own native configuration. Always use the app built by `npm run ios`.
