# Alpha Moms – Coffee Meet RSVP

Warm coffee-shop RSVP web app featuring a GPU-accelerated 3D question carousel, mobile `visualViewport` keyboard ergonomics, Cloud SQL (PostgreSQL) persistence with atomic seat-limit transactions, and an `/admin` organizer dashboard with SheetJS Excel export & import.

## Features

- **3D Coffee-Sleeve Question Carousel**: GPU-composited (`translate3d`, `rotateY`, `opacity`) 6-step RSVP flow plus celebratory Final Card with `☕` / `🤍` confetti.
- **Mobile Keyboard Ergonomics**: Uses `interactive-widget=resizes-visual` and `window.visualViewport` to hide chrome on touch keyboards and keep the keyboard open across consecutive text inputs.
- **Atomic Seat Capacity & Duplicate Phone Protection**: Uses PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) inside Drizzle transactions (`src/db/rsvps.ts`) so concurrent submissions never overbook the seat limit or allow duplicate phone numbers.
- **Organizer `/admin` Portal**: Protected by organizer credentials or Firebase Google Sign-In, with live stats, coffee order breakdown, search/filter, row editing & deletion, Event Settings editor, and SheetJS `.xlsx` export & import.

## Live Google Sheets Sync (Optional)

You can automatically mirror every new or updated RSVP into a Google Sheet using a Google Apps Script web app:

1. Create a Google Sheet and add these headers in Row 1:
   `ID | Created At | Mom's Name | Child's Name & Age | Phone | Attending | Paediatrician Question | Coffee Order`
2. Open **Extensions → Apps Script** and paste:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.id,
    data.created_at,
    data.mom_name,
    data.child_name_age,
    data.phone,
    data.attending,
    data.paediatrician_question,
    data.coffee_order,
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Click **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).
4. Copy the Web App URL and set `GOOGLE_SHEETS_WEBHOOK_URL` in your environment secrets.

## Deploying to Vercel (Without Backend Deployment)

`vercel.json` builds and serves the static React frontend (`dist/`) directly with **no backend deployment required** on Vercel:

- **Admin Login**: Works client-side out of the box (using Web Crypto SHA-256 verification or Google Sign-In after adding your `*.vercel.app` domain in **Firebase Console → Authentication → Settings → Authorized domains**).
- **Collecting RSVPs Across Devices**:
  - **Option A (Recommended)**: Keep your Cloud Run backend running and set `VITE_API_BASE_URL` in Vercel **Environment Variables** to your Cloud Run URL so all moms' RSVPs save to Cloud SQL PostgreSQL and appear in `/admin`.
  - **Option B (Zero Backend / Google Sheets)**: Set `VITE_GOOGLE_SHEETS_WEBHOOK_URL` in Vercel **Environment Variables** to your Google Apps Script Web App URL to send every RSVP straight to your Google Sheet.
  - **Option C (Local Demo)**: Without either variable set, RSVPs and Event Settings are stored in the current browser's `localStorage`.

