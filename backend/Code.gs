/**
 * ============================================================================
 * PLANETARIUM STAFF APP — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * ============================================================================
 * This is the complete backend for the Planetarium Staff App. It stores all
 * app data in the Google Sheet this script is bound to and serves it to the
 * app over HTTPS.
 *
 * SETUP
 *   1. Open your Google Sheet → Extensions → Apps Script.
 *   2. Replace the contents of Code.gs with this file (or, if you prefer to
 *      keep your existing script, only copy the two marked "NEW" blocks —
 *      see backend/README.md for exactly what to add).
 *   3. Deploy → Manage deployments → pencil icon → New version → Deploy.
 *
 * SHEETS USED (created automatically if missing):
 *   Users, Events, Requests, Time, TimeLogs, Settings, Manual
 *
 * WHAT'S NEW IN THIS VERSION
 *   • forgotPassword action — emails a staff member their password.
 *   • Manual sheet — stores the searchable Planetarium Manual topics.
 * ============================================================================
 */

// ============================================================================
// ENTRY POINTS
// ============================================================================

function doGet() {
  return jsonResponse_(readAllData_());
}

function doPost(e) {
  var payload = {};
  try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = {}; }

  // ── NEW BLOCK 1: FORGOT PASSWORD ────────────────────────────────────────
  // The login screen sends { action: 'forgotPassword', email: '...' }.
  // We email the staff member their password and always answer success so
  // the app never reveals which emails are registered.
  if (payload.action === 'forgotPassword') {
    handleForgotPassword_(String(payload.email || ''));
    return jsonResponse_({ success: true });
  }
  // ── END NEW BLOCK 1 ─────────────────────────────────────────────────────

  writeAllData_(payload);
  return jsonResponse_({ success: true });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// ── NEW BLOCK 2: FORGOT PASSWORD + MANUAL HELPERS ───────────────────────────
// ============================================================================

function handleForgotPassword_(emailRaw) {
  var email = emailRaw.trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return;

  var sheet = getOrCreateSheet_('Users', ['id', 'name', 'role', 'username', 'password', 'darkMode', 'maxHours']);
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
      var password = String(values[i][passCol]);
      MailApp.sendEmail(
        email,
        'Your Planetarium Staff Portal Password',
        'Hi ' + name + ',\n\n' +
        'Here is the password for your Planetarium Staff Portal account:\n\n' +
        '    ' + password + '\n\n' +
        'You can change it anytime in the app under Settings → My Account → Change Password.\n\n' +
        '— Loras College Planetarium'
      );
      return;
    }
  }
}

// Manual topics are stored as normal rows: id | category | title | content
function readManual_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Manual');
  if (!sheet) return [];
  return readRows_(sheet).map(function (r) {
    return { id: r.id, category: r.category, title: r.title, content: r.content };
  });
}

function writeManual_(manual) {
  var sheet = getOrCreateSheet_('Manual', ['id', 'category', 'title', 'content']);
  writeRows_(sheet, manual || []);
}

// ============================================================================
// READ / WRITE ALL DATA
// ============================================================================

function readAllData_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var data = {
    users: [],
    events: [],
    requests: [],
    time: { total: 0, max: 1000 },
    timeLogs: [],
    settings: { inviteKey: 'STARLIGHT', notifsEnabled: true, pauseShows: false },
    manual: []
  };

  var usersSheet = ss.getSheetByName('Users');
  if (usersSheet) data.users = readRows_(usersSheet);

  var eventsSheet = ss.getSheetByName('Events');
  if (eventsSheet) data.events = readRows_(eventsSheet);

  var requestsSheet = ss.getSheetByName('Requests');
  if (requestsSheet) data.requests = readRows_(requestsSheet);

  var timeLogsSheet = ss.getSheetByName('TimeLogs');
  if (timeLogsSheet) data.timeLogs = readRows_(timeLogsSheet);

  var timeSheet = ss.getSheetByName('Time');
  if (timeSheet) {
    var kv = readKeyValue_(timeSheet);
    data.time = { total: parseFloat(kv.total) || 0, max: parseFloat(kv.max) || 1000 };
  }

  var settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet) {
    var s = readKeyValue_(settingsSheet);
    Object.keys(s).forEach(function (k) {
      var v = s[k];
      if (v === 'TRUE' || v === true) v = true;
      else if (v === 'FALSE' || v === false) v = false;
      data.settings[k] = v;
    });
  }

  data.manual = readManual_();
  return data;
}

function writeAllData_(payload) {
  if (payload.users) writeRows_(getOrCreateSheet_('Users', null), payload.users);
  if (payload.events) writeRows_(getOrCreateSheet_('Events', null), payload.events);
  if (payload.requests) writeRows_(getOrCreateSheet_('Requests', null), payload.requests);
  if (payload.timeLogs) writeRows_(getOrCreateSheet_('TimeLogs', null), payload.timeLogs);

  if (payload.time) {
    writeKeyValue_(getOrCreateSheet_('Time', ['key', 'value']), {
      total: payload.time.total || 0,
      max: payload.time.max || 1000
    });
  }

  if (payload.settings) {
    writeKeyValue_(getOrCreateSheet_('Settings', ['key', 'value']), payload.settings);
  }

  // ── NEW BLOCK 3: save the manual ──
  if (payload.manual) writeManual_(payload.manual);
  // ── END NEW BLOCK 3 ──
}

// ============================================================================
// GENERIC SHEET HELPERS
// ============================================================================

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }
  return sheet;
}

// Reads a header-driven sheet into an array of objects.
function readRows_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    var empty = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = values[i][c];
      if (v !== '' && v !== null) empty = false;
      obj[headers[c]] = v;
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

// Writes an array of objects to a header-driven sheet (headers = union of keys).
function writeRows_(sheet, arr) {
  sheet.clearContents();
  if (!arr || !arr.length) return;

  var headers = [];
  arr.forEach(function (obj) {
    Object.keys(obj).forEach(function (k) {
      if (headers.indexOf(k) === -1) headers.push(k);
    });
  });

  var rows = [headers];
  arr.forEach(function (obj) {
    rows.push(headers.map(function (h) {
      var v = obj[h];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return v;
    }));
  });

  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
}

// Two-column key/value helpers (used by Time and Settings).
function readKeyValue_(sheet) {
  var values = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 0; i < values.length; i++) {
    var k = values[i][0];
    if (k === '' || k === null || k === 'key') continue;
    out[String(k)] = values[i][1];
  }
  return out;
}

function writeKeyValue_(sheet, obj) {
  sheet.clearContents();
  var rows = Object.keys(obj).map(function (k) { return [k, obj[k]]; });
  if (rows.length) sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}
