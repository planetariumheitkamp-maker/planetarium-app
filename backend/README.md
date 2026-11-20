# Shared backend setup (Google Apps Script)

`Code.gs` is the complete shared backend for the staff app and public ticket site. It supports:

- Staff users, events, private requests, hours, settings, and Manual topics
- Forgot Password emails
- Public seat reservations and ticket-wallet emails
- Private-group booking requests
- Serialized writes to prevent simultaneous public bookings from overwriting each other
- Stable `yyyy-MM-dd` dates and `HH:mm` times even when Google Sheets converts cells to dates

## Deploy or update

1. Open the **new** Google Sheet used by the staff app.
2. Select **Extensions → Apps Script**.
3. Replace the entire contents of `Code.gs` with this folder's `Code.gs` and save.
4. Select **Deploy → Manage deployments → ✏️ Edit**.
5. Set **Version → New version**, keep the existing web-app access settings, and select **Deploy**.
6. The existing `/exec` URL should remain the same. If Google issues a different URL, update `API_URL` in both `index.html` and `public.html`.
7. Approve any Google authorization prompt for Sheets, email, and web-app access.

> Editing and saving the script is not enough: the apps use the deployed version. Always create and deploy a new version.

## Verify after deployment

Open the deployed `/exec` URL. It should return JSON containing `users`, `events`, `requests`, `time`, `timeLogs`, `settings`, and `manual`.

Then make one small test reservation from `public.html` and one private request:

- The public page should open a QR ticket wallet after a reservation.
- The reservation should increment that show's `reserved` count.
- The ticket wallet email should arrive.
- The private request should appear in the staff app within about 10 seconds.

Remove only the test records afterward, without replacing the other sheet data.
