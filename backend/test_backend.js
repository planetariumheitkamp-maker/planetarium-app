const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class MockSheet {
  constructor(name, values = []) {
    this.name = name;
    this.values = values;
  }
  getDataRange() {
    return { getValues: () => this.values };
  }
  getRange(row, column) {
    assert.equal(row, 1);
    assert.equal(column, 1);
    return { setValues: (rows) => { this.values = rows; } };
  }
  clearContents() {
    this.values = [];
  }
}

const sheets = {
  Events: new MockSheet('Events', [
    ['id', 'title', 'date', 'time', 'max', 'reserved', 'scanned', 'archived', 'canceled'],
    ['E1', 'Test Show', '2026-11-27', '10:00', 90, 5, 0, false, false]
  ]),
  Requests: new MockSheet('Requests', [['id', 'group', 'status']]),
  Users: new MockSheet('Users', [
    ['id', 'name', 'role', 'username', 'password'],
    [1, 'Test Staff', 'staff', 'staff@example.edu', 'not-a-real-password']
  ])
};
const spreadsheet = {
  getSheetByName: (name) => sheets[name] || null,
  insertSheet: (name) => {
    sheets[name] = new MockSheet(name);
    return sheets[name];
  },
  getSpreadsheetTimeZone: () => 'UTC'
};
const emails = [];
let lockAcquisitions = 0;
let lockReleases = 0;

const context = vm.createContext({
  console,
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (content) => ({
      content,
      setMimeType() { return this; }
    })
  },
  LockService: {
    getScriptLock: () => ({
      waitLock: () => { lockAcquisitions += 1; },
      releaseLock: () => { lockReleases += 1; }
    })
  },
  MailApp: {
    sendEmail: (to, subject, body) => { emails.push({ to, subject, body }); }
  },
  Utilities: {
    formatDate: (date, timezone, format) => {
      if (format === 'yyyy-MM-dd') return date.toISOString().slice(0, 10);
      if (format === 'HH:mm') return date.toISOString().slice(11, 16);
      return date.toISOString();
    }
  }
});
vm.runInContext(fs.readFileSync(__dirname + '/Code.gs', 'utf8'), context);

function post(payload) {
  const response = context.doPost({ postData: { contents: JSON.stringify(payload) } });
  return JSON.parse(response.content);
}
function get() {
  return JSON.parse(context.doGet().content);
}

const requestPayload = {
  action: 'submitBooking',
  id: 12345,
  group: 'Test Group',
  contact: 'Test Contact',
  email: 'group@example.edu',
  date: '2026-12-01',
  time: '10:00',
  size: 25,
  topics: 'Stars'
};
let result = post(requestPayload);
assert.equal(result.success, true);
assert.equal(result.action, 'submitBooking');
assert.equal(get().requests.length, 1);
assert.equal(get().requests[0].status, 'pending');
assert.equal(get().requests[0].email, 'group@example.edu');

result = post(requestPayload);
assert.equal(result.duplicate, true);
assert.equal(get().requests.length, 1);

result = post({
  action: 'reserve_seats',
  eventId: 'E1',
  count: 2,
  publicAppUrl: 'https://example.edu/public.html',
  emailData: {
    name: 'Test Guest',
    email: 'guest@example.edu',
    showTitle: 'Test Show',
    showDate: 'Fri, November 27 @ 10:00 AM',
    ticketUrl: 'https://example.edu/public.html?ticket=E1&count=2'
  }
});
assert.equal(result.success, true);
assert.equal(result.action, 'reserve_seats');
assert.equal(result.reserved, 7);
assert.equal(result.emailSent, true);
assert.equal(get().events[0].reserved, 7);
assert.equal(emails.length, 1);
assert.equal(emails[0].to, 'guest@example.edu');
assert.match(emails[0].body, /ticket=E1&count=2/);

result = post({ action: 'reserve_seats', eventId: 'E1', count: 100 });
assert.equal(result.success, false);
assert.match(result.message, /seat/);
assert.equal(get().events[0].reserved, 7);
assert.equal(emails.length, 1);

result = post({ action: 'submitBooking', group: 'Incomplete' });
assert.equal(result.success, false);
assert.equal(get().requests.length, 1);

result = post({ manual: [{ id: 1, category: 'Test', title: 'Topic', content: 'Help' }] });
assert.equal(result.success, true);
assert.equal(get().manual.length, 1);
assert.equal(get().manual[0].title, 'Topic');

sheets.Events.values[1][2] = new Date('2026-11-27T06:00:00.000Z');
sheets.Events.values[1][3] = new Date('1899-12-30T19:00:00.000Z');
assert.equal(get().events[0].date, '2026-11-27');
assert.equal(get().events[0].time, '19:00');

result = post({ action: 'forgotPassword', email: 'staff@example.edu' });
assert.equal(result.success, true);
assert.equal(emails.length, 2);
assert.match(emails[1].body, /not-a-real-password/);

assert.equal(lockAcquisitions, lockReleases);
console.log('BACKEND_TESTS_OK', {
  requests: get().requests.length,
  reserved: get().events[0].reserved,
  manual: get().manual.length,
  emails: emails.length,
  locksBalanced: lockAcquisitions === lockReleases
});
