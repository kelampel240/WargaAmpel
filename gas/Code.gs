/**
 * ============================================================================
 * WARGA AMPEL (DESA AMPEL) - BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ============================================================================
 * Penghubung tunggal antara Frontend Web App (GitHub Pages / HtmlService),
 * Google Sheets (DATABASE_SIWARGA), dan Google Drive (SIWARGA_DESA).
 */

// --- BLOK KONFIGURASI TUNGGAL (UBAH SESUAI ID MILIK DESA ANDA) ---
var CONFIG = {
  SPREADSHEET_ID: '1yGeHQ_rWh24fhTrK9NP19hO3L0TwoKXOVboczMAPhkY',
  ROOT_FOLDER_ID: '1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx',
  DEPLOYMENT_ID: 'AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec',
  NAMA_DESA: 'Desa Ampel',
  SESSION_TTL_HOURS: 12,
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIMES: ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
};

var DINAS_PROPOSAL_MESSAGE =
  'Usulan telah disampaikan kepada dinas terkait. Saat ini pemerintah desa sedang menunggu tindak lanjut.';

// --- ROUTING ENTRYPOINTS ---
function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || '';

  if (action === 'ping') {
    var ssId = '';
    try {
      ssId = getSpreadsheet_().getId();
    } catch (ignore) {}
    return jsonResponse({
      ok: true,
      service: 'WARGA_AMPEL_GAS',
      desa: CONFIG.NAMA_DESA,
      rootFolderId: CONFIG.ROOT_FOLDER_ID,
      spreadsheetId: ssId
    });
  }
  if (action === 'getActiveServices' || action === 'getPublicServices') {
    return jsonResponse({ services: getActiveServices() });
  }
  if (action === 'getPublicAnnouncements') {
    return jsonResponse(getPublicAnnouncements());
  }
  if (action === 'getPublicRoleAccounts') {
    return jsonResponse(getPublicRoleAccounts());
  }
  if (action === 'getPublicOrgStructure') {
    return jsonResponse(getPublicOrgStructure());
  }
  if (action === 'getDriveEvidence') {
    return jsonResponse(getDriveEvidence(params.idBukti, params.ticketId, params.token));
  }

  // Default: tampilkan halaman web HtmlService jika Frontend.html ada, atau halaman status API
  try {
    return HtmlService.createHtmlOutputFromFile('Frontend')
      .setTitle('WARGA AMPEL — ' + CONFIG.NAMA_DESA)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    var infoSsId = '';
    try { infoSsId = getSpreadsheet_().getId(); } catch (ignore) {}
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>API WARGA AMPEL — ' + CONFIG.NAMA_DESA + '</title></head>' +
      '<body style="font-family:sans-serif;max-width:640px;margin:40px auto;padding:24px;line-height:1.6;color:#0f172a">' +
      '<h2 style="color:#065f46;margin-top:0">Backend WARGA AMPEL (' + CONFIG.NAMA_DESA + ') Aktif</h2>' +
      '<p>Endpoint Google Apps Script sudah berjalan normal untuk GitHub Pages / aplikasi web.</p>' +
      '<ul><li><b>Folder Drive:</b> <code>' + CONFIG.ROOT_FOLDER_ID + '</code></li>' +
      '<li><b>Spreadsheet Database:</b> <code>' + (infoSsId || 'Belum terhubung — jalankan inisialisasiDriveSiwarga / setupDatabase') + '</code></li></ul>' +
      '</body></html>'
    ).setTitle('WARGA AMPEL — ' + CONFIG.NAMA_DESA)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = body.action || '';
    var payload = body.payload || {};
    var token = body.token || '';

    switch (action) {
      // Publik & Pelaporan Warga
      case 'ping':
        return jsonResponse({ ok: true, service: 'WARGA_AMPEL_GAS', desa: CONFIG.NAMA_DESA });
      case 'getPublicServices':
      case 'getActiveServices':
        return jsonResponse({ services: getActiveServices() });
      case 'getPublicAnnouncements':
        return jsonResponse(getPublicAnnouncements());
      case 'getPublicRoleAccounts':
        return jsonResponse(getPublicRoleAccounts());
      case 'submitReport':
        return jsonResponse(submitReport(payload, token));
      case 'getReportStatus':
        return jsonResponse(getReportStatus(payload.ticketId, payload.tanggalLahir, payload.last4Hp));
      case 'getDriveEvidence':
        return jsonResponse(getDriveEvidence(payload.idBukti, payload.ticketId, token));

      // Autentikasi & Akun Warga
      case 'authenticateUser':
        return jsonResponse(authenticateUser(payload.username, payload.password));
      case 'getAuthMe':
        return jsonResponse(getAuthMe(token));
      case 'registerCitizen':
        return jsonResponse(registerCitizen(payload));
      case 'verifyCitizenAccount':
        return jsonResponse(verifyCitizenAccount(payload));
      case 'resetPassword':
        return jsonResponse(resetPassword(payload));
      case 'getCitizenDashboard':
        return jsonResponse(getCitizenDashboard(token));
      case 'getCitizenReports':
        return jsonResponse(getCitizenReports(token));
      case 'markNotificationRead':
        return jsonResponse(markNotificationRead(payload.idNotifikasi, token));

      // Admin, Operator, Petugas & Kepala Desa
      case 'getAdminDashboard':
        return jsonResponse(getAdminDashboard(token));
      case 'getAllReports':
        return jsonResponse(getAllReports(payload, token));
      case 'getReportDetail':
        return jsonResponse(getReportDetail(payload.idLaporan, token));
      case 'updateReportStatus':
      case 'saveFollowUp':
        return jsonResponse(saveFollowUp(payload, token));
      case 'classifyReport':
        return jsonResponse(classifyReport(payload, token));
      case 'uploadEvidence':
        return jsonResponse(uploadEvidence(payload, token));
      case 'getAdminServices':
        return jsonResponse(getAdminServices(token));
      case 'createService':
        return jsonResponse(createService(payload, token));
      case 'updateService':
        return jsonResponse(updateService(payload, token));
      case 'deleteService':
        return jsonResponse(deleteService(payload.idLayanan, token));
      case 'getWarga':
        return jsonResponse(getWarga(token));
      case 'verifyWarga':
        return jsonResponse(verifyWarga(payload, token));
      case 'getPetugas':
        return jsonResponse(getPetugas(token));
      case 'createPetugas':
        return jsonResponse(createPetugas(payload, token));
      case 'importPetugasBatch':
        return jsonResponse(importPetugasBatch(payload, token));
      case 'getDriveTree':
        return jsonResponse(getDriveTree(token));
      case 'getAnnouncements':
        return jsonResponse(getAnnouncements(token));
      case 'createAnnouncement':
        return jsonResponse(createAnnouncement(payload, token));
      case 'deleteAnnouncement':
        return jsonResponse(deleteAnnouncement(payload.idPengumuman, token));
      case 'getSettings':
        return jsonResponse(getSettings(token));
      case 'saveSettings':
        return jsonResponse(saveSettings(payload, token));
      case 'getLogs':
        return jsonResponse(getLogs(token));
      case 'exportReport':
      case 'exportReportCsv':
        return jsonResponse(exportReportCsv(token));
      case 'getBackupJson':
        return jsonResponse(getBackupJson(token));
      case 'updateEvidenceDriveLink':
        return jsonResponse(updateEvidenceDriveLink(payload, token));
      case 'getPublicOrgStructure':
        return jsonResponse(getPublicOrgStructure());
      case 'getAdminOrgStructure':
        return jsonResponse(getAdminOrgStructure(token));
      case 'createOrgItem':
        return jsonResponse(createOrgItem(payload, token));
      case 'importOrgBatch':
        return jsonResponse(importOrgBatch(payload, token));
      case 'updateOrgItem':
        return jsonResponse(updateOrgItem(payload, token));
      case 'deleteOrgItem':
        return jsonResponse(deleteOrgItem(payload, token));
      case 'saveOrgSettings':
        return jsonResponse(saveOrgSettings(payload, token));
      default:
        return jsonResponse({ error: 'Aksi tidak dikenali: ' + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message || String(err) }, 500);
  }
}

// --- HELPER SPREADSHEET, GOOGLE DRIVE & KEAMANAN ---
function getRootDriveFolder_() {
  if (CONFIG.ROOT_FOLDER_ID && CONFIG.ROOT_FOLDER_ID.indexOf('GANTI_DENGAN') === -1) {
    try {
      return DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
    } catch (err) {
      // Fallback cari/buat folder SIWARGA_DESA jika ROOT_FOLDER_ID tidak dapat diakses akun ini
    }
  }
  var existing = DriveApp.getFoldersByName('SIWARGA_DESA');
  return existing.hasNext() ? existing.next() : DriveApp.createFolder('SIWARGA_DESA');
}

function trySetSharing_(item, access, perm) {
  try {
    if (item && typeof item.setSharing === 'function') {
      item.setSharing(access, perm);
    }
  } catch (ignore) {}
}

function normalizePhoneRead_(val) {
  if (val === null || val === undefined) return '';
  var raw = String(val).trim().replace(/^'+/, '').trim();
  if (!raw) return '';
  var lower = raw.toLowerCase();
  if (
    lower === '-' || lower === '--' || lower === '0' ||
    lower === 'tidak ada' || lower === 'belum ada' || lower === 'kosong' ||
    lower === 'n/a' || lower === 'na' || lower === 'null' || lower === 'none'
  ) {
    return '';
  }
  if (/[\/,;]/.test(raw)) {
    var parts = raw.split(/[\/,;]+/);
    for (var i = 0; i < parts.length; i++) {
      var cand = String(parts[i] || '').trim();
      if (cand && cand !== '-') {
        raw = cand;
        break;
      }
    }
  }
  var cleaned = raw.replace(/[\s\-().\u00A0\u200B]+/g, '');
  if (!cleaned || cleaned === '0' || cleaned === '-') return '';
  if (/^\+?620[1-9][0-9]{6,13}$/.test(cleaned)) {
    return '0' + cleaned.replace(/^\+?620/, '');
  }
  if (/^\+62[2-9][0-9]{6,13}$/.test(cleaned)) {
    return '0' + cleaned.slice(3);
  }
  if (/^62[2-9][0-9]{6,13}$/.test(cleaned)) {
    return '0' + cleaned.slice(2);
  }
  if (/^8[1-9][0-9]{6,12}$/.test(cleaned)) {
    return '0' + cleaned;
  }
  if (/^[2-79][0-9]{7,12}$/.test(cleaned)) {
    return '0' + cleaned;
  }
  return cleaned;
}

function formatPhoneForSheet_(val) {
  var norm = normalizePhoneRead_(val);
  if (!norm) return '';
  return norm.indexOf('0') === 0 ? ("'" + norm) : norm;
}

function inisialisasiDriveSiwarga() {
  var rootFolder = getRootDriveFolder_();
  trySetSharing_(rootFolder, DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  var subfolders = [
    '01_LAPORAN_WARGA',
    '02_SURAT_ADMINISTRASI',
    '03_BUKTI_PENANGANAN',
    '04_SURAT_KE_DINAS',
    '05_DOKUMEN_PENDUKUNG',
    '06_FOTO_ORGANISASI'
  ];
  subfolders.forEach(function(name) {
    var it = rootFolder.getFoldersByName(name);
    var sub = it.hasNext() ? it.next() : rootFolder.createFolder(name);
    trySetSharing_(sub, DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  });
  var ss = getSpreadsheet_();
  Logger.log('Folder Drive siap: ' + rootFolder.getUrl());
  Logger.log('Spreadsheet Database siap: ' + ss.getUrl());
  if (typeof setupDatabase === 'function') {
    setupDatabase();
  }
  return { rootFolderId: rootFolder.getId(), spreadsheetId: ss.getId() };
}

function getSpreadsheet_() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.indexOf('GANTI_DENGAN') === -1) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }

  var props = PropertiesService.getScriptProperties();
  var savedId = props.getProperty('DATABASE_SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (ignore) {}
  }

  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('DATABASE_SPREADSHEET_ID', active.getId());
    return active;
  }

  // Jika dijalankan sebagai Apps Script mandiri di Google Drive, cari atau buat DATABASE_SIWARGA di folder Drive
  var rootFolder = getRootDriveFolder_();
  var inFolder = rootFolder.getFilesByName('DATABASE_SIWARGA');
  while (inFolder.hasNext()) {
    var f = inFolder.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS && !f.isTrashed()) {
      props.setProperty('DATABASE_SPREADSHEET_ID', f.getId());
      return SpreadsheetApp.openById(f.getId());
    }
  }

  var globalSheets = DriveApp.getFilesByName('DATABASE_SIWARGA');
  while (globalSheets.hasNext()) {
    var gf = globalSheets.next();
    if (gf.getMimeType() === MimeType.GOOGLE_SHEETS && !gf.isTrashed()) {
      props.setProperty('DATABASE_SPREADSHEET_ID', gf.getId());
      return SpreadsheetApp.openById(gf.getId());
    }
  }

  var created = SpreadsheetApp.create('DATABASE_SIWARGA');
  try {
    DriveApp.getFileById(created.getId()).moveTo(rootFolder);
  } catch (ignore) {}
  props.setProperty('DATABASE_SPREADSHEET_ID', created.getId());
  Logger.log('Spreadsheet DATABASE_SIWARGA dibuat otomatis di Drive: ' + created.getUrl());
  return created;
}

function getSheet_(name) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Tab "' + name + '" belum dibuat. Jalankan setupDatabase() terlebih dahulu.');
  return sh;
}

function sheetToObjects_(sheetName) {
  var sh = getSheet_(sheetName);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = { _rowIndex: i + 1 };
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[i][c];
    }
    rows.push(obj);
  }
  return rows;
}

function parseJsonSafe_(val, fallback) {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(String(val));
  } catch (err) {
    return fallback;
  }
}

function hashSha256_(text, salt) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, (salt || '') + ':' + text);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function maskNik_(nik) {
  var digits = String(nik || '').replace(/\D/g, '');
  if (digits.length < 10) return '******';
  return digits.slice(0, 6) + '******' + digits.slice(-4);
}

function maskKk_(kk) {
  return maskNik_(kk);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logActivity_(user, aksi, idTerkait, detail) {
  var sh = getSheet_('LOG_AKTIVITAS');
  sh.appendRow([
    'LOG-' + Date.now(),
    new Date().toISOString(),
    user ? user.ID_USER : 'PUBLIC',
    user ? user.NAMA_LENGKAP : 'Warga',
    user ? user.ROLE : 'WARGA',
    aksi,
    idTerkait,
    detail
  ]);
}

function saveNotification(targetUserId, targetRole, idLaporan, judul, pesan) {
  var sh = getSheet_('NOTIFIKASI');
  sh.appendRow([
    'NTF-' + Date.now(),
    targetUserId,
    targetRole,
    idLaporan || '',
    judul,
    pesan,
    false,
    new Date().toISOString()
  ]);
}

// --- 1. AUTENTIKASI & OTORISASI SESI ---
function ensureDefaultSeedAccounts_() {
  var shUsers = getSheet_('USERS');
  if (shUsers.getLastRow() > 2) return;
  var existingRows = shUsers.getDataRange().getValues();
  var existingUsernames = {};
  for (var i = 1; i < existingRows.length; i++) {
    existingUsernames[String(existingRows[i][1] || '').trim().toLowerCase()] = true;
  }
  var salt = 'siwarga2026';
  var nowIso = new Date().toISOString();
  var defaults = [
    ['USR-ADMIN-01', 'admin', 'Super Admin Desa Ampel', 'admin@ampel.desa.id', "'081100000001", 'AdminAmpel2026!', 'SUPER_ADMIN', ''],
    ['USR-KADES-01', 'kades', 'H. Sutrisno (Kepala Desa)', 'kades@ampel.desa.id', "'081100000002", 'KadesAmpel2026!', 'KEPALA_DESA', ''],
    ['USR-OP-01', 'operator', 'Rina Kusuma (Operator)', 'operator@ampel.desa.id', "'081100000003", 'OperatorAmpel2026!', 'OPERATOR', ''],
    ['USR-PTG-01', 'petugas', 'Hendra Wijaya (Petugas Lapangan)', 'hendra@ampel.desa.id', "'081100000004", 'PetugasAmpel2026!', 'PETUGAS', ''],
    ['USR-WRG-01', 'sriwahyuni', 'Ibu Sri Wahyuni', 'sri.wahyuni@warga.ampel.id', "'081234567801", 'WargaAmpel2026!', 'WARGA', 'AMP-4821'],
    ['USR-WRG-02', 'pakslamet', 'Bapak Slamet Riyadi', 'slamet@warga.ampel.id', "'081398765402", 'WargaAmpel2026!', 'WARGA', 'AMP-7712']
  ];
  defaults.forEach(function(u) {
    if (!existingUsernames[u[1]]) {
      var passHash = salt + ':' + hashSha256_(u[5], salt);
      shUsers.appendRow([u[0], u[1], u[2], u[3], u[4], passHash, u[6], 'AKTIF', u[7], nowIso]);
    }
  });
  var shWarga = getSheet_('WARGA');
  if (shWarga.getLastRow() <= 1) {
    shWarga.appendRow([
      'WRG-001', 'USR-WRG-01', 'Ibu Sri Wahyuni', '330901******0003',
      hashSha256_('3309015407750003', 'siwarga_nik'), '330901******0011',
      '1975-07-14', 'Dusun Krajan Timur No. 12', 'RT 02 / RW 01', "'081234567801",
      'TERVERIFIKASI', nowIso
    ]);
    shWarga.appendRow([
      'WRG-002', 'USR-WRG-02', 'Bapak Slamet Riyadi', '330901******0008',
      hashSha256_('3309011803640008', 'siwarga_nik'), '330901******0022',
      '1964-03-18', 'Dusun Sumberjo No. 05', 'RT 04 / RW 02', "'081398765402",
      'TERVERIFIKASI', nowIso
    ]);
  }
}

function formatDateIsoGas_(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val).trim().slice(0, 10);
}

function buildSessionUserFromRowGas_(userRow) {
  var wargaProfile = null;
  try {
    var wargaRows = sheetToObjects_('WARGA');
    for (var i = 0; i < wargaRows.length; i++) {
      if (wargaRows[i].ID_USER === userRow.ID_USER) {
        wargaProfile = wargaRows[i];
        break;
      }
    }
  } catch (ignore) {}
  return {
    idUser: userRow.ID_USER,
    username: userRow.USERNAME,
    namaLengkap: userRow.NAMA_LENGKAP,
    role: userRow.ROLE,
    noHp: normalizePhoneRead_(userRow.NO_HP),
    statusAkun: userRow.STATUS_AKUN || 'AKTIF',
    idWarga: wargaProfile ? wargaProfile.ID_WARGA : undefined,
    nikMasked: wargaProfile ? wargaProfile.NIK_MASKED : undefined,
    tanggalLahir: wargaProfile ? formatDateIsoGas_(wargaProfile.TANGGAL_LAHIR) : undefined,
    rtRw: wargaProfile ? String(wargaProfile.RT_RW || '') : undefined,
    alamat: wargaProfile ? String(wargaProfile.ALAMAT || '') : undefined
  };
}

function getPublicRoleAccounts() {
  ensureDefaultSeedAccounts_();
  var users = sheetToObjects_('USERS');
  var roles = ['SUPER_ADMIN', 'KEPALA_DESA', 'OPERATOR', 'PETUGAS', 'WARGA'];
  var accounts = [];
  for (var r = 0; r < roles.length; r++) {
    var targetRole = roles[r];
    var best = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].ROLE === targetRole) {
        if (!best) best = users[i];
        if (users[i].STATUS_AKUN === 'AKTIF') {
          best = users[i];
          break;
        }
      }
    }
    if (best) {
      accounts.push({
        idUser: best.ID_USER,
        username: best.USERNAME,
        namaLengkap: best.NAMA_LENGKAP,
        role: best.ROLE
      });
    }
  }
  return { accounts: accounts };
}

function authenticateUser(username, password) {
  if (!username || !password) throw new Error('Username dan kata sandi wajib diisi.');
  ensureDefaultSeedAccounts_();
  var users = sheetToObjects_('USERS');
  var key = String(username).trim().toLowerCase();
  var normInputHp = normalizePhoneRead_(username);
  var found = null;
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var uHp = normalizePhoneRead_(u.NO_HP);
    if (
      String(u.USERNAME || '').trim().toLowerCase() === key ||
      String(u.EMAIL || '').trim().toLowerCase() === key ||
      String(u.NO_HP || '').trim() === String(username).trim() ||
      (normInputHp && uHp && uHp === normInputHp)
    ) {
      found = u;
      break;
    }
  }
  if (!found) throw new Error('Akun tidak ditemukan.');
  var parts = String(found.PASSWORD_HASH).split(':');
  var hashedInput = parts.length === 2 ? parts[0] + ':' + hashSha256_(password, parts[0]) : hashSha256_(password, '');
  if (hashedInput !== found.PASSWORD_HASH) throw new Error('Kata sandi tidak sesuai.');
  if (found.STATUS_AKUN !== 'AKTIF') throw new Error('Akun belum diverifikasi atau nonaktif.');

  var token = Utilities.base64EncodeWebSafe(JSON.stringify({
    idUser: found.ID_USER,
    username: found.USERNAME,
    nama: found.NAMA_LENGKAP,
    role: found.ROLE,
    exp: Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000
  }));
  var sig = hashSha256_(token, getSpreadsheet_().getId());
  var fullToken = token + '.' + sig;

  try {
    logActivity_(found, 'LOGIN', found.ID_USER, 'Berhasil masuk ke portal WARGA AMPEL.');
  } catch (ignore) {}
  return {
    token: fullToken,
    user: buildSessionUserFromRowGas_(found)
  };
}

function verifyTokenAndRole_(token, allowedRoles) {
  if (!token) throw new Error('Sesi login diperlukan.');
  var parts = String(token).split('.');
  if (parts.length !== 2) throw new Error('Token sesi tidak valid.');
  if (hashSha256_(parts[0], getSpreadsheet_().getId()) !== parts[1]) {
    throw new Error('Integritas token tidak valid.');
  }
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error('Sesi login telah kedaluwarsa.');
  }

  // Utamakan data terbaru langsung dari tabel USERS di Google Sheets
  var liveUser = null;
  try {
    var users = sheetToObjects_('USERS');
    for (var i = 0; i < users.length; i++) {
      if (users[i].ID_USER === payload.idUser) {
        liveUser = users[i];
        break;
      }
    }
  } catch (ignore) {}

  if (liveUser && liveUser.STATUS_AKUN === 'NONAKTIF') {
    throw new Error('Akun Anda dinonaktifkan. Hubungi pengelola desa.');
  }

  var effectiveRole = liveUser ? liveUser.ROLE : payload.role;
  if (allowedRoles && allowedRoles.indexOf(effectiveRole) === -1) {
    throw new Error('Anda tidak memiliki hak akses untuk tindakan ini.');
  }

  if (liveUser) {
    return {
      ID_USER: liveUser.ID_USER,
      USERNAME: liveUser.USERNAME,
      NAMA_LENGKAP: liveUser.NAMA_LENGKAP,
      ROLE: liveUser.ROLE,
      NO_HP: normalizePhoneRead_(liveUser.NO_HP),
      STATUS_AKUN: liveUser.STATUS_AKUN
    };
  }
  return {
    ID_USER: payload.idUser,
    USERNAME: payload.username || '',
    NAMA_LENGKAP: payload.nama,
    ROLE: payload.role,
    NO_HP: '',
    STATUS_AKUN: 'AKTIF'
  };
}

function getAuthMe(token) {
  var actor = verifyTokenAndRole_(token, null);
  return {
    user: buildSessionUserFromRowGas_(actor)
  };
}

function registerCitizen(payload) {
  var nama = String(payload.namaLengkap || '').trim();
  var username = String(payload.username || '').trim().toLowerCase();
  var email = String(payload.email || '').trim();
  var noHp = String(payload.noHp || '').trim();
  var password = String(payload.password || '');
  var nik = String(payload.nik || '').replace(/\D/g, '');
  var kk = String(payload.kk || '').replace(/\D/g, '');
  var dob = String(payload.tanggalLahir || '').trim();
  var alamat = String(payload.alamat || '').trim();
  var rtRw = String(payload.rtRw || '').trim();

  if (nama.length < 3 || username.length < 4 || password.length < 8 || nik.length !== 16 || noHp.length < 9) {
    throw new Error('Lengkapi data pendaftaran (Nama, Username >=4, Kata Sandi >=8, NIK 16 digit, No. HP).');
  }

  var users = sheetToObjects_('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].USERNAME).toLowerCase() === username) {
      throw new Error('Username sudah terdaftar.');
    }
  }

  var idUser = 'USR-' + Date.now();
  var idWarga = 'WRG-' + Date.now();
  var salt = 'warga' + Date.now();
  var passHash = salt + ':' + hashSha256_(password, salt);
  var kodeVerif = String(Math.floor(100000 + Math.random() * 900000));
  var now = new Date().toISOString();

  getSheet_('USERS').appendRow([
    idUser, username, nama, email, noHp, passHash, 'WARGA', 'PENDING_VERIFIKASI', kodeVerif, now
  ]);

  getSheet_('WARGA').appendRow([
    idWarga, idUser, nama, maskNik_(nik), hashSha256_(nik, 'NIK'),
    kk.length === 16 ? maskKk_(kk) : '-', dob, alamat, rtRw || 'Desa Ampel', noHp, 'BELUM_TERVERIFIKASI', now
  ]);

  logActivity_({ ID_USER: idUser, NAMA_LENGKAP: nama, ROLE: 'WARGA' }, 'REGISTER_WARGA', idUser, 'Pendaftaran akun warga baru.');
  return {
    message: 'Akun berhasil dibuat. Gunakan kode verifikasi untuk mengaktifkan akun.',
    username: username,
    kodeVerifikasi: kodeVerif
  };
}

function verifyCitizenAccount(payload) {
  var username = String(payload.username || '').trim().toLowerCase();
  var kode = String(payload.kodeVerifikasi || payload.kode || '').trim();
  var users = sheetToObjects_('USERS');
  var sh = getSheet_('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].USERNAME).toLowerCase() === username) {
      if (String(users[i].KODE_VERIFIKASI) !== kode) {
        throw new Error('Kode verifikasi tidak sesuai.');
      }
      sh.getRange(users[i]._rowIndex, 8).setValue('AKTIF');
      sh.getRange(users[i]._rowIndex, 9).setValue('');
      var found = users[i];
      var token = Utilities.base64EncodeWebSafe(JSON.stringify({
        idUser: found.ID_USER,
        username: found.USERNAME,
        nama: found.NAMA_LENGKAP,
        role: found.ROLE,
        exp: Date.now() + CONFIG.SESSION_TTL_HOURS * 3600 * 1000
      }));
      var sig = hashSha256_(token, getSpreadsheet_().getId());
      return {
        token: token + '.' + sig,
        user: {
          idUser: found.ID_USER,
          username: found.USERNAME,
          namaLengkap: found.NAMA_LENGKAP,
          role: found.ROLE
        }
      };
    }
  }
  throw new Error('Username tidak ditemukan.');
}

function resetPassword(payload) {
  var username = String(payload.username || '').trim().toLowerCase();
  var dob = String(payload.tanggalLahir || '').trim();
  var noHp = String(payload.noHp || '').trim();
  var newPassword = String(payload.newPassword || '');
  if (newPassword.length < 8) throw new Error('Kata sandi baru minimal 8 karakter.');

  var users = sheetToObjects_('USERS');
  var warga = sheetToObjects_('WARGA');
  var sh = getSheet_('USERS');
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].USERNAME).toLowerCase() === username) {
      var userWarga = null;
      for (var w = 0; w < warga.length; w++) {
        if (warga[w].ID_USER === users[i].ID_USER) {
          userWarga = warga[w];
          break;
        }
      }
      var dobVal = userWarga && userWarga.TANGGAL_LAHIR instanceof Date
        ? userWarga.TANGGAL_LAHIR.toISOString().slice(0, 10)
        : String(userWarga ? userWarga.TANGGAL_LAHIR : '').slice(0, 10);
      var dobMatch = dob && dobVal === dob;
      var hpMatch = noHp && String(users[i].NO_HP) === noHp;
      if (!dobMatch && !hpMatch) {
        throw new Error('Tanggal lahir atau nomor HP tidak cocok dengan akun terdaftar.');
      }
      var salt = 'rst' + Date.now();
      var passHash = salt + ':' + hashSha256_(newPassword, salt);
      sh.getRange(users[i]._rowIndex, 6).setValue(passHash);
      return { ok: true, message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' };
    }
  }
  throw new Error('Username tidak ditemukan.');
}

// --- 2. PENOMORAN TIKET ATOMIK DENGAN LOCKSERVICE ---
function generateTicketNumber() {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getSheet_('PENGATURAN');
    var data = sh.getDataRange().getValues();
    var counterRow = -1;
    var counterVal = 0;
    var tahun = new Date().getFullYear();

    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === 'TICKET_COUNTER') {
        counterRow = i + 1;
        counterVal = Number(data[i][1]) || 0;
      }
      if (data[i][0] === 'TAHUN_TIKET' && data[i][1]) {
        tahun = Number(data[i][1]);
      }
    }
    var next = counterVal + 1;
    if (counterRow > 0) {
      sh.getRange(counterRow, 2).setValue(next);
    } else {
      sh.appendRow(['TICKET_COUNTER', next, 'Counter nomor tiket']);
    }
    SpreadsheetApp.flush();
    var padded = ('000000' + next).slice(-6);
    return 'SW-' + tahun + '-' + padded;
  } finally {
    lock.releaseLock();
  }
}

// --- 3. PELAPORAN WARGA ---
function submitReport(payload, token) {
  var sessionUser = null;
  if (token) {
    try {
      sessionUser = verifyTokenAndRole_(token, null);
    } catch (e) {
      sessionUser = null;
    }
  }

  var wargaRow = null;
  if (sessionUser) {
    try {
      var wargaList = sheetToObjects_('WARGA');
      for (var w = 0; w < wargaList.length; w++) {
        if (wargaList[w].ID_USER === sessionUser.ID_USER) {
          wargaRow = wargaList[w];
          break;
        }
      }
    } catch (ignore) {}
  }

  var nama = String(payload.namaPelapor || (sessionUser ? sessionUser.NAMA_LENGKAP : '') || '').trim();
  var noHp = normalizePhoneRead_(payload.noHpPelapor || (sessionUser ? sessionUser.NO_HP : '') || '');
  var noHpDigits = noHp.replace(/\D/g, '');
  var dob = String(payload.tanggalLahir || (wargaRow ? formatDateIsoGas_(wargaRow.TANGGAL_LAHIR) : '') || '').trim();
  var uraian = String(payload.uraianMasalah || '').trim();
  var alamat = String(payload.lokasiAlamat || (wargaRow ? wargaRow.ALAMAT : '') || '').trim();

  if (nama.length < 2 || noHpDigits.length < 8 || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || uraian.length < 10 || alamat.length < 3) {
    throw new Error('Data laporan belum lengkap. Periksa nama, no. HP (min. 8 digit), tanggal lahir, uraian (min. 10 karakter), dan lokasi.');
  }

  var idWarga = payload.idWarga || (wargaRow ? wargaRow.ID_WARGA : '');
  var idUserPelapor = payload.idUserPelapor || (sessionUser ? sessionUser.ID_USER : '');
  var nikMasked = payload.nikMasked || (wargaRow ? wargaRow.NIK_MASKED : '');

  var isGeneral = payload.isGeneralInquiry === true || payload.idLayanan === 'GENERAL_INQUIRY';
  var matchedSvc = null;
  if (!isGeneral && payload.idLayanan) {
    try {
      var svcRows = sheetToObjects_('KATEGORI_LAYANAN');
      for (var sIdx = 0; sIdx < svcRows.length; sIdx++) {
        if (svcRows[sIdx].ID_LAYANAN === payload.idLayanan) {
          matchedSvc = svcRows[sIdx];
          break;
        }
      }
    } catch (ignore) {}
  }

  var petugasId = matchedSvc ? (matchedSvc.ID_PETUGAS_PJ || '') : '';
  var petugasNama = matchedSvc ? (matchedSvc.NAMA_PETUGAS_PJ || '') : '';
  try {
    var ptgRows = sheetToObjects_('PETUGAS');
    if (petugasId) {
      for (var pIdx = 0; pIdx < ptgRows.length; pIdx++) {
        if (ptgRows[pIdx].ID_PETUGAS === petugasId) {
          petugasNama = ptgRows[pIdx].NAMA_PETUGAS || petugasNama;
          break;
        }
      }
    }
    if (!petugasNama) {
      var userRows = sheetToObjects_('USERS');
      for (var uIdx = 0; uIdx < userRows.length; uIdx++) {
        if (userRows[uIdx].ROLE === 'OPERATOR') {
          petugasNama = userRows[uIdx].NAMA_LENGKAP;
          break;
        }
      }
    }
  } catch (ignore) {}
  if (!petugasNama) petugasNama = 'Operator Desa Ampel';

  var ticketId = generateTicketNumber();
  var now = new Date().toISOString();
  var hasAttachment = Boolean(payload.attachment && payload.attachment.base64);
  var folder = null;
  var driveFolderUrl = '01_LAPORAN_WARGA/' + ticketId;

  try {
    folder = getOrCreateTicketFolder_(ticketId);
    if (folder) driveFolderUrl = folder.getUrl();
  } catch (driveErr) {
    if (hasAttachment) {
      throw new Error('Gagal menyiapkan folder Google Drive untuk lampiran: ' + (driveErr.message || String(driveErr)));
    }
  }

  var resolvedKodeGrup = isGeneral ? 'GENERAL_INQUIRY' : (matchedSvc ? matchedSvc.KATEGORI_GRUP : (payload.kodeGrup || 'A. Pengaduan'));
  var resolvedIdLayanan = isGeneral ? 'GENERAL_INQUIRY' : (matchedSvc ? matchedSvc.ID_LAYANAN : (payload.idLayanan || 'GENERAL_INQUIRY'));
  var resolvedNamaLayanan = isGeneral ? 'Saya Tidak Tahu (Perlu Klasifikasi)' : (matchedSvc ? matchedSvc.NAMA_LAYANAN : (payload.namaLayanan || 'Pengaduan Warga'));
  var resolvedRtRw = String(payload.rtRw || (wargaRow ? wargaRow.RT_RW : '') || CONFIG.NAMA_DESA).trim();
  var judul = String(payload.judulLaporan || '').trim() ||
    (isGeneral ? 'Laporan Umum Warga (' + resolvedRtRw + ')' : (payload.masalahUtama || resolvedNamaLayanan) + ' — ' + resolvedRtRw);

  var shLap = getSheet_('LAPORAN');
  shLap.appendRow([
    ticketId,
    idWarga,
    idUserPelapor,
    nama,
    formatPhoneForSheet_(noHp),
    dob,
    nikMasked,
    resolvedKodeGrup,
    resolvedIdLayanan,
    resolvedNamaLayanan,
    judul,
    isGeneral ? 'Belum diklasifikasi' : (payload.masalahUtama || resolvedNamaLayanan),
    uraian,
    alamat,
    resolvedRtRw,
    JSON.stringify(payload.dataFormDinamis || {}),
    'Laporan diterima',
    petugasId,
    petugasNama,
    ticketId,
    driveFolderUrl,
    now,
    now
  ]);

  var updId = 'UPD-' + Date.now();
  getSheet_('TINDAK_LANJUT').appendRow([
    updId, ticketId, now.slice(0, 10), 'Laporan diterima',
    isGeneral ? 'Laporan umum diterima. Menunggu klasifikasi operator desa.' : 'Laporan telah diterima dan dicatat.',
    '', '', 'Sistem WARGA AMPEL', now
  ]);

  if (hasAttachment && folder) {
    saveBlobToDriveAndSheet_(
      folder, ticketId, updId,
      payload.attachment.fileName, payload.attachment.mimeType, payload.attachment.base64,
      'Foto sebelum perbaikan', nama, 'PUBLIK_WARGA'
    );
  }

  try {
    saveNotification('ALL_STAFF', 'OPERATOR', ticketId, 'Laporan Baru ' + ticketId, judul);
  } catch (ignore) {}
  try {
    logActivity_(sessionUser, 'SUBMIT_REPORT', ticketId, 'Laporan warga baru dibuat.');
  } catch (ignore) {}

  return {
    ticketId: ticketId,
    driveFolderUrl: driveFolderUrl,
    status: 'Laporan diterima',
    createdAt: now,
    report: {
      idLaporan: ticketId,
      judulLaporan: judul,
      namaLayanan: resolvedNamaLayanan,
      statusTerbaru: 'Laporan diterima',
      driveFolder: driveFolderUrl,
      createdAt: now,
      hasAttachment: hasAttachment
    }
  };
}

// --- 4. PELACAKAN WARGA (PRIVASI KETAT) ---
function getReportStatus(ticketId, tanggalLahir, last4Hp) {
  if (!ticketId) throw new Error('Nomor tiket wajib diisi.');
  var reports = sheetToObjects_('LAPORAN');
  var found = null;
  for (var i = 0; i < reports.length; i++) {
    if (String(reports[i].ID_LAPORAN).toUpperCase() === String(ticketId).trim().toUpperCase()) {
      found = reports[i];
      break;
    }
  }
  if (!found) throw new Error('Nomor tiket tidak ditemukan.');

  var hpDigits = String(found.NO_HP_PELAPOR || '').replace(/\D/g, '').slice(-4);
  var inputLast4 = String(last4Hp || '').replace(/\D/g, '').slice(-4);
  var dobVal = found.TANGGAL_LAHIR_VERIFIKASI instanceof Date
    ? found.TANGGAL_LAHIR_VERIFIKASI.toISOString().slice(0, 10)
    : String(found.TANGGAL_LAHIR_VERIFIKASI || '').slice(0, 10);
  var dobMatch = tanggalLahir && dobVal === String(tanggalLahir).trim();
  var hpMatch = inputLast4.length === 4 && hpDigits === inputLast4;
  if (!dobMatch && !hpMatch) {
    throw new Error('Verifikasi identitas gagal. Pastikan tanggal lahir atau 4 digit terakhir no. HP sesuai.');
  }

  var followUpsRaw = sheetToObjects_('TINDAK_LANJUT').filter(function(f) {
    return f.ID_LAPORAN === found.ID_LAPORAN;
  });
  var followUps = followUpsRaw.map(function(f) {
    return {
      idUpdate: f.ID_UPDATE,
      tanggalUpdate: f.TANGGAL_UPDATE instanceof Date ? f.TANGGAL_UPDATE.toISOString().slice(0, 10) : String(f.TANGGAL_UPDATE),
      status: f.STATUS,
      keterangan: f.KETERANGAN,
      dinasTujuan: f.DINAS_TUJUAN || undefined,
      nomorSurat: f.NOMOR_SURAT || undefined,
      petugas: f.PETUGAS
    };
  });

  var buktiPublikRaw = sheetToObjects_('BUKTI_DOKUMEN').filter(function(b) {
    return b.ID_LAPORAN === found.ID_LAPORAN && b.VISIBILITAS === 'PUBLIK_WARGA';
  });
  var buktiPublik = buktiPublikRaw.map(function(b) {
    var lower = String(b.NAMA_FILE || '').toLowerCase();
    var mime = lower.indexOf('.pdf') > -1 ? 'application/pdf' : (lower.indexOf('.png') > -1 ? 'image/png' : 'image/jpeg');
    return {
      idBukti: b.ID_BUKTI,
      namaFile: b.NAMA_FILE,
      jenisBukti: b.JENIS_BUKTI,
      mimeType: mime,
      tanggalUpload: String(b.TANGGAL_UPLOAD),
      previewUrl: b.DRIVE_URL
    };
  });

  var showDinas = found.STATUS_TERBARU === 'Sudah diusulkan ke dinas terkait' ||
    found.STATUS_TERBARU === 'Menunggu tindak lanjut dinas';

  var rejection = null;
  if (found.STATUS_TERBARU === 'Tidak dapat ditindaklanjuti' && followUps.length > 0) {
    rejection = followUps[followUps.length - 1].keterangan;
  }

  return {
    tracking: {
      idLaporan: found.ID_LAPORAN,
      judulLaporan: found.JUDUL_LAPORAN,
      namaLayanan: found.NAMA_LAYANAN,
      statusTerbaru: found.STATUS_TERBARU,
      pesanKhususDinas: showDinas ? DINAS_PROPOSAL_MESSAGE : undefined,
      alasanPenolakan: rejection || undefined,
      tanggalLaporan: String(found.CREATED_AT),
      lokasiRingkas: (found.RT_RW || 'Desa') + ', ' + CONFIG.NAMA_DESA,
      riwayatTindakLanjut: followUps,
      buktiPublik: buktiPublik
    }
  };
}

function buildCitizenTrackingItem_(found, allFollowUps, allDocs) {
  var followUps = allFollowUps
    .filter(function(u) { return u.ID_LAPORAN === found.ID_LAPORAN; })
    .map(function(u) {
      return {
        idUpdate: u.ID_UPDATE,
        tanggalUpdate: String(u.TANGGAL_UPDATE),
        status: u.STATUS,
        keterangan: u.KETERANGAN,
        dinasTujuan: u.DINAS_TUJUAN || '',
        nomorSurat: u.NOMOR_SURAT || '',
        petugas: u.PETUGAS || ''
      };
    });
  var buktiPublik = allDocs
    .filter(function(b) { return b.ID_LAPORAN === found.ID_LAPORAN && b.VISIBILITAS === 'PUBLIK_WARGA'; })
    .map(function(b) {
      return {
        idBukti: b.ID_BUKTI,
        idUpdate: b.ID_UPDATE,
        namaFile: b.NAMA_FILE,
        mimeType: b.MIME_TYPE || 'image/jpeg',
        jenisBukti: b.JENIS_BUKTI,
        tanggalUpload: String(b.TANGGAL_UPLOAD),
        previewUrl: b.DRIVE_URL
      };
    });
  var showDinas =
    found.STATUS_TERBARU === 'Sudah diusulkan ke dinas terkait' ||
    found.STATUS_TERBARU === 'Menunggu tindak lanjut dinas';
  return {
    idLaporan: found.ID_LAPORAN,
    judulLaporan: found.JUDUL_LAPORAN,
    namaLayanan: found.NAMA_LAYANAN,
    kodeGrup: found.KODE_GRUP,
    statusTerbaru: found.STATUS_TERBARU,
    pesanKhususDinas: showDinas ? DINAS_PROPOSAL_MESSAGE : null,
    alasanPenolakan: found.STATUS_TERBARU === 'Tidak dapat ditindaklanjuti' ? (found.ALASAN_TIDAK_DITINDAKLANJUTI || null) : null,
    tanggalLaporan: String(found.CREATED_AT),
    lokasiRingkas: (found.RT_RW || 'Desa') + ', ' + CONFIG.NAMA_DESA,
    petugasPenanggungJawab: found.NAMA_PETUGAS_TUGAS || 'Petugas Desa Ampel',
    riwayatTindakLanjut: followUps,
    buktiPublik: buktiPublik
  };
}

function getCitizenDashboard(token) {
  var actor = verifyTokenAndRole_(token, null);
  var allFollowUps = sheetToObjects_('TINDAK_LANJUT');
  var allDocs = sheetToObjects_('BUKTI_DOKUMEN');
  var myReports = sheetToObjects_('LAPORAN')
    .filter(function(r) { return r.ID_USER_PELAPOR === actor.ID_USER; })
    .map(function(r) { return buildCitizenTrackingItem_(r, allFollowUps, allDocs); });
  var notifications = sheetToObjects_('NOTIFIKASI').filter(function(n) {
    return n.TARGET_USER_ID === actor.ID_USER || n.TARGET_ROLE === 'ALL';
  });
  var announcements = getPublicAnnouncements().announcements || [];
  return {
    myReports: myReports,
    notifications: notifications,
    announcements: announcements
  };
}

function getCitizenReports(token) {
  var dash = getCitizenDashboard(token);
  return {
    reports: dash.myReports,
    myReports: dash.myReports,
    notifications: dash.notifications,
    announcements: dash.announcements
  };
}

function markNotificationRead(idNotifikasi, token) {
  var actor = verifyTokenAndRole_(token, null);
  var list = sheetToObjects_('NOTIFIKASI');
  var sh = getSheet_('NOTIFIKASI');
  for (var i = 0; i < list.length; i++) {
    if (list[i].ID_NOTIFIKASI === idNotifikasi && list[i].TARGET_USER_ID === actor.ID_USER) {
      sh.getRange(list[i]._rowIndex, 7).setValue(true);
      break;
    }
  }
  return { ok: true };
}

// --- 5. ADMIN & PETUGAS: DASHBOARD, DAFTAR, TINDAK LANJUT, BUKTI ---
function getAdminDashboard(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var reports = sheetToObjects_('LAPORAN');
  var warga = sheetToObjects_('WARGA');
  var petugas = sheetToObjects_('PETUGAS');

  var statusLabels = [
    'Laporan diterima',
    'Sedang ditindaklanjuti',
    'Sedang dalam proses perbaikan',
    'Sudah diusulkan ke dinas terkait',
    'Menunggu tindak lanjut dinas',
    'Sudah diperbaiki atau ditangani',
    'Tidak dapat ditindaklanjuti'
  ];
  var statusDistribution = statusLabels.map(function(label) {
    return {
      label: label,
      count: reports.filter(function(r) { return r.STATUS_TERBARU === label; }).length
    };
  });

  var groupCounts = {};
  reports.forEach(function(r) {
    var g = String(r.KODE_GRUP || 'Lainnya');
    groupCounts[g] = (groupCounts[g] || 0) + 1;
  });
  var categoryDistribution = Object.keys(groupCounts).map(function(k) {
    return { label: k, count: groupCounts[k] };
  });

  var monthCounts = {};
  reports.forEach(function(r) {
    var m = String(r.CREATED_AT || '').slice(0, 7) || new Date().toISOString().slice(0, 7);
    monthCounts[m] = (monthCounts[m] || 0) + 1;
  });
  var monthlyIncoming = Object.keys(monthCounts).sort().map(function(m) {
    return { label: m, month: m, count: monthCounts[m] };
  });

  var officerCounts = {};
  reports.forEach(function(r) {
    var name = String(r.NAMA_PETUGAS_TUGAS || 'Belum Ditugaskan');
    if (!officerCounts[name]) officerCounts[name] = { total: 0, selesai: 0 };
    officerCounts[name].total += 1;
    if (r.STATUS_TERBARU === 'Sudah diperbaiki atau ditangani') {
      officerCounts[name].selesai += 1;
    }
  });
  var officerPerformance = Object.keys(officerCounts).map(function(n) {
    return { name: n, total: officerCounts[n].total, selesai: officerCounts[n].selesai };
  });

  var selesaiTotal = reports.filter(function(r) {
    return r.STATUS_TERBARU === 'Sudah diperbaiki atau ditangani';
  }).length;
  var ditolakTotal = reports.filter(function(r) {
    return r.STATUS_TERBARU === 'Tidak dapat ditindaklanjuti';
  }).length;

  return {
    stats: {
      totalLaporan: reports.length,
      laporanBaru: reports.filter(function(r) { return r.STATUS_TERBARU === 'Laporan diterima'; }).length,
      menungguPenanganan: reports.filter(function(r) { return r.STATUS_TERBARU === 'Laporan diterima' || r.STATUS_TERBARU === 'Sedang ditindaklanjuti'; }).length,
      sedangDiproses: reports.filter(function(r) { return r.STATUS_TERBARU === 'Sedang dalam proses perbaikan'; }).length,
      diusulkanKeDinas: reports.filter(function(r) { return r.STATUS_TERBARU === 'Sudah diusulkan ke dinas terkait' || r.STATUS_TERBARU === 'Menunggu tindak lanjut dinas'; }).length,
      selesai: selesaiTotal,
      tidakDapatDitindaklanjuti: ditolakTotal,
      totalWarga: warga.length,
      totalPetugas: petugas.length,
      monthlyIncoming: monthlyIncoming,
      topCategories: categoryDistribution,
      statusDistribution: statusDistribution,
      completedVsUnfinished: {
        selesai: selesaiTotal,
        belumSelesai: Math.max(0, reports.length - selesaiTotal - ditolakTotal)
      },
      categoryDistribution: categoryDistribution,
      monthlyTrend: monthlyIncoming,
      officerPerformance: officerPerformance
    }
  };
}

function getAllReports(filters, token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var reports = sheetToObjects_('LAPORAN');
  if (filters) {
    if (filters.group) {
      reports = reports.filter(function(r) {
        return String(r.KODE_GRUP) === String(filters.group);
      });
    }
    if (filters.status) {
      reports = reports.filter(function(r) {
        return r.STATUS_TERBARU === filters.status;
      });
    }
    if (filters.search) {
      var q = String(filters.search).toLowerCase();
      reports = reports.filter(function(r) {
        return String(r.ID_LAPORAN).toLowerCase().indexOf(q) > -1 ||
          String(r.JUDUL_LAPORAN).toLowerCase().indexOf(q) > -1 ||
          String(r.NAMA_PELAPOR).toLowerCase().indexOf(q) > -1;
      });
    }
  }
  reports.sort(function(a, b) {
    return String(b.CREATED_AT).localeCompare(String(a.CREATED_AT));
  });
  return { reports: reports };
}

function getReportDetail(idLaporan, token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var reports = sheetToObjects_('LAPORAN');
  var found = null;
  for (var i = 0; i < reports.length; i++) {
    if (reports[i].ID_LAPORAN === idLaporan) {
      found = reports[i];
      break;
    }
  }
  if (!found) throw new Error('Laporan tidak ditemukan.');
  var followUps = sheetToObjects_('TINDAK_LANJUT').filter(function(f) { return f.ID_LAPORAN === idLaporan; });
  var evidence = sheetToObjects_('BUKTI_DOKUMEN').filter(function(b) { return b.ID_LAPORAN === idLaporan; });
  return { report: found, followUps: followUps, evidence: evidence };
}

function saveFollowUp(payload, token) {
  var actor = verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  if (!payload.idLaporan || !payload.status || !payload.keterangan || String(payload.keterangan).trim().length < 5) {
    throw new Error('ID Laporan, status, dan keterangan minimal 5 karakter wajib diisi.');
  }
  if (payload.status === 'Tidak dapat ditindaklanjuti' && String(payload.keterangan).trim().length < 15) {
    throw new Error('Alasan tertulis wajib diisi (minimal 15 karakter) saat memilih Tidak dapat ditindaklanjuti.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var shLap = getSheet_('LAPORAN');
    var lapRows = sheetToObjects_('LAPORAN');
    var target = null;
    for (var i = 0; i < lapRows.length; i++) {
      if (lapRows[i].ID_LAPORAN === payload.idLaporan) {
        target = lapRows[i];
        break;
      }
    }
    if (!target) throw new Error('Laporan tidak ditemukan.');

    var now = new Date().toISOString();
    var updId = 'UPD-' + Date.now();
    getSheet_('TINDAK_LANJUT').appendRow([
      updId,
      target.ID_LAPORAN,
      payload.tanggalTindakan || now.slice(0, 10),
      payload.status,
      String(payload.keterangan).trim(),
      payload.dinasTujuan || '',
      payload.nomorSurat || '',
      actor.NAMA_LENGKAP,
      now
    ]);

    var headers = shLap.getRange(1, 1, 1, shLap.getLastColumn()).getValues()[0];
    var statusCol = headers.indexOf('STATUS_TERBARU') + 1;
    var updatedCol = headers.indexOf('UPDATED_AT') + 1;
    shLap.getRange(target._rowIndex, statusCol).setValue(payload.status);
    shLap.getRange(target._rowIndex, updatedCol).setValue(now);

    if (payload.idPetugasTugas) {
      var pjCol = headers.indexOf('ID_PETUGAS_TUGAS') + 1;
      var pjNameCol = headers.indexOf('NAMA_PETUGAS_TUGAS') + 1;
      shLap.getRange(target._rowIndex, pjCol).setValue(payload.idPetugasTugas);
      shLap.getRange(target._rowIndex, pjNameCol).setValue(payload.namaPetugasTugas || actor.NAMA_LENGKAP);
    }

    logActivity_(actor, 'SAVE_FOLLOWUP', target.ID_LAPORAN, 'Status diubah ke ' + payload.status);
    var detail = getReportDetail(target.ID_LAPORAN, token);
    return { ok: true, idUpdate: updId, report: detail.report, followUps: detail.followUps };
  } finally {
    lock.releaseLock();
  }
}

function classifyReport(payload, token) {
  var actor = verifyTokenAndRole_(token, ['OPERATOR', 'SUPER_ADMIN', 'KEPALA_DESA']);
  var idLaporan = payload.idLaporan;
  var idLayanan = payload.idLayanan;
  if (!idLaporan || !idLayanan) throw new Error('Laporan dan layanan tujuan wajib dipilih.');

  var services = sheetToObjects_('KATEGORI_LAYANAN');
  var svc = null;
  for (var s = 0; s < services.length; s++) {
    if (services[s].ID_LAYANAN === idLayanan) {
      svc = services[s];
      break;
    }
  }
  if (!svc) throw new Error('Layanan tujuan tidak ditemukan.');

  var shLap = getSheet_('LAPORAN');
  var lapRows = sheetToObjects_('LAPORAN');
  var target = null;
  for (var i = 0; i < lapRows.length; i++) {
    if (lapRows[i].ID_LAPORAN === idLaporan) {
      target = lapRows[i];
      break;
    }
  }
  if (!target) throw new Error('Laporan tidak ditemukan.');

  var petugasRows = sheetToObjects_('PETUGAS');
  var petugasMap = {};
  petugasRows.forEach(function(p) {
    if (p.ID_PETUGAS) petugasMap[String(p.ID_PETUGAS)] = String(p.NAMA_PETUGAS || '');
  });
  var assignedPetugasId = svc.ID_PETUGAS_PJ || 'PTG-001';
  var assignedPetugasName = petugasMap[String(assignedPetugasId)] || svc.NAMA_PETUGAS_PJ || 'Petugas Desa';

  var headers = shLap.getRange(1, 1, 1, shLap.getLastColumn()).getValues()[0];
  var now = new Date().toISOString();
  shLap.getRange(target._rowIndex, headers.indexOf('KODE_GRUP') + 1).setValue(svc.KATEGORI_GRUP);
  shLap.getRange(target._rowIndex, headers.indexOf('ID_LAYANAN') + 1).setValue(svc.ID_LAYANAN);
  shLap.getRange(target._rowIndex, headers.indexOf('NAMA_LAYANAN') + 1).setValue(svc.NAMA_LAYANAN);
  shLap.getRange(target._rowIndex, headers.indexOf('STATUS_TERBARU') + 1).setValue('Sedang ditindaklanjuti');
  shLap.getRange(target._rowIndex, headers.indexOf('ID_PETUGAS_TUGAS') + 1).setValue(assignedPetugasId);
  shLap.getRange(target._rowIndex, headers.indexOf('NAMA_PETUGAS_TUGAS') + 1).setValue(assignedPetugasName);
  shLap.getRange(target._rowIndex, headers.indexOf('UPDATED_AT') + 1).setValue(now);

  getSheet_('TINDAK_LANJUT').appendRow([
    'UPD-' + Date.now(), idLaporan, now.slice(0, 10), 'Sedang ditindaklanjuti',
    'Laporan diklasifikasikan ke layanan "' + svc.NAMA_LAYANAN + '" (' + svc.KATEGORI_GRUP + '). ' + (payload.catatan || ''),
    '', '', actor.NAMA_LENGKAP, now
  ]);

  logActivity_(actor, 'CLASSIFY_REPORT', idLaporan, 'Diklasifikasi ke ' + svc.NAMA_LAYANAN);
  return getReportDetail(idLaporan, token);
}

function uploadEvidence(payload, token) {
  var actor = verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var folder = getOrCreateTicketFolder_(payload.idLaporan);
  var bukti = saveBlobToDriveAndSheet_(
    folder,
    payload.idLaporan,
    payload.idUpdate || ('UPD-' + Date.now()),
    payload.fileName,
    payload.mimeType,
    payload.base64,
    payload.jenisBukti || 'Dokumen pendukung lainnya',
    actor.NAMA_LENGKAP,
    payload.visibilitas === 'INTERNAL_DESA' ? 'INTERNAL_DESA' : 'PUBLIK_WARGA'
  );
  logActivity_(actor, 'UPLOAD_EVIDENCE', payload.idLaporan, 'Unggah ' + bukti.NAMA_FILE);
  return { bukti: bukti };
}

function getOrCreateTicketFolder_(ticketId) {
  var root = getRootDriveFolder_();
  var lapFolderIt = root.getFoldersByName('01_LAPORAN_WARGA');
  var lapFolder = lapFolderIt.hasNext() ? lapFolderIt.next() : root.createFolder('01_LAPORAN_WARGA');
  trySetSharing_(lapFolder, DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  var ticketIt = lapFolder.getFoldersByName(ticketId);
  var ticketFolder = ticketIt.hasNext() ? ticketIt.next() : lapFolder.createFolder(ticketId);
  trySetSharing_(ticketFolder, DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  return ticketFolder;
}

function saveBlobToDriveAndSheet_(folder, idLaporan, idUpdate, fileName, mimeType, base64, jenisBukti, uploader, visibilitas) {
  if (CONFIG.ALLOWED_MIMES.indexOf(String(mimeType).toLowerCase()) === -1) {
    throw new Error('Format file harus JPG, PNG, atau PDF.');
  }
  var cleanBase64 = String(base64).indexOf(',') >= 0 ? String(base64).split(',')[1] : String(base64);
  var bytes = Utilities.base64Decode(cleanBase64);
  if (bytes.length > CONFIG.MAX_FILE_SIZE_BYTES) {
    throw new Error('Ukuran file melebihi batas 5 MB.');
  }
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = folder.createFile(blob);
  trySetSharing_(file, DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);

  var idBukti = 'BKT-' + Date.now();
  var now = new Date().toISOString();
  getSheet_('BUKTI_DOKUMEN').appendRow([
    idBukti, idLaporan, idUpdate, file.getName(), jenisBukti,
    file.getId(), file.getUrl(), now, uploader, visibilitas
  ]);
  return {
    ID_BUKTI: idBukti,
    ID_LAPORAN: idLaporan,
    ID_UPDATE: idUpdate,
    NAMA_FILE: file.getName(),
    JENIS_BUKTI: jenisBukti,
    MIME_TYPE: mimeType,
    UKURAN_BYTES: bytes.length,
    DRIVE_FOLDER_SUB: '01_LAPORAN_WARGA/' + idLaporan,
    DRIVE_URL: file.getUrl(),
    TANGGAL_UPLOAD: now,
    DIUNGGAH_OLEH: uploader,
    VISIBILITAS: visibilitas
  };
}

function getDriveEvidence(idBukti, ticketId, token) {
  var docs = sheetToObjects_('BUKTI_DOKUMEN');
  var found = null;
  for (var i = 0; i < docs.length; i++) {
    if (docs[i].ID_BUKTI === idBukti) {
      found = docs[i];
      break;
    }
  }
  if (!found) throw new Error('Bukti tidak ditemukan.');
  if (found.VISIBILITAS !== 'PUBLIK_WARGA') {
    verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  } else if (found.ID_LAPORAN !== ticketId && !token) {
    throw new Error('Akses bukti memerlukan verifikasi tiket.');
  }
  var file = DriveApp.getFileById(found.DRIVE_FILE_ID);
  return {
    namaFile: found.NAMA_FILE,
    mimeType: file.getMimeType(),
    base64: Utilities.base64Encode(file.getBlob().getBytes()),
    driveUrl: found.DRIVE_URL
  };
}

// --- 6. SERVICE BUILDER (DYNAMIC SERVICES) ---
function mapServicesWithFields_(services, forms) {
  var officerMap = {};
  try {
    var ptg = sheetToObjects_('PETUGAS');
    ptg.forEach(function(p) {
      if (p.ID_PETUGAS && p.NAMA_PETUGAS) {
        officerMap[p.ID_PETUGAS] = p.NAMA_PETUGAS;
      }
    });
  } catch (ignore) {}
  return services.map(function(s) {
    var svcFields = forms
      .filter(function(f) { return f.ID_LAYANAN === s.ID_LAYANAN; })
      .map(function(f) {
        return {
          ID_FIELD: f.ID_FIELD,
          ID_LAYANAN: f.ID_LAYANAN,
          LABEL_PERTANYAAN: f.LABEL_PERTANYAAN,
          TIPE_ISIAN: f.TIPE_ISIAN,
          OPSI_PILIHAN: parseJsonSafe_(f.OPSI_PILIHAN, []),
          WAJIB: f.WAJIB === true || String(f.WAJIB).toUpperCase() === 'TRUE',
          PLACEHOLDER: f.PLACEHOLDER || '',
          URUTAN: Number(f.URUTAN) || 1
        };
      });
    var pjId = s.ID_PETUGAS_PJ || 'PTG-001';
    return {
      ID_LAYANAN: s.ID_LAYANAN,
      KODE_LAYANAN: s.KODE_LAYANAN,
      NAMA_LAYANAN: s.NAMA_LAYANAN,
      KATEGORI_GRUP: s.KATEGORI_GRUP,
      DESKRIPSI: s.DESKRIPSI,
      IKON: s.IKON || 'file-text',
      PERSYARATAN_DOKUMEN: s.PERSYARATAN_DOKUMEN || '',
      ID_PETUGAS_PJ: pjId,
      NAMA_PETUGAS_PJ: officerMap[pjId] || s.NAMA_PETUGAS_PJ || 'Petugas Desa',
      ALUR_STATUS: parseJsonSafe_(s.ALUR_STATUS, []),
      STATUS_AKTIF: s.STATUS_AKTIF === true || String(s.STATUS_AKTIF).toUpperCase() === 'TRUE',
      URUTAN: Number(s.URUTAN) || 1,
      CREATED_AT: String(s.CREATED_AT || ''),
      fields: svcFields
    };
  });
}

function getActiveServices() {
  var services = sheetToObjects_('KATEGORI_LAYANAN').filter(function(s) {
    return s.STATUS_AKTIF === true || String(s.STATUS_AKTIF).toUpperCase() === 'TRUE';
  });
  var forms = sheetToObjects_('KONFIGURASI_FORM');
  return mapServicesWithFields_(services, forms);
}

function getAdminServices(token) {
  verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  return {
    services: mapServicesWithFields_(sheetToObjects_('KATEGORI_LAYANAN'), sheetToObjects_('KONFIGURASI_FORM'))
  };
}

function createService(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var idLayanan = 'LAY-' + Date.now();
  var now = new Date().toISOString();
  getSheet_('KATEGORI_LAYANAN').appendRow([
    idLayanan, 'SRV-' + Math.floor(100 + Math.random() * 900),
    payload.namaLayanan, payload.kategoriGrup, payload.deskripsi || '',
    payload.ikon || 'file-text', payload.persyaratanDokumen || 'Opsional',
    payload.idPetugasPj || 'PTG-001', payload.namaPetugasPj || 'Petugas Desa',
    JSON.stringify(payload.alurStatus || []), true, 99, now
  ]);
  if (Array.isArray(payload.fields)) {
    var shForm = getSheet_('KONFIGURASI_FORM');
    payload.fields.forEach(function(f, idx) {
      shForm.appendRow([
        'FLD-' + Date.now() + '-' + idx, idLayanan,
        f.LABEL_PERTANYAAN, f.TIPE_ISIAN, JSON.stringify(f.OPSI_PILIHAN || []),
        Boolean(f.WAJIB), f.PLACEHOLDER || '', idx + 1
      ]);
    });
  }
  logActivity_(actor, 'CREATE_SERVICE', idLayanan, 'Menambahkan layanan ' + payload.namaLayanan);
  return { ok: true, idLayanan: idLayanan };
}

function updateService(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var rows = sheetToObjects_('KATEGORI_LAYANAN');
  var sh = getSheet_('KATEGORI_LAYANAN');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID_LAYANAN === payload.idLayanan) {
      if (payload.namaLayanan !== undefined) sh.getRange(rows[i]._rowIndex, 3).setValue(payload.namaLayanan);
      if (payload.kategoriGrup !== undefined) sh.getRange(rows[i]._rowIndex, 4).setValue(payload.kategoriGrup);
      if (payload.deskripsi !== undefined) sh.getRange(rows[i]._rowIndex, 5).setValue(payload.deskripsi);
      if (payload.statusAktif !== undefined) sh.getRange(rows[i]._rowIndex, 11).setValue(Boolean(payload.statusAktif));
      logActivity_(actor, 'UPDATE_SERVICE', payload.idLayanan, 'Memperbarui layanan ' + payload.idLayanan);
      return { ok: true };
    }
  }
  throw new Error('Layanan tidak ditemukan.');
}

function deleteService(idLayanan, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN']);
  var rows = sheetToObjects_('KATEGORI_LAYANAN');
  var sh = getSheet_('KATEGORI_LAYANAN');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID_LAYANAN === idLayanan) {
      sh.deleteRow(rows[i]._rowIndex);
      logActivity_(actor, 'DELETE_SERVICE', idLayanan, 'Menghapus layanan ' + idLayanan);
      return { ok: true };
    }
  }
  throw new Error('Layanan tidak ditemukan.');
}

// --- 7. WARGA, PETUGAS, DRIVE EXPLORER, PENGUMUMAN, PENGATURAN, LOG ---
function getWarga(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  return { warga: sheetToObjects_('WARGA') };
}

function verifyWarga(payload, token) {
  var actor = verifyTokenAndRole_(token, ['OPERATOR', 'SUPER_ADMIN', 'KEPALA_DESA']);
  var rows = sheetToObjects_('WARGA');
  var sh = getSheet_('WARGA');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID_WARGA === payload.idWarga) {
      sh.getRange(rows[i]._rowIndex, 11).setValue(payload.statusVerifikasi);
      logActivity_(actor, 'VERIFIKASI_WARGA', payload.idWarga, 'Status: ' + payload.statusVerifikasi);
      return { ok: true };
    }
  }
  throw new Error('Data warga tidak ditemukan.');
}

function getPetugas(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  return { petugas: sheetToObjects_('PETUGAS') };
}

function createPetugas(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN']);
  var idPetugas = 'PTG-' + Date.now();
  var now = new Date().toISOString();
  getSheet_('PETUGAS').appendRow([
    idPetugas, '', payload.namaPetugas, payload.jabatan || 'Petugas Desa',
    payload.bidangTugas || 'Pelayanan Umum', formatPhoneForSheet_(payload.noHp), 'AKTIF', now
  ]);
  logActivity_(actor, 'CREATE_PETUGAS', idPetugas, 'Menambah petugas ' + payload.namaPetugas);
  return { ok: true, idPetugas: idPetugas };
}

function getDriveTree(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var docs = sheetToObjects_('BUKTI_DOKUMEN').map(function(b) {
    return {
      ID_BUKTI: b.ID_BUKTI,
      ID_LAPORAN: b.ID_LAPORAN,
      ID_UPDATE: b.ID_UPDATE,
      NAMA_FILE: b.NAMA_FILE,
      JENIS_BUKTI: b.JENIS_BUKTI,
      DRIVE_FOLDER_SUB: '01_LAPORAN_WARGA/' + b.ID_LAPORAN,
      DRIVE_URL: b.DRIVE_URL,
      TANGGAL_UPLOAD: String(b.TANGGAL_UPLOAD),
      DIUNGGAH_OLEH: b.DIUNGGAH_OLEH,
      VISIBILITAS: b.VISIBILITAS
    };
  });
  var ticketSet = {};
  docs.forEach(function(d) {
    if (d.ID_LAPORAN) ticketSet[d.ID_LAPORAN] = true;
  });
  return {
    rootFolder: 'SIWARGA_DESA',
    subfolders: [
      '01_LAPORAN_WARGA',
      '02_SURAT_ADMINISTRASI',
      '03_BUKTI_PENANGANAN',
      '04_SURAT_KE_DINAS',
      '05_DOKUMEN_PENDUKUNG'
    ],
    ticketFolders: Object.keys(ticketSet),
    evidence: docs
  };
}

function getPublicAnnouncements() {
  var list = sheetToObjects_('PENGUMUMAN').filter(function(p) {
    return p.AKTIF === true || String(p.AKTIF).toUpperCase() === 'TRUE';
  });
  return { announcements: list };
}

function getAnnouncements(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  return { announcements: sheetToObjects_('PENGUMUMAN') };
}

function createAnnouncement(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var id = 'PGM-' + Date.now();
  var now = new Date().toISOString().slice(0, 10);
  getSheet_('PENGUMUMAN').appendRow([
    id, payload.judul, String(payload.isi || '').slice(0, 140),
    payload.isi, payload.kategori || 'Pelayanan', now, actor.NAMA_LENGKAP, true
  ]);
  logActivity_(actor, 'CREATE_ANNOUNCEMENT', id, payload.judul);
  return { ok: true, idPengumuman: id };
}

function deleteAnnouncement(idPengumuman, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var rows = sheetToObjects_('PENGUMUMAN');
  var sh = getSheet_('PENGUMUMAN');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID_PENGUMUMAN === idPengumuman) {
      sh.deleteRow(rows[i]._rowIndex);
      return { ok: true };
    }
  }
  return { ok: true };
}

function getSettings(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  return { settings: sheetToObjects_('PENGATURAN') };
}

function saveSettings(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN']);
  var updates = payload.settings || [];
  var sh = getSheet_('PENGATURAN');
  var existing = sheetToObjects_('PENGATURAN');
  updates.forEach(function(item) {
    if (!item || !item.KUNCI || item.KUNCI === 'TICKET_COUNTER') return;
    var matched = null;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].KUNCI === item.KUNCI) {
        matched = existing[i];
        break;
      }
    }
    if (matched) {
      sh.getRange(matched._rowIndex, 2).setValue(String(item.NILAI || ''));
    } else {
      sh.appendRow([item.KUNCI, String(item.NILAI || ''), '']);
    }
  });
  logActivity_(actor, 'UPDATE_SETTINGS', 'PENGATURAN', 'Memperbarui konfigurasi sistem WARGA AMPEL.');
  return { settings: sheetToObjects_('PENGATURAN') };
}

function getLogs(token) {
  verifyTokenAndRole_(token, ['SUPER_ADMIN', 'KEPALA_DESA', 'OPERATOR']);
  var logs = sheetToObjects_('LOG_AKTIVITAS');
  logs.reverse();
  return { logs: logs.slice(0, 200) };
}

function exportReportCsv(token) {
  var actor = verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var reports = sheetToObjects_('LAPORAN');
  var headers = ['ID_LAPORAN', 'TANGGAL', 'KODE_GRUP', 'NAMA_LAYANAN', 'JUDUL_LAPORAN', 'NAMA_PELAPOR', 'RT_RW', 'STATUS_TERBARU', 'PETUGAS'];
  var lines = [headers.join(',')];
  reports.forEach(function(r) {
    var row = [
      r.ID_LAPORAN, r.CREATED_AT, r.KODE_GRUP, r.NAMA_LAYANAN,
      r.JUDUL_LAPORAN, r.NAMA_PELAPOR, r.RT_RW, r.STATUS_TERBARU, r.NAMA_PETUGAS_TUGAS
    ].map(function(val) {
      return '"' + String(val || '').replace(/"/g, '""') + '"';
    });
    lines.push(row.join(','));
  });
  logActivity_(actor, 'EXPORT_CSV', 'LAPORAN', 'Ekspor ' + reports.length + ' baris laporan.');
  return { csv: lines.join('\n'), filename: 'LAPORAN_WARGA_AMPEL.csv', total: reports.length };
}

// --- 8. PORTAL STRUKTUR ORGANISASI WARGA AMPEL ---
function isTrueFlag_(val) {
  return val === true || String(val).toUpperCase() === 'TRUE';
}

function buildWaUrlGas_(phone, allowHp) {
  if (!allowHp || !phone) return null;
  var normalized = normalizePhoneRead_(phone);
  var digits = normalized.replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.indexOf('62') === 0) return 'https://wa.me/' + digits;
  if (digits.indexOf('0') === 0) return 'https://wa.me/62' + digits.slice(1);
  return 'https://wa.me/62' + digits;
}

function getOrgDisplaySettingsGas_() {
  var settings = sheetToObjects_('PENGATURAN');
  var map = {};
  settings.forEach(function(s) { map[s.KUNCI] = s.NILAI; });
  var defaultOrder = ['KELURAHAN', 'TP_PKK', 'LPMK_RW_RT', 'KADER', 'SEKOLAH_GURU', 'BALAI_RW'];
  var parsedOrder = parseJsonSafe_(map.ORG_URUTAN_BAGIAN, defaultOrder);
  if (!Array.isArray(parsedOrder) || !parsedOrder.length) parsedOrder = defaultOrder.slice();
  if (parsedOrder.indexOf('TP_PKK') === -1) {
    var kelIdx = parsedOrder.indexOf('KELURAHAN');
    if (kelIdx >= 0) {
      parsedOrder.splice(kelIdx + 1, 0, 'TP_PKK');
    } else {
      parsedOrder.unshift('TP_PKK');
    }
  }
  defaultOrder.forEach(function(k) {
    if (parsedOrder.indexOf(k) === -1) parsedOrder.push(k);
  });
  var parsedVis = parseJsonSafe_(map.ORG_TAMPILKAN_BAGIAN, {});
  return {
    pengumumanBeranda: map.ORG_PENGUMUMAN || 'Kenali jajaran pemerintahan, TP PKK Kelurahan Ampel, LPMK, pengurus RW/RT, kader pelayanan, sekolah, guru, serta alamat Balai RW di Warga Ampel.',
    urutanBagian: parsedOrder,
    tampilkanBagian: {
      kelurahan: parsedVis.kelurahan !== false,
      tpPkk: parsedVis.tpPkk !== false,
      lpmk: parsedVis.lpmk !== false,
      rwRt: parsedVis.rwRt !== false,
      kader: parsedVis.kader !== false,
      sekolahGuru: parsedVis.sekolahGuru !== false,
      balaiRw: parsedVis.balaiRw !== false
    }
  };
}

function getOrgSheetIfExists_(name) {
  try {
    return sheetToObjects_(name);
  } catch (e) {
    return [];
  }
}

function ensureOrgSheetExists_(name, headers) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0F2942')
      .setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function inferTpPkkPokjaGas_(jabatan, explicitPokja) {
  var exp = String(explicitPokja || '').trim();
  if (exp) return exp;
  var lower = String(jabatan || '').trim().toLowerCase();
  if (lower.indexOf('pembina') !== -1) return 'Pembina';
  if (/\bpokja\s*(iv|4)\b/i.test(lower)) return 'POKJA IV';
  if (/\bpokja\s*(iii|3)\b/i.test(lower)) return 'POKJA III';
  if (/\bpokja\s*(ii|2)\b/i.test(lower)) return 'POKJA II';
  if (/\bpokja\s*(i|1)\b/i.test(lower)) return 'POKJA I';
  return 'Pengurus Inti';
}

function getOrgIdColGas_(entity) {
  if (entity === 'kelurahan') return 'ID_KELURAHAN';
  if (entity === 'tp_pkk') return 'ID_PKK';
  if (entity === 'lpmk') return 'ID_LPMK';
  if (entity === 'rw') return 'ID_RW';
  if (entity === 'rt') return 'ID_RT';
  if (entity === 'kader') return 'ID_KADER';
  if (entity === 'sekolah') return 'ID_SEKOLAH';
  if (entity === 'guru') return 'ID_GURU';
  if (entity === 'balai_rw') return 'ID_BALAI';
  return 'ID';
}

function buildMapsUrlGas_(customUrl, fallbackQuery) {
  var trimmed = String(customUrl || '').trim();
  if (trimmed && /^https?:\/\//i.test(trimmed)) return trimmed;
  var q = String(fallbackQuery || '').trim();
  if (!q) return undefined;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

function getPublicOrgStructure() {
  var kelRaw = sheetToObjects_('ORG_KELURAHAN').filter(function(k) { return isTrueFlag_(k.AKTIF) && isTrueFlag_(k.TAMPILKAN_PUBLIK); });
  var tpPkkRaw = getOrgSheetIfExists_('ORG_TP_PKK').filter(function(p) { return isTrueFlag_(p.AKTIF) && isTrueFlag_(p.TAMPILKAN_PUBLIK); });
  var lpmkRaw = sheetToObjects_('ORG_LPMK').filter(function(l) { return isTrueFlag_(l.AKTIF) && isTrueFlag_(l.TAMPILKAN_PUBLIK); });
  var rwRaw = sheetToObjects_('ORG_RW').filter(function(r) { return isTrueFlag_(r.AKTIF) && isTrueFlag_(r.TAMPILKAN_PUBLIK); });
  var rtRaw = sheetToObjects_('ORG_RT').filter(function(t) { return isTrueFlag_(t.AKTIF) && isTrueFlag_(t.TAMPILKAN_PUBLIK); });
  var kaderRaw = sheetToObjects_('ORG_KADER').filter(function(k) { return isTrueFlag_(k.AKTIF) && isTrueFlag_(k.TAMPILKAN_PUBLIK); });
  var sekolahRaw = getOrgSheetIfExists_('ORG_SEKOLAH').filter(function(s) { return isTrueFlag_(s.AKTIF) && isTrueFlag_(s.TAMPILKAN_PUBLIK); });
  var guruRaw = getOrgSheetIfExists_('ORG_GURU').filter(function(g) { return isTrueFlag_(g.AKTIF) && isTrueFlag_(g.TAMPILKAN_PUBLIK); });
  var balaiRaw = getOrgSheetIfExists_('ORG_BALAI_RW').filter(function(b) { return isTrueFlag_(b.AKTIF) && isTrueFlag_(b.TAMPILKAN_PUBLIK); });

  var rwMap = {};
  rwRaw.forEach(function(r) { rwMap[r.ID_RW] = r; });
  var rtMap = {};
  rtRaw.forEach(function(t) { rtMap[t.ID_RT] = t; });
  var sekolahMap = {};
  sekolahRaw.forEach(function(s) { sekolahMap[s.ID_SEKOLAH] = s; });

  var sortUrutan = function(a, b) { return (Number(a.URUTAN) || 99) - (Number(b.URUTAN) || 99); };

  return {
    kelurahan: kelRaw.sort(sortUrutan).map(function(k) {
      var allowHp = isTrueFlag_(k.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(k.NO_HP);
      return {
        id: k.ID_KELURAHAN, kategori: 'KELURAHAN', nama: k.NAMA, jabatan: k.JABATAN,
        tingkat: k.TINGKAT, wilayahTugas: k.WILAYAH_TUGAS || '', fotoUrl: k.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(k.URUTAN) || 1
      };
    }),
    tpPkk: tpPkkRaw.sort(sortUrutan).map(function(p) {
      var allowHp = isTrueFlag_(p.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(p.NO_HP);
      return {
        id: p.ID_PKK, kategori: 'TP_PKK', nama: p.NAMA, jabatan: p.JABATAN,
        pokja: inferTpPkkPokjaGas_(p.JABATAN, p.POKJA), bidang: p.BIDANG || '',
        fotoUrl: p.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(p.URUTAN) || 1
      };
    }),
    lpmk: lpmkRaw.sort(sortUrutan).map(function(l) {
      var allowHp = isTrueFlag_(l.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(l.NO_HP);
      return {
        id: l.ID_LPMK, kategori: 'LPMK', nama: l.NAMA, jabatan: l.JABATAN,
        bidang: l.BIDANG || '', fotoUrl: l.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(l.URUTAN) || 1
      };
    }),
    rw: rwRaw.sort(sortUrutan).map(function(r) {
      var allowHp = isTrueFlag_(r.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(r.NO_HP);
      return {
        id: r.ID_RW, kategori: 'RW', nama: r.NAMA_KETUA, jabatan: r.JABATAN,
        idRw: r.ID_RW, nomorRw: r.NOMOR_RW, wilayahTugas: r.WILAYAH_TUGAS || '', fotoUrl: r.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(r.URUTAN) || 1
      };
    }),
    rt: rtRaw.filter(function(t) { return Boolean(rwMap[t.ID_RW]); }).sort(sortUrutan).map(function(t) {
      var allowHp = isTrueFlag_(t.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(t.NO_HP);
      return {
        id: t.ID_RT, kategori: 'RT', nama: t.NAMA_KETUA, jabatan: t.JABATAN,
        idRw: t.ID_RW, idRt: t.ID_RT, nomorRw: rwMap[t.ID_RW].NOMOR_RW, nomorRt: t.NOMOR_RT,
        wilayahTugas: t.WILAYAH_TUGAS || '', fotoUrl: t.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(t.URUTAN) || 1
      };
    }),
    kader: kaderRaw.filter(function(k) { return Boolean(rtMap[k.ID_RT] && rwMap[rtMap[k.ID_RT].ID_RW]); }).sort(sortUrutan).map(function(k) {
      var pRt = rtMap[k.ID_RT];
      var pRw = rwMap[pRt.ID_RW];
      var allowHp = isTrueFlag_(k.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(k.NO_HP);
      return {
        id: k.ID_KADER, kategori: 'KADER', nama: k.NAMA, jabatan: k.JABATAN,
        idRt: k.ID_RT, idRw: pRt.ID_RW, nomorRt: pRt.NOMOR_RT, nomorRw: pRw.NOMOR_RW,
        wilayahTugas: pRw.NOMOR_RW + ' · ' + pRt.NOMOR_RT, fotoUrl: k.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(k.URUTAN) || 1
      };
    }),
    sekolah: sekolahRaw.sort(sortUrutan).map(function(s) {
      var allowHp = isTrueFlag_(s.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(s.NO_HP);
      return {
        id: s.ID_SEKOLAH, kategori: 'SEKOLAH', nama: s.NAMA_SEKOLAH,
        jabatan: s.KEPALA_SEKOLAH ? (s.JENJANG + ' · Kepala Sekolah: ' + s.KEPALA_SEKOLAH) : s.JENJANG,
        jenjang: s.JENJANG, kepalaSekolah: s.KEPALA_SEKOLAH || undefined,
        idSekolah: s.ID_SEKOLAH, namaSekolah: s.NAMA_SEKOLAH,
        alamat: s.ALAMAT, wilayahTugas: s.ALAMAT,
        mapsUrl: buildMapsUrlGas_(s.MAPS_URL, s.NAMA_SEKOLAH + ', ' + s.ALAMAT),
        fotoUrl: s.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(s.URUTAN) || 1
      };
    }),
    guru: guruRaw.filter(function(g) { return Boolean(sekolahMap[g.ID_SEKOLAH]); }).sort(sortUrutan).map(function(g) {
      var pSchool = sekolahMap[g.ID_SEKOLAH];
      var allowHp = isTrueFlag_(g.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(g.NO_HP);
      return {
        id: g.ID_GURU, kategori: 'GURU', nama: g.NAMA, jabatan: g.JABATAN,
        idSekolah: g.ID_SEKOLAH, namaSekolah: pSchool.NAMA_SEKOLAH, jenjang: pSchool.JENJANG,
        alamat: pSchool.ALAMAT, wilayahTugas: pSchool.NAMA_SEKOLAH,
        fotoUrl: g.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(g.URUTAN) || 1
      };
    }),
    balaiRw: balaiRaw.filter(function(b) { return Boolean(rwMap[b.ID_RW]); }).sort(sortUrutan).map(function(b) {
      var pRw = rwMap[b.ID_RW];
      var allowHp = isTrueFlag_(b.TAMPILKAN_HP);
      var cleanHp = normalizePhoneRead_(b.NO_HP);
      return {
        id: b.ID_BALAI, kategori: 'BALAI_RW', nama: b.NAMA_BALAI,
        jabatan: 'Balai Pertemuan ' + pRw.NOMOR_RW,
        idRw: b.ID_RW, nomorRw: pRw.NOMOR_RW,
        alamat: b.ALAMAT, wilayahTugas: b.ALAMAT,
        jamLayanan: b.JAM_LAYANAN || undefined,
        mapsUrl: buildMapsUrlGas_(b.MAPS_URL, b.NAMA_BALAI + ', ' + b.ALAMAT),
        fotoUrl: b.FOTO_URL || undefined,
        noHp: allowHp && cleanHp ? cleanHp : undefined,
        waUrl: buildWaUrlGas_(cleanHp, allowHp), tampilkanHp: allowHp, urutan: Number(b.URUTAN) || 1
      };
    }),
    displaySettings: getOrgDisplaySettingsGas_()
  };
}

function getAdminOrgStructure(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var kel = sheetToObjects_('ORG_KELURAHAN');
  var tpPkk = getOrgSheetIfExists_('ORG_TP_PKK');
  var lpmk = sheetToObjects_('ORG_LPMK');
  var rw = sheetToObjects_('ORG_RW');
  var rt = sheetToObjects_('ORG_RT');
  var kader = sheetToObjects_('ORG_KADER');
  var sekolah = getOrgSheetIfExists_('ORG_SEKOLAH');
  var guru = getOrgSheetIfExists_('ORG_GURU');
  var balaiRw = getOrgSheetIfExists_('ORG_BALAI_RW');
  return {
    kelurahan: kel, tpPkk: tpPkk, lpmk: lpmk, rw: rw, rt: rt, kader: kader,
    sekolah: sekolah, guru: guru, balaiRw: balaiRw,
    displaySettings: getOrgDisplaySettingsGas_(),
    summary: {
      totalLurah: kel.filter(function(k) { return k.TINGKAT === 'LURAH'; }).length,
      totalKasi: kel.filter(function(k) { return k.TINGKAT === 'KASI'; }).length,
      totalStaf: kel.filter(function(k) { return k.TINGKAT === 'STAF'; }).length,
      totalTpPkk: tpPkk.length,
      totalLpmk: lpmk.length, totalRw: rw.length, totalRt: rt.length, totalKader: kader.length,
      totalSekolah: sekolah.length, totalGuru: guru.length, totalBalaiRw: balaiRw.length
    }
  };
}

function saveOrgPhotoToDrive_(fotoInput, prefixName) {
  var raw = String(fotoInput || '').trim();
  if (!raw || raw.indexOf('data:image/') !== 0) return raw;
  var match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return raw;
  var mimeType = match[1];
  var base64Data = match[2];
  var ext = mimeType.indexOf('png') !== -1 ? 'png' : 'jpg';
  var bytes = Utilities.base64Decode(base64Data);
  var safeName = String(prefixName || 'foto').replace(/[^A-Za-z0-9_-]/g, '_');
  var blob = Utilities.newBlob(bytes, mimeType, safeName + '_' + Date.now() + '.' + ext);
  var root = getRootDriveFolder_();
  var fotoIt = root.getFoldersByName('06_FOTO_ORGANISASI');
  var folder = fotoIt.hasNext() ? fotoIt.next() : root.createFolder('06_FOTO_ORGANISASI');
  var file = folder.createFile(blob);
  trySetSharing_(file, DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400';
}

function createOrgItem(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var entity = payload.entity;
  var now = new Date().toISOString();
  var idPrefix = entity === 'tp_pkk' ? 'PKK' : entity.toUpperCase();
  var id = idPrefix + '-' + Date.now();
  var allowHp = payload.tampilkanHp === true;
  var showPub = payload.tampilkanPublik !== false;
  var active = payload.aktif !== false;
  var order = Number(payload.urutan) || 99;
  var resolvedFotoUrl = saveOrgPhotoToDrive_(payload.fotoUrl, id);
  var sheetHp = formatPhoneForSheet_(payload.noHp);

  if (entity === 'kelurahan') {
    getSheet_('ORG_KELURAHAN').appendRow([id, payload.nama, payload.jabatan, payload.tingkat || 'STAF', payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'tp_pkk') {
    var shPkk = ensureOrgSheetExists_('ORG_TP_PKK', ['ID_PKK', 'NAMA', 'JABATAN', 'POKJA', 'BIDANG', 'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT']);
    shPkk.appendRow([id, payload.nama, payload.jabatan, inferTpPkkPokjaGas_(payload.jabatan, payload.pokja), payload.bidang || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'lpmk') {
    getSheet_('ORG_LPMK').appendRow([id, payload.nama, payload.jabatan, payload.bidang || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'rw') {
    getSheet_('ORG_RW').appendRow([id, payload.nomorRw, payload.namaKetua || payload.nama, payload.jabatan, payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'rt') {
    getSheet_('ORG_RT').appendRow([id, payload.idRw, payload.nomorRt, payload.namaKetua || payload.nama, payload.jabatan, payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'kader') {
    getSheet_('ORG_KADER').appendRow([id, payload.idRt, payload.nama, payload.jabatan, resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'sekolah') {
    getSheet_('ORG_SEKOLAH').appendRow([id, payload.namaSekolah || payload.nama, payload.jenjang || 'SD / MI', payload.kepalaSekolah || '', payload.alamat || '', payload.mapsUrl || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'guru') {
    getSheet_('ORG_GURU').appendRow([id, payload.idSekolah, payload.nama, payload.jabatan, resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else if (entity === 'balai_rw') {
    getSheet_('ORG_BALAI_RW').appendRow([id, payload.idRw, payload.namaBalai || payload.nama, payload.alamat || '', payload.jamLayanan || '', payload.mapsUrl || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, now, now]);
  } else {
    throw new Error('Entitas organisasi tidak valid.');
  }
  logActivity_(actor, 'ORG_CREATE_' + entity.toUpperCase(), id, 'Menambah data organisasi.');
  return { ok: true, id: id };
}

function updateOrgItem(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var entity = payload.entity;
  var id = payload.id;
  var sheetName = 'ORG_' + String(entity).toUpperCase();
  var idCol = getOrgIdColGas_(entity);
  var rows = sheetToObjects_(sheetName);
  var sh = getSheet_(sheetName);
  var target = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idCol] === id) { target = rows[i]; break; }
  }
  if (!target) throw new Error('Data tidak ditemukan.');
  var now = new Date().toISOString();
  var allowHp = payload.tampilkanHp === true;
  var showPub = payload.tampilkanPublik !== false;
  var active = payload.aktif !== false;
  var order = Number(payload.urutan) || 1;
  var resolvedFotoUrl = saveOrgPhotoToDrive_(payload.fotoUrl, id);
  var sheetHp = formatPhoneForSheet_(payload.noHp);
  var rowVals = [];
  if (entity === 'kelurahan') {
    rowVals = [id, payload.nama, payload.jabatan, payload.tingkat || 'STAF', payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'tp_pkk') {
    rowVals = [id, payload.nama, payload.jabatan, inferTpPkkPokjaGas_(payload.jabatan, payload.pokja), payload.bidang || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'lpmk') {
    rowVals = [id, payload.nama, payload.jabatan, payload.bidang || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'rw') {
    rowVals = [id, payload.nomorRw, payload.namaKetua || payload.nama, payload.jabatan, payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'rt') {
    rowVals = [id, payload.idRw, payload.nomorRt, payload.namaKetua || payload.nama, payload.jabatan, payload.wilayahTugas || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'kader') {
    rowVals = [id, payload.idRt, payload.nama, payload.jabatan, resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'sekolah') {
    rowVals = [id, payload.namaSekolah || payload.nama, payload.jenjang || 'SD / MI', payload.kepalaSekolah || '', payload.alamat || '', payload.mapsUrl || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'guru') {
    rowVals = [id, payload.idSekolah, payload.nama, payload.jabatan, resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  } else if (entity === 'balai_rw') {
    rowVals = [id, payload.idRw, payload.namaBalai || payload.nama, payload.alamat || '', payload.jamLayanan || '', payload.mapsUrl || '', resolvedFotoUrl || '', sheetHp, allowHp, showPub, active, order, target.CREATED_AT, now];
  }
  sh.getRange(target._rowIndex, 1, 1, rowVals.length).setValues([rowVals]);
  logActivity_(actor, 'ORG_UPDATE_' + entity.toUpperCase(), id, 'Memperbarui data organisasi.');
  return { ok: true, id: id };
}

function deleteOrgItem(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var entity = payload.entity;
  var id = payload.id;
  var sheetName = 'ORG_' + String(entity).toUpperCase();
  var idCol = getOrgIdColGas_(entity);
  var rows = sheetToObjects_(sheetName);
  var sh = getSheet_(sheetName);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i][idCol] === id) {
      sh.deleteRow(rows[i]._rowIndex);
      logActivity_(actor, 'ORG_DELETE_' + entity.toUpperCase(), id, 'Menghapus data organisasi.');
      return { ok: true };
    }
  }
  throw new Error('Data tidak ditemukan.');
}

function saveOrgSettings(payload, token) {
  return saveSettings({
    settings: [
      { KUNCI: 'ORG_PENGUMUMAN', NILAI: payload.pengumumanBeranda || '' },
      { KUNCI: 'ORG_URUTAN_BAGIAN', NILAI: JSON.stringify(payload.urutanBagian || ['KELURAHAN', 'TP_PKK', 'LPMK_RW_RT', 'KADER', 'SEKOLAH_GURU', 'BALAI_RW']) },
      { KUNCI: 'ORG_TAMPILKAN_BAGIAN', NILAI: JSON.stringify(payload.tampilkanBagian || { kelurahan: true, tpPkk: true, lpmk: true, rwRt: true, kader: true, sekolahGuru: true, balaiRw: true }) }
    ]
  }, token);
}

function importOrgBatch(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN', 'OPERATOR']);
  var entity = payload.entity;
  var items = payload.items || [];
  if (!items.length) throw new Error('Daftar data Excel untuk diimpor kosong.');
  var sheetName = 'ORG_' + String(entity).toUpperCase();
  var sh = entity === 'tp_pkk'
    ? ensureOrgSheetExists_('ORG_TP_PKK', ['ID_PKK', 'NAMA', 'JABATAN', 'POKJA', 'BIDANG', 'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'])
    : getSheet_(sheetName);
  var now = new Date().toISOString();
  var baseTs = Date.now();
  var rowsToAppend = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    var idPrefix = entity === 'tp_pkk' ? 'PKK' : entity.toUpperCase();
    var id = idPrefix + '-' + baseTs + '-' + i;
    var allowHp = item.tampilkanHp === true;
    var showPub = item.tampilkanPublik !== false;
    var active = item.aktif !== false;
    var order = Number(item.urutan) || (i + 1);
    var foto = String(item.fotoUrl || '');
    var hp = formatPhoneForSheet_(item.noHp);
    if (entity === 'kelurahan') {
      rowsToAppend.push([id, item.nama, item.jabatan, item.tingkat || 'STAF', item.wilayahTugas || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'tp_pkk') {
      rowsToAppend.push([id, item.nama, item.jabatan, inferTpPkkPokjaGas_(item.jabatan, item.pokja), item.bidang || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'lpmk') {
      rowsToAppend.push([id, item.nama, item.jabatan, item.bidang || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'rw') {
      rowsToAppend.push([id, item.nomorRw, item.namaKetua || item.nama, item.jabatan, item.wilayahTugas || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'rt') {
      rowsToAppend.push([id, item.idRw, item.nomorRt, item.namaKetua || item.nama, item.jabatan, item.wilayahTugas || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'kader') {
      rowsToAppend.push([id, item.idRt, item.nama, item.jabatan, foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'sekolah') {
      rowsToAppend.push([id, item.namaSekolah || item.nama, item.jenjang || 'SD / MI', item.kepalaSekolah || '', item.alamat || '', item.mapsUrl || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'guru') {
      rowsToAppend.push([id, item.idSekolah, item.nama, item.jabatan, foto, hp, allowHp, showPub, active, order, now, now]);
    } else if (entity === 'balai_rw') {
      rowsToAppend.push([id, item.idRw, item.namaBalai || item.nama, item.alamat || '', item.jamLayanan || '', item.mapsUrl || '', foto, hp, allowHp, showPub, active, order, now, now]);
    } else {
      throw new Error('Entitas organisasi tidak valid.');
    }
  }
  if (rowsToAppend.length > 0) {
    sh.getRange(sh.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
  }
  logActivity_(actor, 'ORG_IMPORT_' + String(entity).toUpperCase(), String(entity).toUpperCase(), 'Mengimpor ' + rowsToAppend.length + ' data organisasi.');
  return { ok: true, count: rowsToAppend.length };
}

function importPetugasBatch(payload, token) {
  var actor = verifyTokenAndRole_(token, ['SUPER_ADMIN']);
  var items = payload.items || [];
  if (!items.length) throw new Error('Daftar data petugas kosong.');
  var count = 0;
  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    if (item.namaPetugas && item.jabatan) {
      createPetugas(item, token);
      count++;
    }
  }
  logActivity_(actor, 'IMPORT_PETUGAS', 'PETUGAS', 'Mengimpor ' + count + ' data petugas.');
  return { ok: true, count: count };
}

function getBackupJson(token) {
  verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  return {
    exportedAt: new Date().toISOString(),
    desa: CONFIG.NAMA_DESA,
    warga: sheetToObjects_('WARGA'),
    petugas: sheetToObjects_('PETUGAS'),
    kategoriLayanan: sheetToObjects_('KATEGORI_LAYANAN'),
    laporan: sheetToObjects_('LAPORAN'),
    tindakLanjut: sheetToObjects_('TINDAK_LANJUT'),
    buktiDokumen: sheetToObjects_('BUKTI_DOKUMEN'),
    pengumuman: sheetToObjects_('PENGUMUMAN'),
    pengaturan: sheetToObjects_('PENGATURAN'),
    logAktivitas: sheetToObjects_('LOG_AKTIVITAS')
  };
}

function updateEvidenceDriveLink(payload, token) {
  var actor = verifyTokenAndRole_(token, ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN']);
  var idBukti = payload.idBukti || '';
  var rows = sheetToObjects_('BUKTI_DOKUMEN');
  var sh = getSheet_('BUKTI_DOKUMEN');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].ID_BUKTI === idBukti) {
      if (payload.driveFileId) sh.getRange(rows[i]._rowIndex, 6).setValue(String(payload.driveFileId));
      if (payload.driveUrl) sh.getRange(rows[i]._rowIndex, 7).setValue(String(payload.driveUrl));
      logActivity_(actor, 'LINK_DRIVE_EVIDENCE', idBukti, 'Tautkan bukti ke Google Drive');
      return { ok: true };
    }
  }
  throw new Error('Data bukti tidak ditemukan.');
}

