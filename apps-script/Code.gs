/**
 * Little Lungs: Smart Anatomy Test. Cloud receiver for Google Sheets.
 *
 * Setup (once):
 * 1. Create a new Google Sheet. Open Extensions > Apps Script. Paste this whole file.
 * 2. Project Settings > Script properties > Add property: SYNC_KEY = any secret word.
 *    Type the same word in the app under Settings > Sync key.
 * 3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 4. Copy the web app URL (ends in /exec) into the app under Settings > Cloud link.
 * After editing this file, use Deploy > Manage deployments > Edit > New version.
 *
 * Each upload replaces that session's rows, so re-uploading after ground truth is added never duplicates data.
 */

var TABS = ['Roster', 'Sessions', 'Placements', 'Trials', 'Breaths', 'Answers', 'Reading', 'Prep', 'Events'];
var PHOTO_FOLDER = 'Anatomy Station board photos';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    if (!keyOk(body.key)) return json({ ok: false, error: 'Wrong sync key' });
    if (body.type === 'photo') return json(savePhoto(body));
    if (body.type === 'delete') {
      var book = SpreadsheetApp.getActiveSpreadsheet();
      TABS.forEach(function (name) { if (book.getSheetByName(name)) upsert(book, name, body.session_id, []); });
      return json({ ok: true, deleted: body.session_id });
    }
    if (!body.session_id || !body.tables) return json({ ok: false, error: 'Missing session data' });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    TABS.forEach(function (name) {
      if (body.tables[name]) upsert(ss, name, body.session_id, body.tables[name]);
    });
    return json({ ok: true, session_id: body.session_id });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action !== 'export') return json({ ok: true, message: 'Anatomy Station sync is running' });
  if (!keyOk(p.key)) return json({ ok: false, error: 'Wrong sync key' });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tables = {};
  TABS.forEach(function (name) {
    if (name === 'Roster') return; /* names never leave the Sheet */
    var sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) { tables[name] = []; return; }
    var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var header = values.shift();
    tables[name] = values.map(function (row) {
      var o = {};
      header.forEach(function (k, i) { o[k] = row[i]; });
      return o;
    });
  });
  return json({ ok: true, tables: tables });
}

function keyOk(k) {
  var key = PropertiesService.getScriptProperties().getProperty('SYNC_KEY');
  return !key || k === key;
}

function upsert(ss, name, sid, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var header = sh.getLastRow() > 0 ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(String) : [];
  rows.forEach(function (r) {
    Object.keys(r).forEach(function (k) { if (header.indexOf(k) < 0) header.push(k); });
  });
  if (!header.length) return;
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  sh.setFrozenRows(1);
  var col = header.indexOf('session_id') + 1;
  var last = sh.getLastRow();
  if (last > 1 && col > 0) {
    var ids = sh.getRange(2, col, last - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]) === String(sid)) sh.deleteRow(i + 2);
  }
  if (!rows.length) return;
  var values = rows.map(function (r) {
    return header.map(function (k) {
      var v = r[k];
      if (v === undefined || v === null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : v;
    });
  });
  sh.getRange(sh.getLastRow() + 1, 1, values.length, header.length).setValues(values);
}

function savePhoto(b) {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  var blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mime || 'image/jpeg', b.name);
  folder.createFile(blob);
  return { ok: true, name: b.name };
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
