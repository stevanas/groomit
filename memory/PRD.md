# GR-oom It (formerly PawFind) — Product Requirements Document

## Update 2026-06-30 (live data + filters)
- **Google Places API key added** → app now serves LIVE data (real shops, photos, ratings, Greek opening hours, Google reviews) + typed-location search via Geocoding.
- Fixed photo proxy route ordering (`/places/photo` was shadowed by `/places/{id}`); photos now stream correctly with redirect-following.
- Browse filters: **Open (now / specific day)** dropdown + **Open until [time]** + **Sort (Recommended / Distance / Rating)** with per-card distance (km). Open/closed badge restyled (icon + label, no clipping). "Open now" & "Open until" pills are equal-width (no clipping); 24h option sits at bottom of picker (disabled when no 24h data). Each card shows a closing-hour pill ("έως 20:30") in the image top-left corner.
- Find type options clarified: Groomer · Pet Shop · Both · Either. Selecting Groomer/Shop also surfaces "Both" stores. Full shop names (no truncation). "φροντίδα" added to Find subtitle.
- NOTE: day/"open until" filters use schedule data (full on seed; live nearby returns only open_now, so those advanced filters keep shops with unknown hours rather than hiding them).

## Update 2026-06-30 (rework)
- Renamed app to **GR-oom It** (Greek + grooming). Display font: Comfortaa (Greek-capable).
- **Greek is the default language**, English selectable in Profile (i18n in `src/i18n.tsx`, persisted on device).
- New palette: warm terracotta `#E2683C` + teal accent + cream (replaced pharmacy-green).
- **Login flow bypassed** (preserved in `src/auth.tsx` + `app/login.tsx`). Favorites are device-local; reviews not user-authored anymore.
- Navigation: **Find** (form: type dropdown / location / day) → **Browse** (combined search+list, optional map toggle on native) → **Saved** → **Profile**. Removed separate Explore/List split.
- Removed in-app review writing. Shop detail now shows **Google reviews + phone (tap to call) + opening hours schedule (today highlighted) + website**.
- Backend: Greek/Athens seed data with schedule+phone+sample reviews; added `/api/places/geocode`; `nearby` supports `day` + `lang`; detail returns structured `schedule` (seed) or `schedule_text` (Google) and `lang`-localized Google data.

---
# PawFind — Original Product Requirements Document

## Original Problem Statement
Build a mobile app for pet owners looking for pet shops and pet groomers, either nearby or at a certain location, showing reviews.

## User Choices
- Data source: Google Places API (live nearby shops + reviews) — requires GOOGLE_MAPS_API_KEY
- Reviews: app users write & rate in-app
- Auth: Google social login (Emergent-managed)
- Core screens: Map view with pins + nearby search, List view with filters, Shop detail page

## Architecture
- Frontend: Expo Router (React Native), expo-image, react-native-maps (native), expo-location, expo-linear-gradient
- Backend: FastAPI + MongoDB (Motor), httpx proxy to Google Places (New) Text Search / Place Details / Place Photos
- Auth: Emergent Google OAuth, Bearer session_token stored in expo-secure-store / localStorage
- Provider fallback: serves curated SEED data (6 shops) when GOOGLE_MAPS_API_KEY is empty, switches to live Google data when key is set

## User Personas
- Pet owner searching for nearby grooming or pet supplies, wants ratings/reviews and directions/call.

## Core Requirements (static)
- Discover pet shops & groomers by location, filter by category, view details, read/write reviews, save favorites, call/get directions.

## Implemented (2026-06-30)
- Google OAuth login screen + AuthContext (web + mobile flows)
- Tabs: Explore (map), List (filtered), Saved (favorites), Profile
- Map screen with floating search, category chips, Top Picks carousel; web fallback list for map
- List view with category chips, pull-to-refresh, open/closed badges
- Shop detail: hero, stats (Google rating + app rating + open status), reviews (Google + app), write-review modal, favorite toggle, Call + Get Directions sticky CTA
- Backend: places nearby/details/photo proxy, in-app reviews, favorites, auth session/me/logout — 18/18 backend tests passed

## Backlog
- P0: Add GOOGLE_MAPS_API_KEY to enable live data (currently seed mode)
- P1: Shop photo gallery/carousel on detail, before/after grooming gallery, services cards
- P1: Search by typed location/address (geocoding), distance display
- P2: Sort by rating/distance, filter by open-now, share shop, booking integration

## Next Tasks
1. Collect GOOGLE_MAPS_API_KEY from user → enable live Google Places
2. Add geocoded location search (search a city/area)
3. Services & photo gallery sections on Shop Detail
