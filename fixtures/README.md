# Fixtures

Raw Google-format responses served by the proxy in `PROVIDER=mock` and used by tests. They cover every fixture in [test plan §2](../docs/test-plan.md#2-canonical-fixture-and-expected-values).

**Don't edit the JSON by hand.** Change `scripts/fixtures/build.ts`, then run:

```
npm run fixtures:generate
```

The generator is deterministic. `scripts/fixtures.test.ts` fails if the committed files differ from its output.

| Path | Contents |
|---|---|
| `routes/<placeId>.tolls.json`, `routes/<placeId>.avoidTolls.json` | `computeRoutes` bodies, limited to the proxy's field mask. A missing file means that call returns HTTP 500. |
| `places/autocomplete/<key>.json` | Places API (New) autocomplete bodies |
| `places/details/<placeId>.json` | Place details bodies (`id`, `displayName`, `formattedAddress`, `location`) |
| `index.json` | Lookup tables and behaviours, described below |

**`index.json`**

- **`origin`:** the start point every route fixture was generated from. Use it as the simulator location.
- **`routes.byPlaceId`:** maps each destination place ID to its two files, plus an optional `behaviour`:
  - `empty`: both calls return `{}`.
  - `error500`: both calls fail.
  - `partialError`: the tolls call fails.
  - `delayMs`: respond after `delayMs`.
- **`routes.default`:** the fixture to serve for a destination with no entry.
- **`autocomplete.entries`:** the trimmed, lower-cased query is matched against each `prefix`, and the first entry it starts with wins.
- **`details`:** maps a place ID to its details file.
