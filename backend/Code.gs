/**
 * ============================================================================
 * PLANETARIUM STAFF + PUBLIC BOX OFFICE — GOOGLE APPS SCRIPT BACKEND
 * ============================================================================
 * This is the complete shared backend for the staff app and public ticket site.
 * It stores all app data in the bound Google Sheet and serves it over HTTPS.
 *
 * SETUP
 *   1. Open your Google Sheet → Extensions → Apps Script.
 *   2. Replace the contents of Code.gs with this file.
 *   3. Deploy → Manage deployments → pencil icon → New version → Deploy.
 *
 * SHEETS USED (created automatically if missing):
 *   Users, Events, Requests, Time, TimeLogs, Settings, Manual
 *
 * INCLUDED ACTIONS
 *   • forgotPassword — emails a staff member their password.
 *   • reserve_seats — safely reserves public tickets and emails the QR wallet.
 *   • submitBooking — adds a pending private-group request.
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
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ success: false, message: 'Invalid JSON request.' });
  }

  // Never reveal whether a staff email is registered.
  if (payload.action === 'forgotPassword') {
    handleForgotPassword_(String(payload.email || ''));
    return jsonResponse_({ success: true });
  }

  // Serialize writes so simultaneous public bookings cannot overwrite each other.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (payload.action === 'reserve_seats') {
      return jsonResponse_(handleReserveSeats_(payload));
    }
    if (payload.action === 'submitBooking') {
      return jsonResponse_(handleSubmitBooking_(payload));
    }

    writeAllData_(payload);
    return jsonResponse_({ success: true });
  } catch (err) {
    return jsonResponse_({
      success: false,
      message: err && err.message ? err.message : 'The request could not be saved.'
    });
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}

// Public box office: increment reserved seats and email the ticket wallet.
function handleReserveSeats_(payload) {
  var eventId = String(payload.eventId || '').trim();
  var count = Number(payload.count);
  if (!eventId) throw new Error('A show is required.');
  if (!isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new Error('The ticket quantity is invalid.');
  }

  var sheet = getOrCreateSheet_('Events', null);
  var events = readRows_(sheet);
  var event = null;
  for (var i = 0; i < events.length; i++) {
    if (String(events[i].id) === eventId) {
      event = events[i];
      break;
    }
  }
  if (!event) throw new Error('That show is no longer available.');
  if (event.archived === true || String(event.archived).toUpperCase() === 'TRUE' ||
      event.canceled === true || String(event.canceled).toUpperCase() === 'TRUE') {
    throw new Error('That show is no longer available.');
  }

  var max = Number(event.max) || 0;
  var reserved = Number(event.reserved) || 0;
  var scanned = Number(event.scanned) || 0;
  var available = Math.max(0, max - reserved - scanned);
  if (count > available) {
    throw new Error(available > 0
      ? 'Only ' + available + ' seat(s) remain for this show.'
      : 'This show is sold out.');
  }

  event.reserved = reserved + count;
  writeRows_(sheet, events);

  var emailData = payload.emailData || {};
  var emailSent = false;
  try {
    emailSent = sendReservationEmail_(payload, event, emailData, count);
  } catch (err) {
    // Keep the confirmed reservation even if email delivery is unavailable.
    emailSent = false;
  }

  return {
    success: true,
    action: 'reserve_seats',
    reserved: event.reserved,
    emailSent: emailSent
  };
}

function sendReservationEmail_(payload, event, emailData, count) {
  var email = String(emailData.email || '').trim();
  if (!email || email.indexOf('@') === -1) return false;

  var name = String(emailData.name || 'Guest');
  var title = String(emailData.showTitle || event.title || 'Planetarium Show');
  var showDate = String(emailData.showDate || '');
  var ticketUrl = String(emailData.ticketUrl || '');
  if (!ticketUrl && payload.publicAppUrl) {
    ticketUrl = String(payload.publicAppUrl) +
      '?ticket=' + encodeURIComponent(event.id) +
      '&name=' + encodeURIComponent(name) +
      '&title=' + encodeURIComponent(title) +
      '&date=' + encodeURIComponent(event.date || '') +
      '&time=' + encodeURIComponent(event.time || '') +
      '&count=' + encodeURIComponent(count);
  }

  MailApp.sendEmail(
    email,
    'Your Planetarium Tickets — ' + title,
    'Hi ' + name + ',\n\n' +
    'Your reservation is confirmed for ' + count + ' seat(s).\n\n' +
    title + (showDate ? '\n' + showDate : '') + '\n\n' +
    'Open your QR ticket wallet here:\n' + ticketUrl + '\n\n' +
    'Please present the QR tickets to staff at the door.\n\n' +
    '— Loras College Heitkamp Planetarium'
  );
  return true;
}

// Private group form: append a pending request without replacing other data.
function handleSubmitBooking_(payload) {
  var required = ['group', 'contact', 'email', 'date', 'time'];
  for (var i = 0; i < required.length; i++) {
    if (!String(payload[required[i]] || '').trim()) {
      throw new Error('Please complete all required booking fields.');
    }
  }
  var size = Number(payload.size);
  if (!isFinite(size) || size < 1) throw new Error('The group size is invalid.');

  var sheet = getOrCreateSheet_('Requests', null);
  var requests = readRows_(sheet);
  var id = payload.id || Math.floor(Math.random() * 1000000);
  for (var j = 0; j < requests.length; j++) {
    if (String(requests[j].id) === String(id)) {
      return { success: true, action: 'submitBooking', requestId: id, duplicate: true };
    }
  }

  requests.push({
    id: id,
    group: String(payload.group).trim(),
    contact: String(payload.contact).trim(),
    email: String(payload.email).trim(),
    date: String(payload.date).trim(),
    time: String(payload.time).trim(),
    size: size,
    topics: String(payload.topics || 'General Show').trim(),
    status: 'pending',
    reserved: 0,
    scanned: 0,
    archived: false,
    assignments: []
  });
  writeRows_(sheet, requests);
  return { success: true, action: 'submitBooking', requestId: id };
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

// Reads a header-driven sheet into an array of objects. Sheets may coerce
// date/time strings into Date cells, so return stable values for the web apps.
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
      obj[headers[c]] = formatSheetValue_(v, headers[c]);
    }
    if (!empty) rows.push(obj);
  }
  return rows;
}

function formatSheetValue_(value, header) {
  if (Object.prototype.toString.call(value) !== '[object Date]' || isNaN(value.getTime())) {
    return value;
  }
  var timezone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var key = String(header || '').trim().toLowerCase();
  if (key === 'date' || key.slice(-4) === 'date') {
    return Utilities.formatDate(value, timezone, 'yyyy-MM-dd');
  }
  if (key === 'time' || key.slice(-4) === 'time') {
    return Utilities.formatDate(value, timezone, 'HH:mm');
  }
  return Utilities.formatDate(value, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
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
