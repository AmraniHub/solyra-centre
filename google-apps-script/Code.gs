// ─────────────────────────────────────────────────────────────
//  Centre Solyra — Google Apps Script
//  Paste full content into: script.google.com → Code.gs
//  Columns: # | Nom | WhatsApp | Lien WhatsApp | Service demandé | Statut | Notes | Contacté ? | Date
// ─────────────────────────────────────────────────────────────

var HEADERS = ['#', 'Nom', 'WhatsApp', 'Lien WhatsApp', 'Service demandé', 'Statut', 'Notes', 'Contacté ?', 'Date'];

var COL_NUM       = 1;
var COL_NAME      = 2;
var COL_PHONE     = 3;
var COL_WALINK    = 4;
var COL_SERVICE   = 5;
var COL_STATUS    = 6;
var COL_NOTES     = 7;
var COL_CONTACTED = 8;
var COL_DATE      = 9;

var STATUS_OPTIONS    = ['Nouveau', 'Contacté', 'Intéressé', 'Non disponible', 'Ne répond pas', 'Doublon'];
var CONTACTED_OPTIONS = ['Oui', 'Non'];

// ── Normalize Moroccan phone → 212XXXXXXXXX ───────────────────
function normalizePhone(raw) {
  var p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0') && p.length === 10) p = '212' + p.slice(1);
  else if (!p.startsWith('212') && p.length === 9) p = '212' + p;
  return p;
}

// ── Strip leading emoji / symbols from service name ───────────
function cleanService(s) {
  return String(s || '').trim()
    .replace(/^[\uD800-\uDFFF]{2}[\s]*/g, '')
    .replace(/^[^؀-ۿa-zA-Z0-9(]+/, '')
    .trim();
}

// ── doPost: called by Vercel on every form submission ─────────
function doPost(e) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leads') || ss.getActiveSheet();

  var data    = JSON.parse(e.postData.contents);
  var phone   = normalizePhone(data.phone);
  var waLink  = phone ? 'https://wa.me/' + phone : '';
  var service = cleanService(data.service);
  var rowNum  = Math.max(sheet.getLastRow(), 1);
  var dateStr = Utilities.formatDate(new Date(), 'Africa/Casablanca', 'dd/MM/yyyy HH:mm');

  sheet.appendRow([
    rowNum,
    data.name || '',
    phone,
    waLink,
    service,
    'Nouveau',
    '',
    'Non',
    dateStr
  ]);

  var newRow = sheet.getLastRow();

  // Clickable WhatsApp link
  if (waLink) {
    var cell = sheet.getRange(newRow, COL_WALINK);
    cell.setFormula('=HYPERLINK("' + waLink + '","WhatsApp 💬")');
    cell.setFontColor('#880e4f').setFontWeight('bold');
  }

  // Dropdown: Statut
  sheet.getRange(newRow, COL_STATUS).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_OPTIONS, true)
      .setAllowInvalid(false).build()
  );

  // Dropdown: Contacté ?
  sheet.getRange(newRow, COL_CONTACTED).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONTACTED_OPTIONS, true)
      .setAllowInvalid(false).build()
  );

  // Alternate row shading (light pink)
  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, HEADERS.length).setBackground('#fce4ec');
  }

  return ContentService
    .createTextOutput(JSON.stringify({ status: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: health check ───────────────────────────────────────
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'active', centre: 'Solyra' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── setup(): run ONCE to build the table — select "setup" → ▶ Run
function setup() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leads');
  if (!sheet) sheet = ss.insertSheet('Leads');

  sheet.clear();
  sheet.clearFormats();
  sheet.setRightToLeft(false);

  sheet.appendRow(HEADERS);

  var hr = sheet.getRange(1, 1, 1, HEADERS.length);
  hr.setFontWeight('bold')
    .setBackground('#880e4f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setFontSize(11);

  sheet.setFrozenRows(1);

  sheet.setColumnWidth(COL_NUM,        45);
  sheet.setColumnWidth(COL_NAME,      180);
  sheet.setColumnWidth(COL_PHONE,     150);
  sheet.setColumnWidth(COL_WALINK,    160);
  sheet.setColumnWidth(COL_SERVICE,   220);
  sheet.setColumnWidth(COL_STATUS,    140);
  sheet.setColumnWidth(COL_NOTES,     260);
  sheet.setColumnWidth(COL_CONTACTED, 110);
  sheet.setColumnWidth(COL_DATE,      145);

  // Pre-apply dropdowns to rows 2–500
  sheet.getRange(2, COL_STATUS, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_OPTIONS, true)
      .setAllowInvalid(false).build()
  );
  sheet.getRange(2, COL_CONTACTED, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(CONTACTED_OPTIONS, true)
      .setAllowInvalid(false).build()
  );

  SpreadsheetApp.getUi().alert('✅ Table prête ! Maintenant : Deploy → New Deployment → Web app → Anyone');
}
