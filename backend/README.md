# Backend setup (Google Apps Script)

The app syncs through a Google Apps Script Web App. Two new features —
**Forgot Password emails** and the **Planetarium Manual** — need the backend
to know about them. You have two options:

---

## Option A — Quick patch (recommended)

Keep your existing working script and add three small blocks.

### 1. Forgot Password — add to the top of your existing `doPost(e)`

```javascript
function doPost(e) {
  // === NEW: forgot-password handler (must stay above your normal save logic) ===
  var payload = {};
  try { payload = JSON.parse(e.postData.contents); } catch (err) {}
  if (payload.action === 'forgotPassword') {
    handleForgotPassword_(String(payload.email || ''));
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // === END NEW ===

  // ...your existing code below (you can reuse `payload` instead of parsing again)
```

Then add this function anywhere in the script:

```javascript
function handleForgotPassword_(emailRaw) {
  var email = emailRaw.trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet) return;
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  var headers = values[0].map(function (h) { return String(h).trim().toLowerCase(); });
  var userCol = headers.indexOf('username');
  var passCol = headers.indexOf('password');
  var nameCol = headers.indexOf('name');
  if (userCol === -1 || passCol === -1) return;

  for (var i = 1; i < values.length; i++) {
    var rowEmail = String(values[i][userCol] || '').trim().toLowerCase();
    if (rowEmail && rowEmail === email) {
      var name = nameCol > -1 ? String(values[i][nameCol]) : 'there';
      MailApp.sendEmail(
        email,
        'Your Planetarium Staff Portal Password',
        'Hi ' + name + ',\n\nHere is the password for your Planetarium Staff Portal account:\n\n' +
        '    ' + String(values[i][passCol]) + '\n\n' +
        'You can change it anytime in the app under Settings → My Account → Change Password.\n\n' +
        '— Loras College Planetarium'
      );
      return;
    }
  }
}
```

### 2. Manual — save it in your existing `doPost` alongside the other sections

```javascript
// === NEW: save manual topics ===
if (payload.manual) {
  var mSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Manual')
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet('Manual');
  mSheet.clearContents();
  if (payload.manual.length) {
    var rows = [['id', 'category', 'title', 'content']].concat(
      payload.manual.map(function (m) { return [m.id, m.category, m.title, m.content]; })
    );
    mSheet.getRange(1, 1, rows.length, 4).setValues(rows);
  }
}
// === END NEW ===
```

### 3. Manual — return it in your existing `doGet` response

Wherever you build the JSON object the app downloads, add:

```javascript
// === NEW: send manual topics to the app ===
var mSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Manual');
data.manual = [];
if (mSheet) {
  var mv = mSheet.getDataRange().getValues();
  for (var i = 1; i < mv.length; i++) {
    if (mv[i][0] === '' || mv[i][0] === null) continue;
    data.manual.push({ id: mv[i][0], category: mv[i][1], title: mv[i][2], content: mv[i][3] });
  }
}
// === END NEW ===
```

---

## Option B — Full replacement

Replace your whole `Code.gs` with `Code.gs` from this folder. It implements
everything (users, events, requests, time, timeLogs, settings, manual, and
forgot-password emails) and creates any missing sheets automatically.

---

## Either way, finish with:

1. **Save** the script.
2. **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy.**
   (The app talks to the deployed version, so changes don't go live until you
   deploy a new version.)
3. The first forgot-password email will ask you to authorize `MailApp` — approve it.

> ⚠️ Until you deploy the update, tapping "Forgot Password?" in the app will
> fail silently (the old script doesn't understand the request).
