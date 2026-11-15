# Routes — Privacy Policy

_Last updated: November 15, 2026_

Routes is an iPhone app that compares driving routes by time or cost and opens the one you choose in Google Maps. This policy explains what information the app uses, where it goes, and how long it's kept.

**In short:** Routes has no accounts, no ads and no tracking. Your saved places and vehicle settings stay on your phone. To find routes and places, the app sends your search and locations to our server, which passes them to Google and doesn't keep them.

## Information that stays on your phone

The app stores these on your iPhone only. We never receive them.

- Your recent destinations (up to 10), and the places you save as Home and Work.
- Your vehicle settings (fuel economy and fuel price), used to estimate trip cost.
- App preferences, such as Fastest or Cheapest.
- A random identifier created when the app is first opened. It isn't linked to your name, Apple ID or device.

Deleting the app deletes all of this. You can also clear recents in the app.

## Information sent to find routes and places

When you search for a place or ask for routes, the app sends a request to our server. The request contains:

- the text you type in search;
- the start and destination of your trip, which may be your current location if you choose it;
- the random identifier above, used only to limit how many requests one phone can make.

Our server forwards the search and locations to **Google** (Google Maps Platform Routes and Places APIs), and returns the results to the app. Our server:

- doesn't store your searches, locations or identifier in any database;
- keeps recent results in memory for a short time (routes for 1 minute, search suggestions for 5 minutes, place details for 24 hours), so repeated requests are faster, and then discards them;
- keeps the random identifier in memory for up to an hour for rate limiting;
- writes operational logs that record only the type of request, whether it succeeded, and how long it took. They contain no search text, locations or identifiers.

Google processes these requests under the [Google Privacy Policy](https://policies.google.com/privacy) and the [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms).

## Location

Routes asks for permission to use your location **only while you use the app**. It uses your location to set the starting point of a trip and to show nearby search results. It never uses location in the background. You can turn location off in iOS Settings → Routes and type a starting address instead.

## Maps and Google Maps

- **The map in the app** is provided by the Google Maps SDK for iOS. Google states that this SDK collects crash and performance data, product interaction, and identifiers for analytics. That data isn't used for advertising or tracking. See the [Google Privacy Policy](https://policies.google.com/privacy).
- **"Open in Google Maps"** opens the Google Maps app or website with your trip's start and destination. Google's privacy policy applies to what happens there.

## What we don't do

- No accounts, sign-in or contact details.
- No advertising, and no selling or sharing of data for advertising.
- No tracking across other apps or websites.
- No analytics or crash-reporting service of our own.

## Children

Routes isn't directed at children under 13 and doesn't knowingly collect information from them.

## Changes

If this policy changes, the updated version will be posted here with a new date.

## Contact

Questions about privacy: open an issue at [github.com/trietlu/Routes/issues](https://github.com/trietlu/Routes/issues).
