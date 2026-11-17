import express, { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  buildCsvExport,
  computeDashboardStats,
  maskKk,
  maskNik,
  sanitizeReportForCitizenTracking,
  validateDynamicFormFields,
  validateEvidenceFile,
  validateFollowUpUpdate,
  verifyCitizenTrackingAccess,
} from './src/shared/siwargaLogic';
import {
  computeAdminOrgSummary,
  extractOrgDisplaySettings,
  inferTpPkkPokja,
  normalizeIndonesianPhone,
  OrgEntityType,
  sanitizePublicOrgData,
  validateOrgInput,
} from './src/shared/orgLogic';
import {
  EvidenceType,
  EvidenceVisibility,
  FORM_FIELD_TYPES,
  PublicUserSession,
  REPORT_STATUSES,
  ReportStatus,
  SERVICE_GROUPS,
  SheetBuktiDokumen,
  SheetKategoriLayanan,
  SheetKonfigurasiForm,
  SheetLaporan,
  SheetUser,
  SiwargaDatabase,
  UserRole,
} from './src/shared/types';
import {
  generateAtomicTicket,
  hashPassword,
  hashSensitiveId,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './src/server/cryptoUtils';
import {
  appendActivityLog,
  DRIVE_ROOT_DIR,
  DRIVE_SUBFOLDERS,
  ensureDriveStructure,
  ensureTicketFolder,
  getSettingValue,
  loadDatabase,
  saveDatabase,
  setSettingValue,
  ticketLock,
} from './src/server/store';

interface AuthedRequest extends Request {
  sessionUser?: PublicUserSession;
}

const PORT = Number(process.env.PORT || 3000);
const STAFF_ROLES: UserRole[] = ['PETUGAS', 'OPERATOR', 'KEPALA_DESA', 'SUPER_ADMIN'];

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  const qToken = typeof req.query.token === 'string' ? req.query.token : null;
  return qToken;
}

function buildPublicSessionUser(db: SiwargaDatabase, user: SheetUser): PublicUserSession {
  const wargaProfile = db.WARGA.find((w) => w.ID_USER === user.ID_USER);
  return {
    idUser: user.ID_USER,
    username: user.USERNAME,
    namaLengkap: user.NAMA_LENGKAP,
    role: user.ROLE,
    noHp: normalizeIndonesianPhone(user.NO_HP) || user.NO_HP,
    statusAkun: user.STATUS_AKUN,
    idWarga: wargaProfile?.ID_WARGA,
    nikMasked: wargaProfile?.NIK_MASKED,
    tanggalLahir: wargaProfile?.TANGGAL_LAHIR,
    rtRw: wargaProfile?.RT_RW,
    alamat: wargaProfile?.ALAMAT,
  };
}

function resolveLiveUserFromToken(token: string): PublicUserSession | null {
  const tokenUser = verifySessionToken(token);
  if (!tokenUser) return null;
  const db = loadDatabase();
  const dbUser = db.USERS.find((u) => u.ID_USER === tokenUser.idUser);
  if (!dbUser) return tokenUser;
  if (dbUser.STATUS_AKUN === 'NONAKTIF') return null;
  return buildPublicSessionUser(db, dbUser);
}

function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const user = resolveLiveUserFromToken(token);
    if (user) req.sessionUser = user;
  }
  next();
}

function requireAuth(allowedRoles?: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Sesi login diperlukan. Silakan masuk terlebih dahulu.' });
    }
    const user = resolveLiveUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Sesi login tidak valid, dinonaktifkan, atau telah kedaluwarsa.' });
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Anda tidak memiliki hak akses untuk fitur ini.' });
    }
    req.sessionUser = user;
    next();
  };
}

function parseBase64Upload(dataUrlOrBase64: string): Buffer {
  const commaIdx = dataUrlOrBase64.indexOf(',');
  const clean = commaIdx >= 0 ? dataUrlOrBase64.slice(commaIdx + 1) : dataUrlOrBase64;
  return Buffer.from(clean, 'base64');
}

async function forwardToGasIfEnabled(action: string, payload: unknown): Promise<void> {
  const db = loadDatabase();
  const enabled = getSettingValue(db, 'GAS_SYNC_ENABLED', 'false') === 'true';
  const gasUrl = getSettingValue(db, 'GAS_WEB_APP_URL', '').trim();
  if (!enabled || !gasUrl) return;
  try {
    await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
  } catch (err) {
    console.warn('GAS sync skipped/failed:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'SIWARGA Desa Ampel' });
  });

  // ===========================================================================
  // 1. AUTHENTICATION & CITIZEN REGISTRATION / VERIFICATION / RECOVERY
  // ===========================================================================
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(400).json({ error: 'Username/No. HP dan kata sandi wajib diisi.' });
    }
    const db = loadDatabase();
    const key = username.trim().toLowerCase();
    const normInputHp = normalizeIndonesianPhone(username);
    const user = db.USERS.find(
      (u) =>
        u.USERNAME.toLowerCase() === key ||
        u.EMAIL.toLowerCase() === key ||
        u.NO_HP === username.trim() ||
        (normInputHp && normalizeIndonesianPhone(u.NO_HP) === normInputHp)
    );
    if (!user || !verifyPassword(password, user.PASSWORD_HASH)) {
      return res.status(401).json({ error: 'Username/No. HP atau kata sandi salah.' });
    }
    if (user.STATUS_AKUN === 'NONAKTIF') {
      return res.status(403).json({ error: 'Akun ini dinonaktifkan. Hubungi Operator Desa.' });
    }
    const sessionUser = buildPublicSessionUser(db, user);
    const token = signSessionToken(sessionUser);
    appendActivityLog(
      db,
      { idUser: user.ID_USER, nama: user.NAMA_LENGKAP, role: user.ROLE },
      'LOGIN',
      user.ID_USER,
      `${user.NAMA_LENGKAP} berhasil masuk ke WARGA AMPEL.`
    );
    saveDatabase(db);
    return res.json({ token, user: sessionUser });
  });

  app.post('/api/auth/register', (req, res) => {
    const { namaLengkap, nik, kk, tanggalLahir, alamat, rtRw, noHp, username, password } = req.body || {};
    if (
      typeof namaLengkap !== 'string' ||
      namaLengkap.trim().length < 3 ||
      typeof nik !== 'string' ||
      nik.replace(/\D/g, '').length !== 16 ||
      typeof noHp !== 'string' ||
      noHp.replace(/\D/g, '').length < 9 ||
      typeof tanggalLahir !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir) ||
      typeof password !== 'string' ||
      password.length < 6
    ) {
      return res.status(400).json({
        error: 'Pastikan Nama lengkap, NIK (16 digit), Tanggal lahir, No. HP, dan kata sandi (min. 6 karakter) diisi dengan benar.',
      });
    }

    const db = loadDatabase();
    const cleanUsername = (typeof username === 'string' && username.trim()) || noHp.trim();
    const existsUser = db.USERS.find(
      (u) => u.USERNAME.toLowerCase() === cleanUsername.toLowerCase() || u.NO_HP === noHp.trim()
    );
    if (existsUser) {
      return res.status(409).json({ error: 'Username atau nomor HP sudah terdaftar.' });
    }

    const nikDigits = nik.replace(/\D/g, '');
    const kkDigits = typeof kk === 'string' ? kk.replace(/\D/g, '') : '';
    const nikHash = hashSensitiveId(nikDigits);
    const idUser = `USR-WRG-${Date.now()}`;
    const idWarga = `WRG-${Date.now()}`;
    const verificationCode = `AMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    db.USERS.push({
      ID_USER: idUser,
      USERNAME: cleanUsername,
      NAMA_LENGKAP: namaLengkap.trim(),
      EMAIL: `${cleanUsername}@warga.ampel.id`,
      NO_HP: noHp.trim(),
      PASSWORD_HASH: hashPassword(password),
      ROLE: 'WARGA',
      STATUS_AKUN: 'MENUNGGU_VERIFIKASI',
      KODE_VERIFIKASI: verificationCode,
      CREATED_AT: now,
    });

    db.WARGA.push({
      ID_WARGA: idWarga,
      ID_USER: idUser,
      NAMA_LENGKAP: namaLengkap.trim(),
      NIK_MASKED: maskNik(nikDigits),
      NIK_HASH: nikHash,
      KK_MASKED: kkDigits.length >= 10 ? maskKk(kkDigits) : '******',
      TANGGAL_LAHIR: tanggalLahir,
      ALAMAT: typeof alamat === 'string' ? alamat.trim() : 'Desa Ampel',
      RT_RW: typeof rtRw === 'string' && rtRw.trim() ? rtRw.trim() : 'RT 01 / RW 01',
      NO_HP: noHp.trim(),
      STATUS_VERIFIKASI: 'MENUNGGU_VERIFIKASI',
      CREATED_AT: now,
    });

    appendActivityLog(
      db,
      { idUser, nama: namaLengkap.trim(), role: 'WARGA' },
      'REGISTER_WARGA',
      idWarga,
      `Pendaftaran warga baru (${maskNik(nikDigits)}) menunggu verifikasi.`
    );
    saveDatabase(db);

    return res.status(201).json({
      message: 'Pendaftaran berhasil. Gunakan kode verifikasi berikut untuk mengaktifkan akun Anda.',
      username: cleanUsername,
      kodeVerifikasi: verificationCode,
    });
  });

  app.post('/api/auth/verify', (req, res) => {
    const { username, kodeVerifikasi } = req.body || {};
    if (typeof username !== 'string' || typeof kodeVerifikasi !== 'string') {
      return res.status(400).json({ error: 'Username dan kode verifikasi wajib diisi.' });
    }
    const db = loadDatabase();
    const normInputHp = normalizeIndonesianPhone(username);
    const user = db.USERS.find(
      (u) =>
        u.USERNAME.toLowerCase() === username.trim().toLowerCase() ||
        u.NO_HP === username.trim() ||
        (normInputHp && normalizeIndonesianPhone(u.NO_HP) === normInputHp)
    );
    if (!user || user.KODE_VERIFIKASI !== kodeVerifikasi.trim().toUpperCase()) {
      return res.status(400).json({ error: 'Kode verifikasi tidak cocok.' });
    }
    user.STATUS_AKUN = 'AKTIF';
    const warga = db.WARGA.find((w) => w.ID_USER === user.ID_USER);
    if (warga) {
      warga.STATUS_VERIFIKASI = 'TERVERIFIKASI';
    }
    appendActivityLog(
      db,
      { idUser: user.ID_USER, nama: user.NAMA_LENGKAP, role: user.ROLE },
      'VERIFIKASI_WARGA',
      user.ID_USER,
      'Akun warga berhasil diverifikasi dengan kode verifikasi.'
    );
    saveDatabase(db);

    const sessionUser = buildPublicSessionUser(db, user);
    const token = signSessionToken(sessionUser);
    return res.json({ message: 'Akun berhasil diverifikasi.', token, user: sessionUser });
  });

  app.post('/api/auth/reset-password', (req, res) => {
    const { username, tanggalLahir, newPassword } = req.body || {};
    if (typeof username !== 'string' || typeof tanggalLahir !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Username/No. HP, tanggal lahir terdaftar, dan kata sandi baru (min. 6 karakter) wajib diisi.' });
    }
    const db = loadDatabase();
    const normResetHp = normalizeIndonesianPhone(username);
    const user = db.USERS.find(
      (u) =>
        u.USERNAME.toLowerCase() === username.trim().toLowerCase() ||
        u.NO_HP === username.trim() ||
        (normResetHp && normalizeIndonesianPhone(u.NO_HP) === normResetHp)
    );
    if (!user) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    const warga = db.WARGA.find((w) => w.ID_USER === user.ID_USER);
    if (user.ROLE === 'WARGA' && warga && warga.TANGGAL_LAHIR !== tanggalLahir.trim()) {
      return res.status(403).json({ error: 'Tanggal lahir tidak sesuai dengan data warga terdaftar.' });
    }
    user.PASSWORD_HASH = hashPassword(newPassword);
    appendActivityLog(
      db,
      { idUser: user.ID_USER, nama: user.NAMA_LENGKAP, role: user.ROLE },
      'RESET_PASSWORD',
      user.ID_USER,
      'Pengaturan ulang kata sandi berhasil dilakukan.'
    );
    saveDatabase(db);
    return res.json({ message: 'Kata sandi berhasil diperbarui. Silakan masuk kembali.' });
  });

  app.get('/api/auth/me', requireAuth(), (req: AuthedRequest, res) => {
    return res.json({ user: req.sessionUser });
  });

  // ===========================================================================
  // 2. PUBLIC CITIZEN PORTAL ENDPOINTS (SERVICES, ANNOUNCEMENTS, SUBMIT, TRACK)
  // ===========================================================================
  app.get('/api/public/role-accounts', (_req, res) => {
    const db = loadDatabase();
    const roleOrder: UserRole[] = ['SUPER_ADMIN', 'KEPALA_DESA', 'OPERATOR', 'PETUGAS', 'WARGA'];
    const accounts = roleOrder
      .map((role) => {
        const match =
          db.USERS.find((u) => u.ROLE === role && u.STATUS_AKUN === 'AKTIF') ||
          db.USERS.find((u) => u.ROLE === role);
        if (!match) return null;
        return {
          idUser: match.ID_USER,
          username: match.USERNAME,
          namaLengkap: match.NAMA_LENGKAP,
          role: match.ROLE,
        };
      })
      .filter(Boolean);
    return res.json({ accounts });
  });

  app.get('/api/public/services', (_req, res) => {
    const db = loadDatabase();
    const active = db.KATEGORI_LAYANAN.filter((s) => s.STATUS_AKTIF)
      .sort((a, b) => a.URUTAN - b.URUTAN)
      .map((s) => {
        const officer = db.PETUGAS.find((p) => p.ID_PETUGAS === s.ID_PETUGAS_PJ);
        return {
          ...s,
          NAMA_PETUGAS_PJ: officer?.NAMA_PETUGAS || s.NAMA_PETUGAS_PJ,
          fields: db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN === s.ID_LAYANAN).sort(
            (a, b) => a.URUTAN - b.URUTAN
          ),
        };
      });
    return res.json({ services: active, groups: SERVICE_GROUPS });
  });

  app.get('/api/public/announcements', (_req, res) => {
    const db = loadDatabase();
    const list = db.PENGUMUMAN.filter((p) => p.AKTIF).sort((a, b) =>
      b.TANGGAL_TERBIT.localeCompare(a.TANGGAL_TERBIT)
    );
    return res.json({ announcements: list });
  });

  app.post('/api/reports', optionalAuth, async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const db = loadDatabase();

    const isGeneralInquiry = body.isGeneralInquiry === true || body.idLayanan === 'GENERAL_INQUIRY';
    const service = isGeneralInquiry
      ? null
      : db.KATEGORI_LAYANAN.find((s) => s.ID_LAYANAN === body.idLayanan && s.STATUS_AKTIF);

    if (!isGeneralInquiry && !service) {
      return res.status(400).json({ error: 'Jenis layanan yang dipilih tidak ditemukan atau tidak aktif.' });
    }

    const namaPelapor = (String(body.namaPelapor || '') || req.sessionUser?.namaLengkap || '').trim();
    const noHpRaw = String(body.noHpPelapor || '') || req.sessionUser?.noHp || '';
    const noHpPelapor = normalizeIndonesianPhone(noHpRaw) || noHpRaw.trim();
    const tanggalLahir = (String(body.tanggalLahir || '') || req.sessionUser?.tanggalLahir || '').trim();
    const uraianMasalah = String(body.uraianMasalah || '').trim();
    const lokasiAlamat = String(body.lokasiAlamat || '').trim();
    const rtRw = String(body.rtRw || req.sessionUser?.rtRw || '').trim();
    const masalahUtama = isGeneralInquiry
      ? 'Belum diklasifikasi'
      : String(body.masalahUtama || service?.NAMA_LAYANAN || '').trim();

    if (namaPelapor.length < 2) {
      return res.status(400).json({ error: 'Nama pelapor wajib diisi.' });
    }
    if (noHpPelapor.replace(/\D/g, '').length < 8) {
      return res.status(400).json({ error: 'Nomor HP / WhatsApp yang valid wajib diisi.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalLahir)) {
      return res.status(400).json({ error: 'Tanggal lahir (YYYY-MM-DD) wajib diisi untuk verifikasi cek laporan.' });
    }
    if (uraianMasalah.length < 10) {
      return res.status(400).json({ error: 'Ceritakan masalah atau kebutuhan Anda minimal 10 karakter.' });
    }
    if (lokasiAlamat.length < 3) {
      return res.status(400).json({ error: 'Alamat atau titik lokasi wajib diisi.' });
    }

    const dynamicValues: Record<string, string | string[]> =
      body.dataFormDinamis && typeof body.dataFormDinamis === 'object' ? body.dataFormDinamis : {};

    if (service) {
      const fields = db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN === service.ID_LAYANAN);
      const dynCheck = validateDynamicFormFields(fields, dynamicValues);
      if (!dynCheck.valid) {
        return res.status(400).json({
          error: Object.values(dynCheck.errors)[0] || 'Isian tambahan layanan belum lengkap.',
          fieldErrors: dynCheck.errors,
        });
      }
    }

    // Validate optional file attachment before acquiring ticket lock
    const maxFileMb = Number(getSettingValue(db, 'MAX_FILE_MB', '5')) || 5;
    let attachmentBuffer: Buffer | null = null;
    let attachmentMeta: { fileName: string; mimeType: string; sizeBytes: number } | null = null;
    if (body.attachment && typeof body.attachment.base64 === 'string' && body.attachment.base64.length > 0) {
      attachmentBuffer = parseBase64Upload(body.attachment.base64);
      const fileName = String(body.attachment.fileName || 'lampiran.jpg');
      const mimeType = String(body.attachment.mimeType || 'image/jpeg');
      const fileCheck = validateEvidenceFile(fileName, mimeType, attachmentBuffer.length, maxFileMb);
      if (!fileCheck.valid) {
        return res.status(400).json({ error: fileCheck.error });
      }
      attachmentMeta = { fileName, mimeType, sizeBytes: attachmentBuffer.length };
    }

    // Atomic ticket number inside LockService-equivalent lock
    const tahunTiket = Number(getSettingValue(db, 'TAHUN_TIKET', String(new Date().getFullYear())));
    const ticketId = await generateAtomicTicket(
      ticketLock,
      () => Number(getSettingValue(db, 'TICKET_COUNTER', '0')),
      (next) => {
        setSettingValue(db, 'TICKET_COUNTER', String(next));
      },
      tahunTiket
    );

    const now = new Date().toISOString();
    const { folderName, folderPath, subPath } = ensureTicketFolder(ticketId);
    const judulLaporan =
      String(body.judulLaporan || '').trim() ||
      (isGeneralInquiry
        ? `Laporan Umum Warga (${rtRw || 'Desa Ampel'})`
        : `${masalahUtama} — ${rtRw || lokasiAlamat.slice(0, 28)}`);

    const newReport: SheetLaporan = {
      ID_LAPORAN: ticketId,
      ID_WARGA: req.sessionUser?.idWarga,
      ID_USER_PELAPOR: req.sessionUser?.idUser,
      NAMA_PELAPOR: namaPelapor,
      NO_HP_PELAPOR: noHpPelapor,
      TANGGAL_LAHIR_VERIFIKASI: tanggalLahir,
      NIK_MASKED_PELAPOR: req.sessionUser?.nikMasked,
      KODE_GRUP: isGeneralInquiry ? 'GENERAL_INQUIRY' : service!.KATEGORI_GRUP,
      ID_LAYANAN: isGeneralInquiry ? 'GENERAL_INQUIRY' : service!.ID_LAYANAN,
      NAMA_LAYANAN: isGeneralInquiry ? 'Saya Tidak Tahu (Perlu Klasifikasi)' : service!.NAMA_LAYANAN,
      JUDUL_LAPORAN: judulLaporan,
      MASALAH_UTAMA: masalahUtama,
      URAIAN_MASALAH: uraianMasalah,
      LOKASI_ALAMAT: lokasiAlamat,
      RT_RW: rtRw || 'Desa Ampel',
      DATA_FORM_DINAMIS: dynamicValues,
      STATUS_TERBARU: 'Laporan diterima',
      ID_PETUGAS_TUGAS: service?.ID_PETUGAS_PJ,
      NAMA_PETUGAS_TUGAS:
        db.PETUGAS.find((p) => p.ID_PETUGAS === service?.ID_PETUGAS_PJ)?.NAMA_PETUGAS ||
        service?.NAMA_PETUGAS_PJ ||
        db.USERS.find((u) => u.ROLE === 'OPERATOR')?.NAMA_LENGKAP ||
        'Operator Desa',
      DRIVE_FOLDER_NAME: folderName,
      DRIVE_FOLDER_URL: `SIWARGA_DESA/${subPath}`,
      CREATED_AT: now,
      UPDATED_AT: now,
    };

    const initialUpdateId = `UPD-${Date.now()}`;
    db.LAPORAN.unshift(newReport);
    db.TINDAK_LANJUT.push({
      ID_UPDATE: initialUpdateId,
      ID_LAPORAN: ticketId,
      TANGGAL_UPDATE: now.slice(0, 10),
      STATUS: 'Laporan diterima',
      KETERANGAN: isGeneralInquiry
        ? 'Laporan umum diterima. Operator desa akan mengarahkan laporan ke layanan yang sesuai.'
        : 'Laporan telah diterima dan dicatat ke sistem pelayanan desa.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Sistem WARGA AMPEL',
      CREATED_AT: now,
    });

    if (attachmentBuffer && attachmentMeta) {
      const safeName = attachmentMeta.fileName.replace(/[^A-Za-z0-9._-]/g, '_');
      const storedFileName = `Foto_awal_${Date.now()}_${safeName}`;
      fs.writeFileSync(path.join(folderPath, storedFileName), attachmentBuffer);
      const idBukti = `BKT-${Date.now()}`;
      db.BUKTI_DOKUMEN.push({
        ID_BUKTI: idBukti,
        ID_LAPORAN: ticketId,
        ID_UPDATE: initialUpdateId,
        NAMA_FILE: storedFileName,
        MIME_TYPE: attachmentMeta.mimeType,
        UKURAN_BYTES: attachmentMeta.sizeBytes,
        JENIS_BUKTI: 'Foto sebelum perbaikan',
        DRIVE_FOLDER_SUB: subPath,
        DRIVE_FILE_ID: `DRV-${Date.now()}`,
        DRIVE_URL: `/api/evidence/${idBukti}`,
        TANGGAL_UPLOAD: now,
        DIUNGGAH_OLEH: namaPelapor,
        VISIBILITAS: 'PUBLIK_WARGA',
      });
    }

    db.NOTIFIKASI.unshift({
      ID_NOTIFIKASI: `NTF-${Date.now()}`,
      TARGET_USER_ID: 'ALL_STAFF',
      TARGET_ROLE: 'OPERATOR',
      ID_LAPORAN: ticketId,
      JUDUL: isGeneralInquiry ? 'Laporan Umum Baru (Perlu Klasifikasi)' : `Laporan Baru ${ticketId}`,
      PESAN: `${judulLaporan} (${newReport.RT_RW}) menunggu penanganan.`,
      DIBACA: false,
      CREATED_AT: now,
    });

    if (req.sessionUser?.idUser) {
      db.NOTIFIKASI.unshift({
        ID_NOTIFIKASI: `NTF-WRG-${Date.now()}`,
        TARGET_USER_ID: req.sessionUser.idUser,
        TARGET_ROLE: 'WARGA',
        ID_LAPORAN: ticketId,
        JUDUL: `Laporan ${ticketId} Terkirim`,
        PESAN: `Terima kasih. Laporan Anda telah tercatat dengan nomor tiket ${ticketId}.`,
        DIBACA: false,
        CREATED_AT: now,
      });
    }

    appendActivityLog(
      db,
      {
        idUser: req.sessionUser?.idUser || 'PUBLIC_WARGA',
        nama: namaPelapor,
        role: req.sessionUser?.role || 'WARGA',
      },
      'SUBMIT_REPORT',
      ticketId,
      `Laporan baru ${ticketId} (${newReport.KODE_GRUP}) disimpan beserta folder Drive ${subPath}.`
    );
    saveDatabase(db);
    void forwardToGasIfEnabled('submitReport', newReport);

    return res.status(201).json({
      ticketId,
      report: {
        idLaporan: ticketId,
        judulLaporan: newReport.JUDUL_LAPORAN,
        namaLayanan: newReport.NAMA_LAYANAN,
        statusTerbaru: newReport.STATUS_TERBARU,
        driveFolder: newReport.DRIVE_FOLDER_URL,
        createdAt: newReport.CREATED_AT,
        hasAttachment: Boolean(attachmentMeta),
      },
    });
  });

  app.post('/api/reports/track', (req, res) => {
    const { ticketId, tanggalLahir, last4Hp } = req.body || {};
    if (typeof ticketId !== 'string' || !ticketId.trim()) {
      return res.status(400).json({ error: 'Nomor tiket laporan wajib diisi.' });
    }
    const db = loadDatabase();
    const report = db.LAPORAN.find(
      (r) => r.ID_LAPORAN.toUpperCase() === ticketId.trim().toUpperCase()
    );
    if (!report) {
      return res.status(404).json({ error: 'Nomor tiket tidak ditemukan.' });
    }
    const verified = verifyCitizenTrackingAccess(report, { tanggalLahir, last4Hp });
    if (!verified) {
      return res.status(403).json({
        error: 'Verifikasi identitas gagal. Pastikan tanggal lahir atau 4 digit terakhir nomor HP sesuai dengan data pelapor.',
      });
    }
    const tracking = sanitizeReportForCitizenTracking(report, db.TINDAK_LANJUT, db.BUKTI_DOKUMEN);
    return res.json({ tracking });
  });

  // ===========================================================================
  // 3. SECURE EVIDENCE SERVING (ENFORCES PUBLIK_WARGA VS INTERNAL_DESA)
  // ===========================================================================
  app.get('/api/evidence/:id', optionalAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const doc = db.BUKTI_DOKUMEN.find((b) => b.ID_BUKTI === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Dokumen bukti tidak ditemukan.' });
    }
    const isStaff = req.sessionUser && STAFF_ROLES.includes(req.sessionUser.role);
    const ticketParam = typeof req.query.ticket === 'string' ? req.query.ticket.toUpperCase() : '';
    const report = db.LAPORAN.find((r) => r.ID_LAPORAN === doc.ID_LAPORAN);
    const isOwner = Boolean(req.sessionUser && report?.ID_USER_PELAPOR === req.sessionUser.idUser);

    if (doc.VISIBILITAS !== 'PUBLIK_WARGA' && !isStaff) {
      return res.status(403).json({ error: 'Bukti ini bersifat internal desa dan tidak dapat diakses publik.' });
    }
    if (!isStaff && !isOwner && ticketParam !== doc.ID_LAPORAN.toUpperCase()) {
      return res.status(403).json({ error: 'Akses bukti memerlukan verifikasi tiket atau sesi login.' });
    }

    const filePath = path.join(DRIVE_ROOT_DIR, doc.DRIVE_FOLDER_SUB, doc.NAMA_FILE);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File fisik belum tersedia di penyimpanan Drive.' });
    }
    res.setHeader('Content-Type', doc.MIME_TYPE);
    res.setHeader('Content-Disposition', `inline; filename="${doc.NAMA_FILE}"`);
    return fs.createReadStream(filePath).pipe(res);
  });

  // ===========================================================================
  // 4. CITIZEN PERSONAL DASHBOARD (WARGA ONLY)
  // ===========================================================================
  app.get('/api/citizen/dashboard', requireAuth(['WARGA', 'SUPER_ADMIN', 'OPERATOR', 'PETUGAS', 'KEPALA_DESA']), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const uid = req.sessionUser!.idUser;
    const myReports = db.LAPORAN.filter(
      (r) => r.ID_USER_PELAPOR === uid || (req.sessionUser?.idWarga && r.ID_WARGA === req.sessionUser.idWarga)
    ).map((r) => sanitizeReportForCitizenTracking(r, db.TINDAK_LANJUT, db.BUKTI_DOKUMEN));

    const notifications = db.NOTIFIKASI.filter(
      (n) => n.TARGET_USER_ID === uid || n.TARGET_ROLE === 'ALL'
    ).slice(0, 20);

    const announcements = db.PENGUMUMAN.filter((p) => p.AKTIF);
    return res.json({ myReports, notifications, announcements });
  });

  app.post('/api/citizen/notifications/:id/read', requireAuth(), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const notif = db.NOTIFIKASI.find((n) => n.ID_NOTIFIKASI === req.params.id);
    if (notif) {
      notif.DIBACA = true;
      saveDatabase(db);
    }
    return res.json({ ok: true });
  });

  // ===========================================================================
  // 5. ADMIN / STAFF DASHBOARD, REPORTS, FOLLOW-UPS, EVIDENCE & CLASSIFICATION
  // ===========================================================================
  app.get('/api/admin/dashboard', requireAuth(STAFF_ROLES), (_req: AuthedRequest, res) => {
    const db = loadDatabase();
    const stats = computeDashboardStats(db.LAPORAN, db.WARGA, db.PETUGAS);
    const staffNotifications = db.NOTIFIKASI.filter((n) => n.TARGET_USER_ID === 'ALL_STAFF').slice(0, 10);
    return res.json({ stats, notifications: staffNotifications });
  });

  app.get('/api/admin/reports', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const group = typeof req.query.group === 'string' ? req.query.group : '';
    const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';

    let reports = [...db.LAPORAN];
    if (status) reports = reports.filter((r) => r.STATUS_TERBARU === status);
    if (group) reports = reports.filter((r) => r.KODE_GRUP === group);
    if (serviceId) reports = reports.filter((r) => r.ID_LAYANAN === serviceId);
    if (dateFrom) reports = reports.filter((r) => r.CREATED_AT.slice(0, 10) >= dateFrom);
    if (dateTo) reports = reports.filter((r) => r.CREATED_AT.slice(0, 10) <= dateTo);
    if (search) {
      reports = reports.filter(
        (r) =>
          r.ID_LAPORAN.toLowerCase().includes(search) ||
          r.JUDUL_LAPORAN.toLowerCase().includes(search) ||
          r.NAMA_PELAPOR.toLowerCase().includes(search) ||
          r.NAMA_LAYANAN.toLowerCase().includes(search)
      );
    }

    return res.json({ reports });
  });

  app.get('/api/admin/reports/:id', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const report = db.LAPORAN.find((r) => r.ID_LAPORAN === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }
    const followUps = db.TINDAK_LANJUT.filter((f) => f.ID_LAPORAN === report.ID_LAPORAN).sort((a, b) =>
      a.CREATED_AT.localeCompare(b.CREATED_AT)
    );
    const evidence = db.BUKTI_DOKUMEN.filter((b) => b.ID_LAPORAN === report.ID_LAPORAN).sort((a, b) =>
      a.TANGGAL_UPLOAD.localeCompare(b.TANGGAL_UPLOAD)
    );
    return res.json({ report, followUps, evidence });
  });

  app.post('/api/admin/reports/:id/followup', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const report = db.LAPORAN.find((r) => r.ID_LAPORAN === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }

    const { status, keterangan, tanggalTindakan, dinasTujuan, nomorSurat, evidenceUpload } = req.body || {};
    const validation = validateFollowUpUpdate({
      status: String(status || ''),
      keterangan: String(keterangan || ''),
      dinasTujuan: String(dinasTujuan || ''),
      nomorSurat: String(nomorSurat || ''),
    });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Optional attached evidence within same follow-up transaction
    const maxFileMb = Number(getSettingValue(db, 'MAX_FILE_MB', '5')) || 5;
    let fileBuf: Buffer | null = null;
    if (evidenceUpload && typeof evidenceUpload.base64 === 'string' && evidenceUpload.base64.length > 0) {
      fileBuf = parseBase64Upload(evidenceUpload.base64);
      const check = validateEvidenceFile(
        String(evidenceUpload.fileName || ''),
        String(evidenceUpload.mimeType || ''),
        fileBuf.length,
        maxFileMb
      );
      if (!check.valid) {
        return res.status(400).json({ error: check.error });
      }
    }

    const now = new Date().toISOString();
    const updateId = `UPD-${Date.now()}`;
    const nextStatus = status as ReportStatus;

    // Append-only: NEVER overwrite previous TINDAK_LANJUT rows
    db.TINDAK_LANJUT.push({
      ID_UPDATE: updateId,
      ID_LAPORAN: report.ID_LAPORAN,
      TANGGAL_UPDATE: typeof tanggalTindakan === 'string' && tanggalTindakan ? tanggalTindakan : now.slice(0, 10),
      STATUS: nextStatus,
      KETERANGAN: String(keterangan).trim(),
      DINAS_TUJUAN: String(dinasTujuan || '').trim(),
      NOMOR_SURAT: String(nomorSurat || '').trim(),
      PETUGAS: req.sessionUser!.namaLengkap,
      CREATED_AT: now,
    });

    report.STATUS_TERBARU = nextStatus;
    report.UPDATED_AT = now;
    if (nextStatus === 'Tidak dapat ditindaklanjuti') {
      report.ALASAN_TIDAK_DITINDAKLANJUTI = String(keterangan).trim();
    }

    let createdEvidence: SheetBuktiDokumen | null = null;
    if (fileBuf && evidenceUpload) {
      const jenisBukti = (evidenceUpload.jenisBukti || 'Dokumen pendukung lainnya') as EvidenceType;
      const visibilitas: EvidenceVisibility =
        evidenceUpload.visibilitas === 'INTERNAL_DESA' ? 'INTERNAL_DESA' : 'PUBLIK_WARGA';

      let subFolder = ensureTicketFolder(report.ID_LAPORAN).subPath;
      if (jenisBukti === 'Surat usulan ke dinas' || jenisBukti === 'Surat balasan dinas') {
        subFolder = '04_SURAT_KE_DINAS';
      } else if (jenisBukti === 'Foto proses' || jenisBukti === 'Foto sesudah perbaikan') {
        subFolder = ensureTicketFolder(report.ID_LAPORAN).subPath;
      }

      const targetDir = path.join(DRIVE_ROOT_DIR, subFolder);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

      const cleanName = String(evidenceUpload.fileName).replace(/[^A-Za-z0-9._-]/g, '_');
      const storedName = `${report.ID_LAPORAN}_${Date.now()}_${cleanName}`;
      fs.writeFileSync(path.join(targetDir, storedName), fileBuf);

      const idBukti = `BKT-${Date.now()}`;
      createdEvidence = {
        ID_BUKTI: idBukti,
        ID_LAPORAN: report.ID_LAPORAN,
        ID_UPDATE: updateId,
        NAMA_FILE: storedName,
        MIME_TYPE: String(evidenceUpload.mimeType),
        UKURAN_BYTES: fileBuf.length,
        JENIS_BUKTI: jenisBukti,
        DRIVE_FOLDER_SUB: subFolder,
        DRIVE_FILE_ID: `DRV-${Date.now()}`,
        DRIVE_URL: `/api/evidence/${idBukti}`,
        TANGGAL_UPLOAD: now,
        DIUNGGAH_OLEH: req.sessionUser!.namaLengkap,
        VISIBILITAS: visibilitas,
      };
      db.BUKTI_DOKUMEN.push(createdEvidence);
    }

    if (report.ID_USER_PELAPOR) {
      db.NOTIFIKASI.unshift({
        ID_NOTIFIKASI: `NTF-UPD-${Date.now()}`,
        TARGET_USER_ID: report.ID_USER_PELAPOR,
        TARGET_ROLE: 'WARGA',
        ID_LAPORAN: report.ID_LAPORAN,
        JUDUL: `Status ${report.ID_LAPORAN}: ${nextStatus}`,
        PESAN: String(keterangan).trim(),
        DIBACA: false,
        CREATED_AT: now,
      });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'SAVE_FOLLOWUP',
      report.ID_LAPORAN,
      `Memperbarui status menjadi "${nextStatus}"${createdEvidence ? ` + unggah bukti ${createdEvidence.NAMA_FILE}` : ''}.`
    );
    saveDatabase(db);
    return res.json({ report, followUpId: updateId, evidence: createdEvidence });
  });

  app.post('/api/admin/reports/:id/evidence', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const report = db.LAPORAN.find((r) => r.ID_LAPORAN === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }
    const { fileName, mimeType, base64, jenisBukti, visibilitas, idUpdate, keterangan } = req.body || {};
    if (typeof base64 !== 'string' || !base64) {
      return res.status(400).json({ error: 'File bukti wajib dipilih.' });
    }
    const buf = parseBase64Upload(base64);
    const maxFileMb = Number(getSettingValue(db, 'MAX_FILE_MB', '5')) || 5;
    const check = validateEvidenceFile(String(fileName || ''), String(mimeType || ''), buf.length, maxFileMb);
    if (!check.valid) {
      return res.status(400).json({ error: check.error });
    }

    const now = new Date().toISOString();
    const jenis = (jenisBukti || 'Dokumen pendukung lainnya') as EvidenceType;
    const vis: EvidenceVisibility = visibilitas === 'INTERNAL_DESA' ? 'INTERNAL_DESA' : 'PUBLIK_WARGA';

    let subFolder = ensureTicketFolder(report.ID_LAPORAN).subPath;
    if (jenis === 'Surat usulan ke dinas' || jenis === 'Surat balasan dinas') {
      subFolder = '04_SURAT_KE_DINAS';
    } else if (jenis === 'Tanda terima' || jenis === 'Bukti pengiriman surat') {
      subFolder = '05_DOKUMEN_PENDUKUNG';
    }
    const targetDir = path.join(DRIVE_ROOT_DIR, subFolder);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const cleanName = String(fileName).replace(/[^A-Za-z0-9._-]/g, '_');
    const storedName = `${report.ID_LAPORAN}_${Date.now()}_${cleanName}`;
    fs.writeFileSync(path.join(targetDir, storedName), buf);

    const linkedUpdateId =
      typeof idUpdate === 'string' && idUpdate
        ? idUpdate
        : db.TINDAK_LANJUT.filter((f) => f.ID_LAPORAN === report.ID_LAPORAN).slice(-1)[0]?.ID_UPDATE || 'UPD-DIRECT';

    const idBukti = `BKT-${Date.now()}`;
    const doc: SheetBuktiDokumen = {
      ID_BUKTI: idBukti,
      ID_LAPORAN: report.ID_LAPORAN,
      ID_UPDATE: linkedUpdateId,
      NAMA_FILE: storedName,
      MIME_TYPE: String(mimeType),
      UKURAN_BYTES: buf.length,
      JENIS_BUKTI: jenis,
      DRIVE_FOLDER_SUB: subFolder,
      DRIVE_FILE_ID: `DRV-${Date.now()}`,
      DRIVE_URL: `/api/evidence/${idBukti}`,
      TANGGAL_UPLOAD: now,
      DIUNGGAH_OLEH: req.sessionUser!.namaLengkap,
      VISIBILITAS: vis,
    };
    db.BUKTI_DOKUMEN.push(doc);

    if (typeof keterangan === 'string' && keterangan.trim().length >= 5) {
      db.TINDAK_LANJUT.push({
        ID_UPDATE: `UPD-${Date.now()}`,
        ID_LAPORAN: report.ID_LAPORAN,
        TANGGAL_UPDATE: now.slice(0, 10),
        STATUS: report.STATUS_TERBARU,
        KETERANGAN: `${keterangan.trim()} (Lampiran: ${jenis})`,
        DINAS_TUJUAN: '',
        NOMOR_SURAT: '',
        PETUGAS: req.sessionUser!.namaLengkap,
        CREATED_AT: now,
      });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'UPLOAD_EVIDENCE',
      report.ID_LAPORAN,
      `Mengunggah bukti ${storedName} (${jenis}, ${vis}) ke ${subFolder}.`
    );
    saveDatabase(db);
    return res.status(201).json({ evidence: doc });
  });

  app.post('/api/admin/reports/:id/classify', requireAuth(['OPERATOR', 'SUPER_ADMIN', 'KEPALA_DESA']), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const report = db.LAPORAN.find((r) => r.ID_LAPORAN === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
    }
    const { idLayanan, idPetugas } = req.body || {};
    const service = db.KATEGORI_LAYANAN.find((s) => s.ID_LAYANAN === idLayanan);
    if (!service) {
      return res.status(400).json({ error: 'Jenis layanan tujuan tidak valid.' });
    }
    const officer = idPetugas ? db.PETUGAS.find((p) => p.ID_PETUGAS === idPetugas) : undefined;
    const now = new Date().toISOString();

    report.KODE_GRUP = service.KATEGORI_GRUP;
    report.ID_LAYANAN = service.ID_LAYANAN;
    report.NAMA_LAYANAN = service.NAMA_LAYANAN;
    report.MASALAH_UTAMA = service.NAMA_LAYANAN;
    report.ID_PETUGAS_TUGAS = officer?.ID_PETUGAS || service.ID_PETUGAS_PJ;
    report.NAMA_PETUGAS_TUGAS = officer?.NAMA_PETUGAS || service.NAMA_PETUGAS_PJ;
    report.UPDATED_AT = now;
    if (report.STATUS_TERBARU === 'Laporan diterima') {
      report.STATUS_TERBARU = 'Sedang ditindaklanjuti';
    }

    db.TINDAK_LANJUT.push({
      ID_UPDATE: `UPD-${Date.now()}`,
      ID_LAPORAN: report.ID_LAPORAN,
      TANGGAL_UPDATE: now.slice(0, 10),
      STATUS: report.STATUS_TERBARU,
      KETERANGAN: `Laporan diklasifikasikan ke layanan "${service.NAMA_LAYANAN}" (${service.KATEGORI_GRUP}) dan ditugaskan kepada ${report.NAMA_PETUGAS_TUGAS}.`,
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: req.sessionUser!.namaLengkap,
      CREATED_AT: now,
    });

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'CLASSIFY_REPORT',
      report.ID_LAPORAN,
      `Klasifikasi laporan ke ${service.NAMA_LAYANAN}, PJ: ${report.NAMA_PETUGAS_TUGAS}.`
    );
    saveDatabase(db);
    return res.json({ report });
  });

  // ===========================================================================
  // 6. SERVICE BUILDER (DYNAMIC SERVICES & FORM FIELDS)
  // ===========================================================================
  app.get('/api/admin/services', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    const list = db.KATEGORI_LAYANAN.map((s) => ({
      ...s,
      fields: db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN === s.ID_LAYANAN).sort(
        (a, b) => a.URUTAN - b.URUTAN
      ),
    }));
    return res.json({ services: list });
  });

  app.post('/api/admin/services', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const {
      namaLayanan,
      kategoriGrup,
      deskripsi,
      ikon,
      persyaratanDokumen,
      idPetugasPj,
      alurStatus,
      statusAktif,
      fields,
    } = req.body || {};

    if (typeof namaLayanan !== 'string' || namaLayanan.trim().length < 3) {
      return res.status(400).json({ error: 'Nama layanan wajib diisi (min. 3 karakter).' });
    }
    if (!SERVICE_GROUPS.includes(kategoriGrup)) {
      return res.status(400).json({ error: 'Kategori grup layanan tidak valid.' });
    }

    const db = loadDatabase();
    const officer = db.PETUGAS.find((p) => p.ID_PETUGAS === idPetugasPj);
    const idLayanan = `LAY-${Date.now()}`;
    const now = new Date().toISOString();

    const newService: SheetKategoriLayanan = {
      ID_LAYANAN: idLayanan,
      KODE_LAYANAN: `SRV-${Math.floor(100 + Math.random() * 900)}`,
      NAMA_LAYANAN: namaLayanan.trim(),
      KATEGORI_GRUP: kategoriGrup,
      DESKRIPSI: typeof deskripsi === 'string' ? deskripsi.trim() : '',
      IKON: typeof ikon === 'string' && ikon ? ikon : 'file-text',
      PERSYARATAN_DOKUMEN: typeof persyaratanDokumen === 'string' ? persyaratanDokumen.trim() : 'Opsional',
      ID_PETUGAS_PJ: officer?.ID_PETUGAS || 'PTG-001',
      NAMA_PETUGAS_PJ: officer?.NAMA_PETUGAS || 'Hendra Wijaya',
      ALUR_STATUS: Array.isArray(alurStatus) && alurStatus.length > 0 ? alurStatus : [...REPORT_STATUSES],
      STATUS_AKTIF: statusAktif !== false,
      URUTAN: db.KATEGORI_LAYANAN.length + 1,
      CREATED_AT: now,
    };

    db.KATEGORI_LAYANAN.push(newService);

    if (Array.isArray(fields)) {
      fields.forEach((f, idx) => {
        if (!f || typeof f.LABEL_PERTANYAAN !== 'string' || !f.LABEL_PERTANYAAN.trim()) return;
        const tipe = FORM_FIELD_TYPES.includes(f.TIPE_ISIAN) ? f.TIPE_ISIAN : 'text';
        db.KONFIGURASI_FORM.push({
          ID_FIELD: `FLD-${Date.now()}-${idx}`,
          ID_LAYANAN: idLayanan,
          LABEL_PERTANYAAN: f.LABEL_PERTANYAAN.trim(),
          TIPE_ISIAN: tipe,
          OPSI_PILIHAN: Array.isArray(f.OPSI_PILIHAN) ? f.OPSI_PILIHAN.filter(Boolean) : [],
          WAJIB: Boolean(f.WAJIB),
          PLACEHOLDER: typeof f.PLACEHOLDER === 'string' ? f.PLACEHOLDER : '',
          URUTAN: idx + 1,
        });
      });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'CREATE_SERVICE',
      idLayanan,
      `Menambahkan jenis layanan baru "${newService.NAMA_LAYANAN}" (${newService.KATEGORI_GRUP}).`
    );
    saveDatabase(db);
    return res.status(201).json({
      service: {
        ...newService,
        fields: db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN === idLayanan),
      },
    });
  });

  app.put('/api/admin/services/:id', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const svc = db.KATEGORI_LAYANAN.find((s) => s.ID_LAYANAN === req.params.id);
    if (!svc) {
      return res.status(404).json({ error: 'Layanan tidak ditemukan.' });
    }
    const body = req.body || {};
    if (typeof body.namaLayanan === 'string' && body.namaLayanan.trim()) svc.NAMA_LAYANAN = body.namaLayanan.trim();
    if (SERVICE_GROUPS.includes(body.kategoriGrup)) svc.KATEGORI_GRUP = body.kategoriGrup;
    if (typeof body.deskripsi === 'string') svc.DESKRIPSI = body.deskripsi.trim();
    if (typeof body.ikon === 'string') svc.IKON = body.ikon;
    if (typeof body.persyaratanDokumen === 'string') svc.PERSYARATAN_DOKUMEN = body.persyaratanDokumen.trim();
    if (typeof body.statusAktif === 'boolean') svc.STATUS_AKTIF = body.statusAktif;
    if (typeof body.idPetugasPj === 'string') {
      const officer = db.PETUGAS.find((p) => p.ID_PETUGAS === body.idPetugasPj);
      if (officer) {
        svc.ID_PETUGAS_PJ = officer.ID_PETUGAS;
        svc.NAMA_PETUGAS_PJ = officer.NAMA_PETUGAS;
      }
    }
    if (Array.isArray(body.fields)) {
      db.KONFIGURASI_FORM = db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN !== svc.ID_LAYANAN);
      body.fields.forEach((f: Partial<SheetKonfigurasiForm>, idx: number) => {
        if (!f || typeof f.LABEL_PERTANYAAN !== 'string' || !f.LABEL_PERTANYAAN.trim()) return;
        const tipe = f.TIPE_ISIAN && FORM_FIELD_TYPES.includes(f.TIPE_ISIAN) ? f.TIPE_ISIAN : 'text';
        db.KONFIGURASI_FORM.push({
          ID_FIELD: f.ID_FIELD || `FLD-${Date.now()}-${idx}`,
          ID_LAYANAN: svc.ID_LAYANAN,
          LABEL_PERTANYAAN: f.LABEL_PERTANYAAN.trim(),
          TIPE_ISIAN: tipe,
          OPSI_PILIHAN: Array.isArray(f.OPSI_PILIHAN) ? f.OPSI_PILIHAN.filter(Boolean) : [],
          WAJIB: Boolean(f.WAJIB),
          PLACEHOLDER: typeof f.PLACEHOLDER === 'string' ? f.PLACEHOLDER : '',
          URUTAN: idx + 1,
        });
      });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'UPDATE_SERVICE',
      svc.ID_LAYANAN,
      `Memperbarui layanan "${svc.NAMA_LAYANAN}" (aktif: ${svc.STATUS_AKTIF}).`
    );
    saveDatabase(db);
    return res.json({
      service: {
        ...svc,
        fields: db.KONFIGURASI_FORM.filter((f) => f.ID_LAYANAN === svc.ID_LAYANAN),
      },
    });
  });

  // ===========================================================================
  // 7. WARGA, PETUGAS, DRIVE TREE, ANNOUNCEMENTS, SETTINGS, LOGS, EXPORT, GAS
  // ===========================================================================
  app.get('/api/admin/warga', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    return res.json({ warga: db.WARGA });
  });

  app.patch('/api/admin/warga/:id/verify', requireAuth(['OPERATOR', 'SUPER_ADMIN']), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const w = db.WARGA.find((item) => item.ID_WARGA === req.params.id);
    if (!w) return res.status(404).json({ error: 'Data warga tidak ditemukan.' });
    const nextStatus = req.body?.status === 'DITOLAK' ? 'DITOLAK' : 'TERVERIFIKASI';
    w.STATUS_VERIFIKASI = nextStatus;
    if (w.ID_USER) {
      const u = db.USERS.find((usr) => usr.ID_USER === w.ID_USER);
      if (u) u.STATUS_AKUN = nextStatus === 'TERVERIFIKASI' ? 'AKTIF' : 'NONAKTIF';
    }
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'VERIFY_WARGA',
      w.ID_WARGA,
      `Status verifikasi warga ${w.NAMA_LENGKAP} diubah menjadi ${nextStatus}.`
    );
    saveDatabase(db);
    return res.json({ warga: w });
  });

  app.get('/api/admin/petugas', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    return res.json({ petugas: db.PETUGAS });
  });

  app.post('/api/admin/petugas', requireAuth(['SUPER_ADMIN']), (req: AuthedRequest, res) => {
    const { namaPetugas, jabatan, bidangTugas, noHp, username, password } = req.body || {};
    if (typeof namaPetugas !== 'string' || !namaPetugas.trim() || typeof jabatan !== 'string') {
      return res.status(400).json({ error: 'Nama petugas dan jabatan wajib diisi.' });
    }
    const db = loadDatabase();
    const now = new Date().toISOString();
    const idUser = `USR-PTG-${Date.now()}`;
    const idPetugas = `PTG-${Date.now()}`;
    const uname = (typeof username === 'string' && username.trim()) || `petugas${db.PETUGAS.length + 1}`;
    const cleanHp = normalizeIndonesianPhone(noHp as string | number | undefined) || String(noHp || '').trim();
    db.USERS.push({
      ID_USER: idUser,
      USERNAME: uname,
      NAMA_LENGKAP: namaPetugas.trim(),
      EMAIL: `${uname}@ampel.desa.id`,
      NO_HP: cleanHp,
      PASSWORD_HASH: hashPassword(typeof password === 'string' && password.length >= 6 ? password : 'PetugasAmpel2026!'),
      ROLE: 'PETUGAS',
      STATUS_AKUN: 'AKTIF',
      CREATED_AT: now,
    });
    const newOfficer = {
      ID_PETUGAS: idPetugas,
      ID_USER: idUser,
      NAMA_PETUGAS: namaPetugas.trim(),
      JABATAN: jabatan.trim(),
      BIDANG_TUGAS: String(bidangTugas || 'Pelayanan Warga'),
      NO_HP: cleanHp,
      STATUS: 'AKTIF' as const,
      CREATED_AT: now,
    };
    db.PETUGAS.push(newOfficer);
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'ADD_PETUGAS',
      idPetugas,
      `Menambahkan petugas ${newOfficer.NAMA_PETUGAS} (${newOfficer.JABATAN}).`
    );
    saveDatabase(db);
    return res.status(201).json({ petugas: newOfficer });
  });

  app.post('/api/admin/petugas/import', requireAuth(['SUPER_ADMIN']), (req: AuthedRequest, res) => {
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar data petugas untuk diimpor kosong.' });
    }
    const db = loadDatabase();
    const now = new Date().toISOString();
    const baseTs = Date.now();
    const createdIds: string[] = [];

    items.forEach((raw: Record<string, unknown>, idx: number) => {
      const namaPetugas = String(raw?.namaPetugas || '').trim();
      const jabatan = String(raw?.jabatan || '').trim();
      if (namaPetugas.length < 2 || jabatan.length < 2) return;
      const bidangTugas = String(raw?.bidangTugas || 'Pelayanan Warga').trim();
      const noHp = normalizeIndonesianPhone(raw?.noHp as string | number | undefined) || String(raw?.noHp || '').trim();
      const idUser = `USR-PTG-${baseTs}-${idx}`;
      const idPetugas = `PTG-${baseTs}-${idx}`;
      const uname = `petugas${db.PETUGAS.length + 1}_${idx}`;
      db.USERS.push({
        ID_USER: idUser,
        USERNAME: uname,
        NAMA_LENGKAP: namaPetugas,
        EMAIL: `${uname}@ampel.desa.id`,
        NO_HP: noHp,
        PASSWORD_HASH: hashPassword('PetugasAmpel2026!'),
        ROLE: 'PETUGAS',
        STATUS_AKUN: 'AKTIF',
        CREATED_AT: now,
      });
      db.PETUGAS.push({
        ID_PETUGAS: idPetugas,
        ID_USER: idUser,
        NAMA_PETUGAS: namaPetugas,
        JABATAN: jabatan,
        BIDANG_TUGAS: bidangTugas,
        NO_HP: noHp,
        STATUS: 'AKTIF',
        CREATED_AT: now,
      });
      createdIds.push(idPetugas);
    });

    if (createdIds.length === 0) {
      return res.status(400).json({ error: 'Tidak ada baris petugas valid yang dapat diimpor.' });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'IMPORT_PETUGAS',
      createdIds[0],
      `Mengimpor ${createdIds.length} data petugas dari Excel.`
    );
    saveDatabase(db);
    return res.status(201).json({ ok: true, count: createdIds.length, ids: createdIds });
  });

  app.get('/api/admin/drive-tree', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    ensureDriveStructure();
    const ticketFolders = db.LAPORAN.map((r) => r.ID_LAPORAN);
    return res.json({
      rootFolder: 'SIWARGA_DESA',
      subfolders: DRIVE_SUBFOLDERS,
      ticketFolders,
      evidence: db.BUKTI_DOKUMEN,
    });
  });

  app.patch('/api/admin/evidence/:id/drive-link', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const { driveFileId, driveWebViewLink } = req.body || {};
    if (typeof driveFileId !== 'string' || !driveFileId.trim()) {
      return res.status(400).json({ error: 'ID file Google Drive wajib diisi.' });
    }
    const db = loadDatabase();
    const doc = db.BUKTI_DOKUMEN.find((b) => b.ID_BUKTI === req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Dokumen bukti tidak ditemukan.' });
    }
    doc.DRIVE_FILE_ID = driveFileId.trim();
    if (typeof driveWebViewLink === 'string' && driveWebViewLink.trim()) {
      doc.DRIVE_URL = driveWebViewLink.trim();
    }
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'SYNC_EVIDENCE_DRIVE',
      doc.ID_LAPORAN,
      `Menyinkronkan bukti ${doc.NAMA_FILE} ke Google Drive (ID: ${doc.DRIVE_FILE_ID}).`
    );
    saveDatabase(db);
    return res.json({ evidence: doc });
  });

  app.get('/api/admin/backup-json', requireAuth(['SUPER_ADMIN', 'OPERATOR', 'KEPALA_DESA']), (_req, res) => {
    const db = loadDatabase();
    return res.json(db);
  });

  app.get('/api/admin/announcements', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    return res.json({ announcements: db.PENGUMUMAN });
  });

  app.post('/api/admin/announcements', requireAuth(['SUPER_ADMIN', 'OPERATOR', 'KEPALA_DESA']), (req: AuthedRequest, res) => {
    const { judul, ringkasan, isi, kategori } = req.body || {};
    if (typeof judul !== 'string' || judul.trim().length < 5 || typeof isi !== 'string' || isi.trim().length < 10) {
      return res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
    }
    const db = loadDatabase();
    const item = {
      ID_PENGUMUMAN: `PGM-${Date.now()}`,
      JUDUL: judul.trim(),
      RINGKASAN: typeof ringkasan === 'string' && ringkasan.trim() ? ringkasan.trim() : isi.trim().slice(0, 120),
      ISI: isi.trim(),
      KATEGORI: (kategori || 'Pelayanan') as 'Pelayanan' | 'Pembangunan' | 'Bantuan' | 'Jadwal Desa',
      TANGGAL_TERBIT: new Date().toISOString().slice(0, 10),
      PENULIS: req.sessionUser!.namaLengkap,
      AKTIF: true,
    };
    db.PENGUMUMAN.unshift(item);
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'CREATE_ANNOUNCEMENT',
      item.ID_PENGUMUMAN,
      `Menerbitkan pengumuman "${item.JUDUL}".`
    );
    saveDatabase(db);
    return res.status(201).json({ announcement: item });
  });

  app.delete('/api/admin/announcements/:id', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    db.PENGUMUMAN = db.PENGUMUMAN.filter((p) => p.ID_PENGUMUMAN !== req.params.id);
    saveDatabase(db);
    return res.json({ ok: true });
  });

  app.get('/api/admin/settings', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    return res.json({ settings: db.PENGATURAN });
  });

  app.put('/api/admin/settings', requireAuth(['SUPER_ADMIN']), (req: AuthedRequest, res) => {
    const updates = req.body?.settings;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Format pengaturan tidak valid.' });
    }
    const db = loadDatabase();
    for (const item of updates) {
      if (item && typeof item.KUNCI === 'string' && typeof item.NILAI === 'string') {
        if (item.KUNCI === 'TICKET_COUNTER') continue; // Protect sequential lock counter
        setSettingValue(db, item.KUNCI, item.NILAI);
      }
    }
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'UPDATE_SETTINGS',
      'PENGATURAN',
      'Memperbarui konfigurasi sistem WARGA AMPEL.'
    );
    saveDatabase(db);
    return res.json({ settings: db.PENGATURAN });
  });

  app.post('/api/admin/test-gas', requireAuth(['SUPER_ADMIN']), async (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!url.startsWith('https://script.google.com/')) {
      return res.status(400).json({ error: 'URL Web App Google Apps Script harus diawali https://script.google.com/...' });
    }
    try {
      const response = await fetch(`${url}?action=ping`);
      const text = await response.text();
      return res.json({ ok: response.ok, status: response.status, preview: text.slice(0, 300) });
    } catch (err) {
      return res.status(502).json({ error: `Gagal menghubungi endpoint GAS: ${(err as Error).message}` });
    }
  });

  app.get('/api/admin/logs', requireAuth(['SUPER_ADMIN', 'KEPALA_DESA', 'OPERATOR']), (_req, res) => {
    const db = loadDatabase();
    return res.json({ logs: db.LOG_AKTIVITAS.slice(0, 200) });
  });

  app.get('/api/admin/export', requireAuth(STAFF_ROLES), (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const csv = buildCsvExport(db.LAPORAN, db.TINDAK_LANJUT);
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'EXPORT_CSV',
      'LAPORAN',
      `Mengekspor ${db.LAPORAN.length} laporan ke CSV.`
    );
    saveDatabase(db);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="LAPORAN_WARGA_AMPEL.csv"');
    return res.send(csv);
  });

  app.get('/api/gas-bundle', requireAuth(STAFF_ROLES), (_req, res) => {
    const gasDir = path.resolve(process.cwd(), 'gas');
    const files = ['Code.gs', 'SetupDatabase.gs', 'SetupDrive.gs', 'Frontend.html', 'DEPLOYMENT_GUIDE.md'];
    const bundle: Record<string, string> = {};
    for (const fname of files) {
      const fp = path.join(gasDir, fname);
      bundle[fname] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : '';
    }
    return res.json({ bundle });
  });

  // ===========================================================================
  // 8. PORTAL STRUKTUR ORGANISASI WARGA AMPEL (PUBLIC + ADMIN CRUD)
  // ===========================================================================
  app.get('/api/public/org-structure', (_req, res) => {
    const db = loadDatabase();
    return res.json(sanitizePublicOrgData(db));
  });

  app.get('/api/admin/org-structure', requireAuth(STAFF_ROLES), (_req, res) => {
    const db = loadDatabase();
    return res.json({
      kelurahan: [...db.ORG_KELURAHAN].sort((a, b) => a.URUTAN - b.URUTAN),
      tpPkk: [...(db.ORG_TP_PKK || [])].sort((a, b) => a.URUTAN - b.URUTAN),
      lpmk: [...db.ORG_LPMK].sort((a, b) => a.URUTAN - b.URUTAN),
      rw: [...db.ORG_RW].sort((a, b) => a.URUTAN - b.URUTAN),
      rt: [...db.ORG_RT].sort((a, b) => a.URUTAN - b.URUTAN),
      kader: [...db.ORG_KADER].sort((a, b) => a.URUTAN - b.URUTAN),
      sekolah: [...(db.ORG_SEKOLAH || [])].sort((a, b) => a.URUTAN - b.URUTAN),
      guru: [...(db.ORG_GURU || [])].sort((a, b) => a.URUTAN - b.URUTAN),
      balaiRw: [...(db.ORG_BALAI_RW || [])].sort((a, b) => a.URUTAN - b.URUTAN),
      displaySettings: extractOrgDisplaySettings(db.PENGATURAN),
      summary: computeAdminOrgSummary(db),
    });
  });

  const VALID_ORG_ENTITIES: OrgEntityType[] = [
    'kelurahan',
    'tp_pkk',
    'lpmk',
    'rw',
    'rt',
    'kader',
    'sekolah',
    'guru',
    'balai_rw',
  ];

  app.post('/api/admin/org/:entity', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const entity = req.params.entity as OrgEntityType;
    if (!VALID_ORG_ENTITIES.includes(entity)) {
      return res.status(400).json({ error: 'Jenis entitas struktur organisasi tidak valid.' });
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const db = loadDatabase();
    const validationError = validateOrgInput(entity, body, db);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const now = new Date().toISOString();
    const tampilkanHp = body.tampilkanHp === true; // Default: disembunyikan (false)
    const tampilkanPublik = body.tampilkanPublik !== false;
    const aktif = body.aktif !== false;
    const urutan = Number(body.urutan) || 99;
    const fotoUrl = String(body.fotoUrl || '').trim();
    const noHp = normalizeIndonesianPhone(body.noHp as string | number | undefined);
    let createdId = '';
    let labelNama = '';

    if (entity === 'kelurahan') {
      createdId = `KEL-${Date.now()}`;
      labelNama = String(body.nama).trim();
      const tingkatRaw = String(body.tingkat || 'STAF').toUpperCase();
      const tingkat = tingkatRaw === 'LURAH' || tingkatRaw === 'KASI' ? tingkatRaw : 'STAF';
      db.ORG_KELURAHAN.push({
        ID_KELURAHAN: createdId,
        NAMA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        TINGKAT: tingkat,
        WILAYAH_TUGAS: String(body.wilayahTugas || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'tp_pkk') {
      createdId = `PKK-${Date.now()}`;
      labelNama = String(body.nama).trim();
      const jabatan = String(body.jabatan).trim();
      db.ORG_TP_PKK = db.ORG_TP_PKK || [];
      db.ORG_TP_PKK.push({
        ID_PKK: createdId,
        NAMA: labelNama,
        JABATAN: jabatan,
        POKJA: inferTpPkkPokja(jabatan, String(body.pokja || '')),
        BIDANG: String(body.bidang || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'lpmk') {
      createdId = `LPMK-${Date.now()}`;
      labelNama = String(body.nama).trim();
      db.ORG_LPMK.push({
        ID_LPMK: createdId,
        NAMA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        BIDANG: String(body.bidang || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'rw') {
      createdId = `RW-${Date.now()}`;
      labelNama = String(body.namaKetua ?? body.nama).trim();
      db.ORG_RW.push({
        ID_RW: createdId,
        NOMOR_RW: String(body.nomorRw).trim(),
        NAMA_KETUA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        WILAYAH_TUGAS: String(body.wilayahTugas).trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'rt') {
      createdId = `RT-${Date.now()}`;
      labelNama = String(body.namaKetua ?? body.nama).trim();
      db.ORG_RT.push({
        ID_RT: createdId,
        ID_RW: String(body.idRw).trim(),
        NOMOR_RT: String(body.nomorRt).trim(),
        NAMA_KETUA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        WILAYAH_TUGAS: String(body.wilayahTugas || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'kader') {
      createdId = `KDR-${Date.now()}`;
      labelNama = String(body.nama).trim();
      db.ORG_KADER.push({
        ID_KADER: createdId,
        ID_RT: String(body.idRt).trim(),
        NAMA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'sekolah') {
      createdId = `SKL-${Date.now()}`;
      labelNama = String(body.namaSekolah ?? body.nama).trim();
      db.ORG_SEKOLAH = db.ORG_SEKOLAH || [];
      db.ORG_SEKOLAH.push({
        ID_SEKOLAH: createdId,
        NAMA_SEKOLAH: labelNama,
        JENJANG: String(body.jenjang || 'SD / MI').trim() as typeof db.ORG_SEKOLAH[number]['JENJANG'],
        KEPALA_SEKOLAH: String(body.kepalaSekolah || '').trim(),
        ALAMAT: String(body.alamat).trim(),
        MAPS_URL: String(body.mapsUrl || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'guru') {
      createdId = `GRU-${Date.now()}`;
      labelNama = String(body.nama).trim();
      db.ORG_GURU = db.ORG_GURU || [];
      db.ORG_GURU.push({
        ID_GURU: createdId,
        ID_SEKOLAH: String(body.idSekolah).trim(),
        NAMA: labelNama,
        JABATAN: String(body.jabatan).trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    } else if (entity === 'balai_rw') {
      createdId = `BLI-${Date.now()}`;
      labelNama = String(body.namaBalai ?? body.nama).trim();
      db.ORG_BALAI_RW = db.ORG_BALAI_RW || [];
      db.ORG_BALAI_RW.push({
        ID_BALAI: createdId,
        ID_RW: String(body.idRw).trim(),
        NAMA_BALAI: labelNama,
        ALAMAT: String(body.alamat).trim(),
        JAM_LAYANAN: String(body.jamLayanan || '').trim(),
        MAPS_URL: String(body.mapsUrl || '').trim(),
        FOTO_URL: fotoUrl,
        NO_HP: noHp,
        TAMPILKAN_HP: tampilkanHp,
        TAMPILKAN_PUBLIK: tampilkanPublik,
        AKTIF: aktif,
        URUTAN: urutan,
        CREATED_AT: now,
        UPDATED_AT: now,
      });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      `ORG_CREATE_${entity.toUpperCase()}`,
      createdId,
      `Menambahkan data ${entity.toUpperCase()}: ${labelNama}.`
    );
    saveDatabase(db);
    return res.status(201).json({ ok: true, id: createdId });
  });

  app.post('/api/admin/org/:entity/import', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const entity = req.params.entity as OrgEntityType;
    if (!VALID_ORG_ENTITIES.includes(entity)) {
      return res.status(400).json({ error: 'Jenis entitas struktur organisasi tidak valid.' });
    }
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Daftar data Excel untuk diimpor kosong.' });
    }

    const db = loadDatabase();
    for (let i = 0; i < items.length; i++) {
      const body = (items[i] || {}) as Record<string, unknown>;
      const validationError = validateOrgInput(entity, body, db);
      if (validationError) {
        return res.status(400).json({ error: `Baris ke-${i + 1}: ${validationError}` });
      }
    }

    const now = new Date().toISOString();
    const baseTs = Date.now();
    const createdIds: string[] = [];

    items.forEach((raw: Record<string, unknown>, idx: number) => {
      const body = raw || {};
      const tampilkanHp = body.tampilkanHp === true;
      const tampilkanPublik = body.tampilkanPublik !== false;
      const aktif = body.aktif !== false;
      const urutan = Number(body.urutan) || idx + 1;
      const fotoUrl = String(body.fotoUrl || '').trim();
      const noHp = normalizeIndonesianPhone(body.noHp as string | number | undefined);

      if (entity === 'kelurahan') {
        const id = `KEL-${baseTs}-${idx}`;
        const tingkatRaw = String(body.tingkat || 'STAF').toUpperCase();
        const tingkat = tingkatRaw === 'LURAH' || tingkatRaw === 'KASI' ? tingkatRaw : 'STAF';
        db.ORG_KELURAHAN.push({
          ID_KELURAHAN: id,
          NAMA: String(body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          TINGKAT: tingkat,
          WILAYAH_TUGAS: String(body.wilayahTugas || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'tp_pkk') {
        const id = `PKK-${baseTs}-${idx}`;
        const jabatan = String(body.jabatan).trim();
        db.ORG_TP_PKK = db.ORG_TP_PKK || [];
        db.ORG_TP_PKK.push({
          ID_PKK: id,
          NAMA: String(body.nama).trim(),
          JABATAN: jabatan,
          POKJA: inferTpPkkPokja(jabatan, String(body.pokja || '')),
          BIDANG: String(body.bidang || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'lpmk') {
        const id = `LPMK-${baseTs}-${idx}`;
        db.ORG_LPMK.push({
          ID_LPMK: id,
          NAMA: String(body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          BIDANG: String(body.bidang || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'rw') {
        const id = `RW-${baseTs}-${idx}`;
        db.ORG_RW.push({
          ID_RW: id,
          NOMOR_RW: String(body.nomorRw).trim(),
          NAMA_KETUA: String(body.namaKetua ?? body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          WILAYAH_TUGAS: String(body.wilayahTugas).trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'rt') {
        const id = `RT-${baseTs}-${idx}`;
        db.ORG_RT.push({
          ID_RT: id,
          ID_RW: String(body.idRw).trim(),
          NOMOR_RT: String(body.nomorRt).trim(),
          NAMA_KETUA: String(body.namaKetua ?? body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          WILAYAH_TUGAS: String(body.wilayahTugas || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'kader') {
        const id = `KDR-${baseTs}-${idx}`;
        db.ORG_KADER.push({
          ID_KADER: id,
          ID_RT: String(body.idRt).trim(),
          NAMA: String(body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'sekolah') {
        const id = `SKL-${baseTs}-${idx}`;
        db.ORG_SEKOLAH = db.ORG_SEKOLAH || [];
        db.ORG_SEKOLAH.push({
          ID_SEKOLAH: id,
          NAMA_SEKOLAH: String(body.namaSekolah ?? body.nama).trim(),
          JENJANG: String(body.jenjang || 'SD / MI').trim() as typeof db.ORG_SEKOLAH[number]['JENJANG'],
          KEPALA_SEKOLAH: String(body.kepalaSekolah || '').trim(),
          ALAMAT: String(body.alamat).trim(),
          MAPS_URL: String(body.mapsUrl || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'guru') {
        const id = `GRU-${baseTs}-${idx}`;
        db.ORG_GURU = db.ORG_GURU || [];
        db.ORG_GURU.push({
          ID_GURU: id,
          ID_SEKOLAH: String(body.idSekolah).trim(),
          NAMA: String(body.nama).trim(),
          JABATAN: String(body.jabatan).trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      } else if (entity === 'balai_rw') {
        const id = `BLI-${baseTs}-${idx}`;
        db.ORG_BALAI_RW = db.ORG_BALAI_RW || [];
        db.ORG_BALAI_RW.push({
          ID_BALAI: id,
          ID_RW: String(body.idRw).trim(),
          NAMA_BALAI: String(body.namaBalai ?? body.nama).trim(),
          ALAMAT: String(body.alamat).trim(),
          JAM_LAYANAN: String(body.jamLayanan || '').trim(),
          MAPS_URL: String(body.mapsUrl || '').trim(),
          FOTO_URL: fotoUrl,
          NO_HP: noHp,
          TAMPILKAN_HP: tampilkanHp,
          TAMPILKAN_PUBLIK: tampilkanPublik,
          AKTIF: aktif,
          URUTAN: urutan,
          CREATED_AT: now,
          UPDATED_AT: now,
        });
        createdIds.push(id);
      }
    });

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      `ORG_IMPORT_${entity.toUpperCase()}`,
      createdIds[0] || entity.toUpperCase(),
      `Mengimpor ${createdIds.length} data ${entity.toUpperCase()} dari file Excel.`
    );
    saveDatabase(db);
    return res.status(201).json({ ok: true, count: createdIds.length, ids: createdIds });
  });

  app.put('/api/admin/org/:entity/:id', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const entity = req.params.entity as OrgEntityType;
    const id = req.params.id;
    if (!VALID_ORG_ENTITIES.includes(entity)) {
      return res.status(400).json({ error: 'Jenis entitas struktur organisasi tidak valid.' });
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const db = loadDatabase();
    const validationError = validateOrgInput(entity, body, db);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const now = new Date().toISOString();
    let labelNama = '';

    if (entity === 'kelurahan') {
      const target = db.ORG_KELURAHAN.find((item) => item.ID_KELURAHAN === id);
      if (!target) return res.status(404).json({ error: 'Data kelurahan tidak ditemukan.' });
      const tingkatRaw = String(body.tingkat || target.TINGKAT).toUpperCase();
      target.NAMA = String(body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.TINGKAT = tingkatRaw === 'LURAH' || tingkatRaw === 'KASI' ? tingkatRaw : 'STAF';
      target.WILAYAH_TUGAS = String(body.wilayahTugas || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA;
    } else if (entity === 'tp_pkk') {
      const target = (db.ORG_TP_PKK || []).find((item) => item.ID_PKK === id);
      if (!target) return res.status(404).json({ error: 'Data TP PKK tidak ditemukan.' });
      const jabatan = String(body.jabatan).trim();
      target.NAMA = String(body.nama).trim();
      target.JABATAN = jabatan;
      target.POKJA = inferTpPkkPokja(jabatan, String(body.pokja || ''));
      target.BIDANG = String(body.bidang || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA;
    } else if (entity === 'lpmk') {
      const target = db.ORG_LPMK.find((item) => item.ID_LPMK === id);
      if (!target) return res.status(404).json({ error: 'Data LPMK tidak ditemukan.' });
      target.NAMA = String(body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.BIDANG = String(body.bidang || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA;
    } else if (entity === 'rw') {
      const target = db.ORG_RW.find((item) => item.ID_RW === id);
      if (!target) return res.status(404).json({ error: 'Data RW tidak ditemukan.' });
      target.NOMOR_RW = String(body.nomorRw).trim();
      target.NAMA_KETUA = String(body.namaKetua ?? body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.WILAYAH_TUGAS = String(body.wilayahTugas).trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA_KETUA;
    } else if (entity === 'rt') {
      const target = db.ORG_RT.find((item) => item.ID_RT === id);
      if (!target) return res.status(404).json({ error: 'Data RT tidak ditemukan.' });
      target.ID_RW = String(body.idRw).trim();
      target.NOMOR_RT = String(body.nomorRt).trim();
      target.NAMA_KETUA = String(body.namaKetua ?? body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.WILAYAH_TUGAS = String(body.wilayahTugas || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA_KETUA;
    } else if (entity === 'kader') {
      const target = db.ORG_KADER.find((item) => item.ID_KADER === id);
      if (!target) return res.status(404).json({ error: 'Data Kader tidak ditemukan.' });
      target.ID_RT = String(body.idRt).trim();
      target.NAMA = String(body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA;
    } else if (entity === 'sekolah') {
      const target = (db.ORG_SEKOLAH || []).find((item) => item.ID_SEKOLAH === id);
      if (!target) return res.status(404).json({ error: 'Data Sekolah tidak ditemukan.' });
      target.NAMA_SEKOLAH = String(body.namaSekolah ?? body.nama).trim();
      target.JENJANG = String(body.jenjang || target.JENJANG).trim() as typeof target.JENJANG;
      target.KEPALA_SEKOLAH = String(body.kepalaSekolah || '').trim();
      target.ALAMAT = String(body.alamat).trim();
      target.MAPS_URL = String(body.mapsUrl || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA_SEKOLAH;
    } else if (entity === 'guru') {
      const target = (db.ORG_GURU || []).find((item) => item.ID_GURU === id);
      if (!target) return res.status(404).json({ error: 'Data Guru tidak ditemukan.' });
      target.ID_SEKOLAH = String(body.idSekolah).trim();
      target.NAMA = String(body.nama).trim();
      target.JABATAN = String(body.jabatan).trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA;
    } else if (entity === 'balai_rw') {
      const target = (db.ORG_BALAI_RW || []).find((item) => item.ID_BALAI === id);
      if (!target) return res.status(404).json({ error: 'Data Balai RW tidak ditemukan.' });
      target.ID_RW = String(body.idRw).trim();
      target.NAMA_BALAI = String(body.namaBalai ?? body.nama).trim();
      target.ALAMAT = String(body.alamat).trim();
      target.JAM_LAYANAN = String(body.jamLayanan || '').trim();
      target.MAPS_URL = String(body.mapsUrl || '').trim();
      target.FOTO_URL = String(body.fotoUrl || '').trim();
      target.NO_HP = normalizeIndonesianPhone(body.noHp as string | number | undefined);
      target.TAMPILKAN_HP = body.tampilkanHp === true;
      target.TAMPILKAN_PUBLIK = body.tampilkanPublik !== false;
      target.AKTIF = body.aktif !== false;
      target.URUTAN = Number(body.urutan) || target.URUTAN;
      target.UPDATED_AT = now;
      labelNama = target.NAMA_BALAI;
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      `ORG_UPDATE_${entity.toUpperCase()}`,
      id,
      `Memperbarui data ${entity.toUpperCase()}: ${labelNama}.`
    );
    saveDatabase(db);
    return res.json({ ok: true, id });
  });

  app.delete('/api/admin/org/:entity/:id', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const entity = req.params.entity as OrgEntityType;
    const id = req.params.id;
    const db = loadDatabase();
    let deletedLabel = '';

    if (entity === 'kelurahan') {
      const idx = db.ORG_KELURAHAN.findIndex((item) => item.ID_KELURAHAN === id);
      if (idx === -1) return res.status(404).json({ error: 'Data kelurahan tidak ditemukan.' });
      deletedLabel = db.ORG_KELURAHAN[idx].NAMA;
      db.ORG_KELURAHAN.splice(idx, 1);
    } else if (entity === 'tp_pkk') {
      db.ORG_TP_PKK = db.ORG_TP_PKK || [];
      const idx = db.ORG_TP_PKK.findIndex((item) => item.ID_PKK === id);
      if (idx === -1) return res.status(404).json({ error: 'Data TP PKK tidak ditemukan.' });
      deletedLabel = db.ORG_TP_PKK[idx].NAMA;
      db.ORG_TP_PKK.splice(idx, 1);
    } else if (entity === 'lpmk') {
      const idx = db.ORG_LPMK.findIndex((item) => item.ID_LPMK === id);
      if (idx === -1) return res.status(404).json({ error: 'Data LPMK tidak ditemukan.' });
      deletedLabel = db.ORG_LPMK[idx].NAMA;
      db.ORG_LPMK.splice(idx, 1);
    } else if (entity === 'rw') {
      if (db.ORG_RT.some((t) => t.ID_RW === id)) {
        return res.status(400).json({
          error: 'RW masih memiliki daftar RT. Pindahkan atau hapus RT di bawah RW ini terlebih dahulu.',
        });
      }
      if ((db.ORG_BALAI_RW || []).some((b) => b.ID_RW === id)) {
        return res.status(400).json({
          error: 'RW masih terhubung dengan data Balai RW. Hapus atau pindahkan Balai RW terlebih dahulu.',
        });
      }
      const idx = db.ORG_RW.findIndex((item) => item.ID_RW === id);
      if (idx === -1) return res.status(404).json({ error: 'Data RW tidak ditemukan.' });
      deletedLabel = `${db.ORG_RW[idx].NOMOR_RW} (${db.ORG_RW[idx].NAMA_KETUA})`;
      db.ORG_RW.splice(idx, 1);
    } else if (entity === 'rt') {
      if (db.ORG_KADER.some((k) => k.ID_RT === id)) {
        return res.status(400).json({
          error: 'RT masih memiliki Kader terdaftar. Pindahkan atau hapus kader di RT ini terlebih dahulu.',
        });
      }
      const idx = db.ORG_RT.findIndex((item) => item.ID_RT === id);
      if (idx === -1) return res.status(404).json({ error: 'Data RT tidak ditemukan.' });
      deletedLabel = `${db.ORG_RT[idx].NOMOR_RT} (${db.ORG_RT[idx].NAMA_KETUA})`;
      db.ORG_RT.splice(idx, 1);
    } else if (entity === 'kader') {
      const idx = db.ORG_KADER.findIndex((item) => item.ID_KADER === id);
      if (idx === -1) return res.status(404).json({ error: 'Data Kader tidak ditemukan.' });
      deletedLabel = db.ORG_KADER[idx].NAMA;
      db.ORG_KADER.splice(idx, 1);
    } else if (entity === 'sekolah') {
      if ((db.ORG_GURU || []).some((g) => g.ID_SEKOLAH === id)) {
        return res.status(400).json({
          error: 'Sekolah masih memiliki daftar Guru. Pindahkan atau hapus data guru di sekolah ini terlebih dahulu.',
        });
      }
      db.ORG_SEKOLAH = db.ORG_SEKOLAH || [];
      const idx = db.ORG_SEKOLAH.findIndex((item) => item.ID_SEKOLAH === id);
      if (idx === -1) return res.status(404).json({ error: 'Data Sekolah tidak ditemukan.' });
      deletedLabel = db.ORG_SEKOLAH[idx].NAMA_SEKOLAH;
      db.ORG_SEKOLAH.splice(idx, 1);
    } else if (entity === 'guru') {
      db.ORG_GURU = db.ORG_GURU || [];
      const idx = db.ORG_GURU.findIndex((item) => item.ID_GURU === id);
      if (idx === -1) return res.status(404).json({ error: 'Data Guru tidak ditemukan.' });
      deletedLabel = db.ORG_GURU[idx].NAMA;
      db.ORG_GURU.splice(idx, 1);
    } else if (entity === 'balai_rw') {
      db.ORG_BALAI_RW = db.ORG_BALAI_RW || [];
      const idx = db.ORG_BALAI_RW.findIndex((item) => item.ID_BALAI === id);
      if (idx === -1) return res.status(404).json({ error: 'Data Balai RW tidak ditemukan.' });
      deletedLabel = db.ORG_BALAI_RW[idx].NAMA_BALAI;
      db.ORG_BALAI_RW.splice(idx, 1);
    } else {
      return res.status(400).json({ error: 'Jenis entitas struktur organisasi tidak valid.' });
    }

    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      `ORG_DELETE_${entity.toUpperCase()}`,
      id,
      `Menghapus data ${entity.toUpperCase()}: ${deletedLabel}.`
    );
    saveDatabase(db);
    return res.json({ ok: true });
  });

  app.put('/api/admin/org-settings', requireAuth(['SUPER_ADMIN', 'OPERATOR']), (req: AuthedRequest, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const db = loadDatabase();
    if (typeof body.pengumumanBeranda === 'string') {
      setSettingValue(db, 'ORG_PENGUMUMAN', body.pengumumanBeranda.trim());
    }
    if (Array.isArray(body.urutanBagian)) {
      setSettingValue(db, 'ORG_URUTAN_BAGIAN', JSON.stringify(body.urutanBagian));
    }
    if (body.tampilkanBagian && typeof body.tampilkanBagian === 'object') {
      setSettingValue(db, 'ORG_TAMPILKAN_BAGIAN', JSON.stringify(body.tampilkanBagian));
    }
    appendActivityLog(
      db,
      { idUser: req.sessionUser!.idUser, nama: req.sessionUser!.namaLengkap, role: req.sessionUser!.role },
      'ORG_UPDATE_SETTINGS',
      'PENGATURAN',
      'Memperbarui pengaturan tampilan dan pengumuman Struktur Organisasi.'
    );
    saveDatabase(db);
    return res.json({ displaySettings: extractOrgDisplaySettings(db.PENGATURAN) });
  });

  // ===========================================================================
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // ===========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIWARGA Desa Ampel running at http://localhost:${PORT}`);
  });
}

startServer();
