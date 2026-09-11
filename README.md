# Office Attendance PWA

Mobile-first Progressive Web App for tracking hybrid office days against a **60%** monthly target (Mon–Fri working days; no holidays in v1).

## What it does

- Month calendar with previous/next navigation
- Tap a working day to cycle **Unset → Office → Not office → Clear** (or use the picker)
- Stats for the viewed month:
  - Working days
  - Minimum for 60% (`Math.ceil(0.6 × workingDays)`)
  - Attended (office days)
  - Still needed
  - Status: **Behind** / **On track** / **Done**
  - Evenly spaced **suggested** future unmarked working days to cover the remaining need
- Confirmed office days and suggestions use distinct colors
- Persists in `localStorage` under `office-attendance-pwa:v1` (dates as `YYYY-MM-DD`)
- Installable PWA (manifest, icons, service worker, standalone, theme color); works offline after first load

## Develop

```bash
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Build

```bash
npm install
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Install on your phone

Serve the app over **HTTPS** (or `localhost`) so the browser allows installation.

### From local / hosted URL

1. Run `npm run dev` (or deploy the `dist/` folder) and open the URL on your phone.
2. **iPhone (Safari):** Share → **Add to Home Screen**.
3. **Android (Chrome):** Menu ⋮ → **Install app** / **Add to Home screen**.

After install, open the home-screen icon for a standalone, offline-capable experience.

## Suggestion algorithm

Suggested days are chosen from today and future **unmarked** working days in the month. The app places the remaining needed count at even intervals along that candidate list, then greedily fills / refines to maximize spacing from existing office days (see comments in `src/lib/attendance.ts`).
