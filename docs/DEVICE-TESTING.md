# Routes — Testing on the simulator and a real iPhone

Related: [Command reference](COMMANDS.md) · [Developer guide](developer.md) · [Test plan §9 (manual tests)](test-plan.md#9-manual-tests-man--human-real-iphone-before-beta)

The simulator covers most manual testing. A real iPhone is needed for what the simulator can't do: real GPS, handing off to the installed Google Maps app, and checking how the app feels on a phone.

## Simulator: what it can and can't test

| Area | On the simulator |
|---|---|
| **Location** | No GPS. Set it with **Features → Location → Custom Location…** or `xcrun simctl location booted set 39.7392,-104.9903`. Use Denver (the fixture origin) with `npm run proxy:dev`, or a real place with `npm run proxy:live`. With no location set, Home shows "Can't find your location yet" and switches to Current location within about 10 s of you setting one. |
| **Permission** | If you skipped location during onboarding, Home shows "Location is off". Fix it in the simulator's **Settings → Routes → Location → While Using the App**, or delete the app and run `npm run ios -w @routes/mobile` again to redo onboarding. |
| **Google Maps handoff** | The simulator has no App Store, so Google Maps can't be installed. **Open in Google Maps** shows the "Google Maps isn't installed" sheet, and **Open in browser** opens the directions in Safari, which tests the link (MAN-03). The real app handoff (MAN-01, MAN-02) needs a phone. |
| **Device choice** | Any iPhone simulator on iOS 16.4 or later. Pick one with `npm run ios -w @routes/mobile -- --device`. |

## Real iPhone: setup (once)

You need a Mac with Xcode 26 or 27, an iPhone on iOS 16.4 or later, a **data** USB cable, and both on the **same Wi-Fi network**.

Do these in order. The phone's **Developer Mode** switch is hidden until the Mac has recognised and trusted the phone and Xcode has connected to it.

1. **Apple ID in Xcode:** Xcode → Settings → Accounts → **+** → Apple ID. A free Apple ID works for your own phone; see [Free vs paid account](#free-vs-paid-apple-account).
2. **Get the Mac to see the phone:**
   - Unlock the phone and keep the screen on.
   - Use a **data** cable (the iPhone's own cable is safest) plugged **directly into the Mac**, not a hub, dock or monitor. Many USB-C cables only charge.
   - Allow the accessory on the Mac: if macOS asks "Allow accessory to connect?", choose **Allow**. Otherwise check System Settings → Privacy & Security → **Allow accessories to connect** ("Ask for new accessories" or "Automatically when unlocked"), then reconnect.
   - The iPhone should now appear in **Finder's sidebar** under Locations. Don't continue until it does.
3. **Trust the Mac:** click the iPhone in Finder; the phone asks **"Trust This Computer?"** Tap **Trust** and enter your passcode. If it never asks (you may have tapped "Don't Trust" before), reset it on the phone with Settings → General → Transfer or Reset iPhone → Reset → **Reset Location & Privacy**, then reconnect.
4. **Let Xcode connect:** Xcode → **Window → Devices and Simulators** (⇧⌘2) → select the iPhone, and wait while it prepares the device (minutes, the first time).
5. **Turn on Developer Mode:** iPhone → Settings → Privacy & Security, then scroll to the bottom → **Developer Mode** → on. The phone restarts; confirm when asked.
6. **Check:** `xcrun devicectl list devices` lists your iPhone as `physical`, not just `simulated` entries.
7. **Point the app at your Mac.** On the phone, `localhost` means the phone itself, so the app must call the proxy by your Mac's Wi-Fi address. Find it:

   ```
   ipconfig getifaddr en0
   ```

   Create or edit `apps/mobile/.env` (git-ignored):

   ```
   EXPO_PUBLIC_PROXY_URL=http://<your Mac's address>:8080
   IOS_BUNDLE_IDENTIFIER=com.<yourname>.routes.dev
   ```

   The bundle ID must be unique to you. A free Apple account can't use an ID someone else has registered, and the default `com.routes.app.dev` may be taken. Your Mac's address can change when you rejoin Wi-Fi; update the file if the app stops reaching the proxy.

   To switch back to the simulator, remove or comment out `EXPO_PUBLIC_PROXY_URL` (it defaults to `localhost`) and rebuild.

## Real iPhone: build and run

1. **Start the proxy with live data**, in its own terminal:

   ```
   npm run proxy:live
   ```

   On a phone, the start is your real GPS position. The fixture routes (`proxy:dev`) are all around Denver, so use live data. This needs `GOOGLE_MAPS_API_KEY` in the repo-root `.env`. Calls are billed to `routes-nonprod`.

2. **Build and install on the phone**, in a second terminal:

   ```
   rm -rf apps/mobile/ios
   npm run ios -w @routes/mobile -- --device
   ```

   Choose your iPhone from the list. Deleting `apps/mobile/ios` makes the new bundle ID take effect; you only need to do that when `apps/mobile/.env` or `app.config.ts` changes.

3. **If it fails with a signing error** ("No account", "requires a development team", or similar):
   1. Open `apps/mobile/ios/Routes.xcworkspace` in Xcode.
   2. Select the **Routes** target → **Signing & Capabilities**.
   3. Tick **Automatically manage signing**, and choose your Apple ID under **Team**.
   4. Run the command from step 2 again, without deleting `apps/mobile/ios` this time.

4. **The first time, trust your developer profile on the phone** if iOS says "Untrusted Developer": Settings → General → **VPN & Device Management** → your Apple ID → **Trust**.

5. **When the app opens:** allow **location**, and allow **local network** access if iOS asks. Keep the terminal from step 2 open: it runs Metro, which serves the app's JavaScript, and code changes reload on the phone.

## What to test on the phone

| ID | Test | Expect |
|---|---|---|
| MAN-01 | Google Maps **installed**. Search a destination → Results → route → **Open in Google Maps** | Google Maps opens and starts navigating to the right place, **from your current location** |
| MAN-02 | Type a different **start** address, then Open in Google Maps | Google Maps starts from **that** start |
| MAN-03 | **Delete** Google Maps, then Open in Google Maps | The "isn't installed" sheet appears. **Open in browser** loads directions; **Get Google Maps** opens the App Store page. |
| — | Real trips across a toll road | Toll prices (or "Toll, price unknown"), sensible "via" road names, and usually three distinct routes. Record findings on #36. |
| — | Location with weak GPS (indoors, first launch) | "Can't find your location yet" while searching, then Current location; never "Location is off" while permission is granted |

Google Maps may pick a different road than the route you chose; that's expected (BRD non-goal). For a toll-free route, Route detail reminds you to turn on Avoid tolls in Google Maps.

## Free vs paid Apple account

| | Free Apple ID | Apple Developer Program (paid, #32) |
|---|---|---|
| Install on your own phone over USB | Yes | Yes |
| How long the build works | **7 days**, then re-run step 2 to reinstall | One year |
| Bundle ID | Must be unique to you (see setup step 7) | Registered in your account |
| TestFlight (install without a cable, share with testers) | No | Yes, via EAS builds (#28) |
| App Attest on device (#27, MAN-09) | No | Yes |

## Troubleshooting

| Symptom | Fix |
|---|---|
| App shows "You're offline" or "Couldn't load routes" | Is `npm run proxy:live` running? Is `EXPO_PUBLIC_PROXY_URL` your Mac's *current* address (`ipconfig getifaddr en0`)? Are the phone and Mac on the same Wi-Fi? On the phone, open `http://<address>:8080/healthz` in Safari; it should show `{"ok":true}`. After changing `.env`, stop Metro and run step 2 again. |
| App opens to a red error screen or a blank screen | It can't reach Metro. Keep the step 2 terminal open, check the Wi-Fi, and shake the phone → **Reload**. |
| iOS never asks for local network access, and requests to the Mac fail | The app's settings don't yet include the text iOS shows for that prompt (`NSLocalNetworkUsageDescription`). Add it under `ios.infoPlist` in `apps/mobile/app.config.ts` (for example "Routes connects to your development computer on the local network."), then delete `apps/mobile/ios` and rebuild. |
| "Untrusted Developer" when opening the app | See build step 4: trust the profile in VPN & Device Management. |
| **Developer Mode isn't in the phone's Settings**, or Xcode never asks to trust the phone | The Mac isn't seeing the phone yet. Follow setup steps 2–4 in order: data cable directly into the Mac, allow the accessory, Finder shows the phone, Trust, Xcode Devices window. `xcrun devicectl list devices` must list it as `physical`. Work- or school-managed iPhones may block this. |
| App stops opening after about a week | The free-account build expired. Run step 2 again. |
| Scanning the QR code from `npm run start` does nothing | The QR workflow needs `expo-dev-client`, which the project doesn't include yet. Use the USB steps above. |
