# Native route preview contract checks

Run `pnpm test:sector:native` without a running app or network access.

These synthetic fixtures execute the actual `route-map-preview.native.tsx`
render function and practice-stop clustering with React elements, replacing
only React Native host components, react-native-maps and the theme hook.
They do not exercise the web renderer or call GPS, Mapbox or device storage.

Coverage includes missing/null/non-array/empty/singleton geometry, sparse
arrays, invalid points in every position, non-finite and out-of-range
coordinates, fallback text without any map primitives, and valid → invalid →
valid rendering with the same destination/duration. Recovered maps retain
the original route points, endpoints, simulated position, sector boundary and
grouped synthetic-stop overlays.

These are render-output contract checks, not a mounted React lifecycle test
or physical iOS/Android SDK verification. Device map mounting, gestures and
native camera behavior are not established by this suite.

Synthetic-stop checks also cover three nearby configuration numbers, separated
labels, exact square-anchor coordinates, dashed badge styling and text size,
callout distinctions, fixed initial-viewport grouping, and replay positions
coincident with stop anchors. These checks do not establish physical marker
readability during pinch/pan gestures or replay playback.

The practice text-scaling source guard checks that the simulation, sector
configuration, stop configuration and split screens do not disable native
React Native text scaling or clamp text with `numberOfLines`. It does not
measure native Dynamic Type/font-scale layout; that still requires a physical
iOS or Android device.
