// ─────────────────────────────────────────────────────────────
//  Centre Solyra — Google Apps Script
//  Paste full content into: script.google.com → Code.gs
//  Two sheets:
//    "Leads"       → bookings from index.html
//    "Candidatures" → job applications from recrutement.html
// ─────────────────────────────────────────────────────────────

// ── Leads sheet columns ───────────────────────────────────────
var LEAD_HEADERS   = ['#', 'Nom', 'WhatsApp', 'Lien WhatsApp', 'Service demandé', 'Statut', 'Notes', 'Contacté ?', 'Date'];
var L_NUM=1, L_NAME=2, L_PHONE=3, L_WALINK=4, L_SERVICE=5, L_STATUS=6, L_NOTES=7, L_CONTACTED=8, L_DATE=9;

// ── Candidatures sheet columns ────────────────────────────────
var RECR_HEADERS   = ['#', 'Nom', 'WhatsApp', 'Lien WhatsApp', 'Spécialité', 'Expérience', 'Ancien Salon', 'Statut', 'Notes', 'Contactée ?', 'Date'];
var R_NUM=1, R_NAME=2, R_PHONE=3, R_WALINK=4, R_SPEC=5, R_EXP=6, R_SALON=7, R_STATUS=8, R_NOTES=9, R_CONTACTED=10, R_DATE=11;

// ── Dropdown options ──────────────────────────────────────────
var LEAD_STATUS    = ['Nouveau', 'Contacté', 'Intéressé', 'Non disponible', 'Ne répond pas', 'Doublon'];
var RECR_STATUS    = ['Nouveau', 'Contactée', 'Entretien prévu', 'Retenue', 'Non retenue', 'En attente'];
var CONTACTED_OPTS = ['Oui', 'Non'];

// ── Normalize Moroccan phone → 212XXXXXXXXX ───────────────────
function normalizePhone(raw) {
  var p = String(raw || '').replace(/\D/g, '');
  if (p.startsWith('0') && p.length === 10) p = '212' + p.slice(1);
  else if (!p.startsWith('212') && p.length === 9) p = '212' + p;
  return p;
}

// ── Strip leading emoji from service/specialty ────────────────
function cleanText(s) {
  return String(s || '').trim()
    .replace(/^[\uD800-\uDFFF]{2}[\s]*/g, '')
    .replace(/^[^؀-ۿa-zA-Z0-9(]+/, '')
    .trim();
}

// ── doPost ────────────────────────────────────────────────────
function doPost(e) {
  var data = JSON.parse(e.postData.contents);

  if (data.type === 'recrutement') {
    return handleRecruitment(data);
  } else {
    return handleLead(data);
  }
}

// ── Handle booking lead ───────────────────────────────────────
function handleLead(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Leads') || ss.getActiveSheet();

  var phone   = normalizePhone(data.phone);
  var waLink  = phone ? 'https://wa.me/' + phone : '';
  var service = cleanText(data.service);
  var rowNum  = Math.max(sheet.getLastRow(), 1);
  var dateStr = Utilities.formatDate(new Date(), 'Africa/Casablanca', 'dd/MM/yyyy HH:mm');

  sheet.appendRow([rowNum, data.name || '', phone, waLink, service, 'Nouveau', '', 'Non', dateStr]);

  var newRow = sheet.getLastRow();

  if (waLink) {
    var cell = sheet.getRange(newRow, L_WALINK);
    cell.setFormula('=HYPERLINK("' + waLink + '","WhatsApp 💬")');
    cell.setFontColor('#880e4f').setFontWeight('bold');
  }

  sheet.getRange(newRow, L_STATUS).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(LEAD_STATUS, true).setAllowInvalid(false).build()
  );
  sheet.getRange(newRow, L_CONTACTED).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONTACTED_OPTS, true).setAllowInvalid(false).build()
  );

  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, LEAD_HEADERS.length).setBackground('#fce4ec');
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', sheet: 'Leads' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Handle recruitment application ───────────────────────────
function handleRecruitment(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Candidatures');
  if (!sheet) sheet = ss.insertSheet('Candidatures');

  var phone   = normalizePhone(data.phone);
  var waLink  = phone ? 'https://wa.me/' + phone : '';
  var spec    = cleanText(data.service);   // specialty sent as "service" from client
  var exp     = data.experience || '';
  var salon   = data.previousSalon || '';
  var rowNum  = Math.max(sheet.getLastRow(), 1);
  var dateStr = Utilities.formatDate(new Date(), 'Africa/Casablanca', 'dd/MM/yyyy HH:mm');

  sheet.appendRow([rowNum, data.name || '', phone, waLink, spec, exp, salon, 'Nouveau', '', 'Non', dateStr]);

  var newRow = sheet.getLastRow();

  if (waLink) {
    var cell = sheet.getRange(newRow, R_WALINK);
    cell.setFormula('=HYPERLINK("' + waLink + '","WhatsApp 💬")');
    cell.setFontColor('#6a1b9a').setFontWeight('bold');
  }

  sheet.getRange(newRow, R_STATUS).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(RECR_STATUS, true).setAllowInvalid(false).build()
  );
  sheet.getRange(newRow, R_CONTACTED).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONTACTED_OPTS, true).setAllowInvalid(false).build()
  );

  if (newRow % 2 === 0) {
    sheet.getRange(newRow, 1, 1, RECR_HEADERS.length).setBackground('#f3e5f5');
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'success', sheet: 'Candidatures' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doGet: health check ───────────────────────────────────────
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: 'active', centre: 'Solyra' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── setup(): run ONCE to build BOTH tables ────────────────────
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // ── Leads sheet ──
  var leads = ss.getSheetByName('Leads');
  if (!leads) leads = ss.insertSheet('Leads');
  leads.clear(); leads.clearFormats(); leads.setRightToLeft(false);
  leads.appendRow(LEAD_HEADERS);
  leads.getRange(1, 1, 1, LEAD_HEADERS.length)
    .setFontWeight('bold').setBackground('#880e4f')
    .setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(11);
  leads.setFrozenRows(1);
  leads.setColumnWidth(L_NUM, 45);  leads.setColumnWidth(L_NAME, 180);
  leads.setColumnWidth(L_PHONE, 150); leads.setColumnWidth(L_WALINK, 160);
  leads.setColumnWidth(L_SERVICE, 220); leads.setColumnWidth(L_STATUS, 140);
  leads.setColumnWidth(L_NOTES, 260); leads.setColumnWidth(L_CONTACTED, 110);
  leads.setColumnWidth(L_DATE, 145);
  leads.getRange(2, L_STATUS, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(LEAD_STATUS, true).setAllowInvalid(false).build()
  );
  leads.getRange(2, L_CONTACTED, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONTACTED_OPTS, true).setAllowInvalid(false).build()
  );

  // ── Candidatures sheet ──
  var recr = ss.getSheetByName('Candidatures');
  if (!recr) recr = ss.insertSheet('Candidatures');
  recr.clear(); recr.clearFormats(); recr.setRightToLeft(false);
  recr.appendRow(RECR_HEADERS);
  recr.getRange(1, 1, 1, RECR_HEADERS.length)
    .setFontWeight('bold').setBackground('#6a1b9a')
    .setFontColor('#ffffff').setHorizontalAlignment('center').setFontSize(11);
  recr.setFrozenRows(1);
  recr.setColumnWidth(R_NUM, 45);   recr.setColumnWidth(R_NAME, 180);
  recr.setColumnWidth(R_PHONE, 150); recr.setColumnWidth(R_WALINK, 160);
  recr.setColumnWidth(R_SPEC, 200);  recr.setColumnWidth(R_EXP, 150);
  recr.setColumnWidth(R_SALON, 180); recr.setColumnWidth(R_STATUS, 150);
  recr.setColumnWidth(R_NOTES, 260); recr.setColumnWidth(R_CONTACTED, 110);
  recr.setColumnWidth(R_DATE, 145);
  recr.getRange(2, R_STATUS, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(RECR_STATUS, true).setAllowInvalid(false).build()
  );
  recr.getRange(2, R_CONTACTED, 499, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONTACTED_OPTS, true).setAllowInvalid(false).build()
  );

  SpreadsheetApp.getUi().alert('✅ شيتَين جاهزتان!\n\n🌸 Leads — حجوزات العملاء\n💜 Candidatures — طلبات التوظيف\n\nالآن: Deploy → New Deployment → Web app → Anyone');
}
