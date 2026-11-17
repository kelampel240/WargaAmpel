import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCsvExport,
  computeDashboardStats,
  DINAS_PROPOSAL_MESSAGE,
  formatTicketNumber,
  maskKk,
  maskNik,
  sanitizeReportForCitizenTracking,
  validateDynamicFormFields,
  validateEvidenceFile,
  validateFollowUpUpdate,
  verifyCitizenTrackingAccess,
} from './siwargaLogic';
import {
  SheetBuktiDokumen,
  SheetKonfigurasiForm,
  SheetLaporan,
  SheetPetugas,
  SheetTindakLanjut,
  SheetWarga,
} from './types';

test('maskNik and maskKk protect middle digits', () => {
  assert.equal(maskNik('3309012405880004'), '330901******0004');
  assert.equal(maskKk('3309011201100009'), '330901******0009');
  assert.equal(maskNik('123'), '******');
});

test('formatTicketNumber produces SW-YYYY-000001 format', () => {
  assert.equal(formatTicketNumber(2026, 1), 'SW-2026-000001');
  assert.equal(formatTicketNumber(2026, 125), 'SW-2026-000125');
});

test('validateEvidenceFile rejects invalid format or oversized files', () => {
  assert.equal(validateEvidenceFile('foto.jpg', 'image/jpeg', 1024 * 1024, 5).valid, true);
  assert.equal(validateEvidenceFile('surat.pdf', 'application/pdf', 2 * 1024 * 1024, 5).valid, true);
  assert.equal(validateEvidenceFile('script.exe', 'application/octet-stream', 1000, 5).valid, false);
  assert.equal(validateEvidenceFile('huge.png', 'image/png', 6 * 1024 * 1024, 5).valid, false);
});

test('validateFollowUpUpdate enforces mandatory reason for Tidak dapat ditindaklanjuti and dinasTujuan for usulan dinas', () => {
  const shortReject = validateFollowUpUpdate({
    status: 'Tidak dapat ditindaklanjuti',
    keterangan: 'Ditolak',
  });
  assert.equal(shortReject.valid, false);

  const validReject = validateFollowUpUpdate({
    status: 'Tidak dapat ditindaklanjuti',
    keterangan: 'Lokasi berada di luar kewenangan wilayah administratif Desa Ampel.',
  });
  assert.equal(validReject.valid, true);

  const missingDinas = validateFollowUpUpdate({
    status: 'Sudah diusulkan ke dinas terkait',
    keterangan: 'Sudah dikirim surat resmi ke dinas.',
    dinasTujuan: '',
  });
  assert.equal(missingDinas.valid, false);

  const validDinas = validateFollowUpUpdate({
    status: 'Sudah diusulkan ke dinas terkait',
    keterangan: 'Surat usulan perbaikan jalan telah dikirimkan.',
    dinasTujuan: 'Dinas PUPR Kabupaten',
    nomorSurat: '140/088/DS-AMP/2026',
  });
  assert.equal(validDinas.valid, true);
});

test('validateDynamicFormFields catches missing required dynamic fields', () => {
  const fields: SheetKonfigurasiForm[] = [
    {
      ID_FIELD: 'F1',
      ID_LAYANAN: 'L1',
      LABEL_PERTANYAAN: 'Keperluan Surat',
      TIPE_ISIAN: 'text',
      OPSI_PILIHAN: [],
      WAJIB: true,
      PLACEHOLDER: '',
      URUTAN: 1,
    },
    {
      ID_FIELD: 'F2',
      ID_LAYANAN: 'L1',
      LABEL_PERTANYAAN: 'Catatan Tambahan',
      TIPE_ISIAN: 'textarea',
      OPSI_PILIHAN: [],
      WAJIB: false,
      PLACEHOLDER: '',
      URUTAN: 2,
    },
  ];
  const bad = validateDynamicFormFields(fields, { F1: '' });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.F1);

  const ok = validateDynamicFormFields(fields, { F1: 'Pengajuan KIP Kuliah' });
  assert.equal(ok.valid, true);
});

test('sanitizeReportForCitizenTracking hides reporter PII, hides INTERNAL_DESA evidence, and injects dinas message', () => {
  const report: SheetLaporan = {
    ID_LAPORAN: 'SW-2026-000010',
    NAMA_PELAPOR: 'Budi Santoso Rahasia',
    NO_HP_PELAPOR: '081234567890',
    TANGGAL_LAHIR_VERIFIKASI: '1978-05-12',
    NIK_MASKED_PELAPOR: '330901******0004',
    KODE_GRUP: 'A. Pengaduan',
    ID_LAYANAN: 'LAY-01',
    NAMA_LAYANAN: 'Jalan rusak',
    JUDUL_LAPORAN: 'Jalan Berlubang Dusun Krajan',
    MASALAH_UTAMA: 'Jalan rusak',
    URAIAN_MASALAH: 'Aspal berlubang sepanjang 30 meter.',
    LOKASI_ALAMAT: 'Jl. Melati No. 14 RT 02 RW 01',
    RT_RW: 'RT 02 / RW 01',
    DATA_FORM_DINAMIS: {},
    STATUS_TERBARU: 'Sudah diusulkan ke dinas terkait',
    NAMA_PETUGAS_TUGAS: 'Hendra Wijaya',
    DRIVE_FOLDER_NAME: 'SW-2026-000010',
    DRIVE_FOLDER_URL: 'https://drive.local/SW-2026-000010',
    CREATED_AT: '2026-11-01T08:00:00.000Z',
    UPDATED_AT: '2026-11-05T10:00:00.000Z',
  };

  const followUps: SheetTindakLanjut[] = [
    {
      ID_UPDATE: 'UPD-1',
      ID_LAPORAN: 'SW-2026-000010',
      TANGGAL_UPDATE: '2026-11-01',
      STATUS: 'Laporan diterima',
      KETERANGAN: 'Laporan masuk dan diverifikasi.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Operator Desa',
      CREATED_AT: '2026-11-01T08:00:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-2',
      ID_LAPORAN: 'SW-2026-000010',
      TANGGAL_UPDATE: '2026-11-05',
      STATUS: 'Sudah diusulkan ke dinas terkait',
      KETERANGAN: 'Surat usulan dikirim ke PUPR.',
      DINAS_TUJUAN: 'Dinas PUPR Kabupaten',
      NOMOR_SURAT: '600/112/AMP/2026',
      PETUGAS: 'Hendra Wijaya',
      CREATED_AT: '2026-11-05T10:00:00.000Z',
    },
  ];

  const evidences: SheetBuktiDokumen[] = [
    {
      ID_BUKTI: 'BKT-PUB',
      ID_LAPORAN: 'SW-2026-000010',
      ID_UPDATE: 'UPD-1',
      NAMA_FILE: 'foto_jalan.jpg',
      MIME_TYPE: 'image/jpeg',
      UKURAN_BYTES: 120000,
      JENIS_BUKTI: 'Foto sebelum perbaikan',
      DRIVE_FOLDER_SUB: '01_LAPORAN_WARGA/SW-2026-000010',
      DRIVE_FILE_ID: 'DRV-1',
      DRIVE_URL: '/api/evidence/BKT-PUB',
      TANGGAL_UPLOAD: '2026-11-01T08:00:00.000Z',
      DIUNGGAH_OLEH: 'Warga',
      VISIBILITAS: 'PUBLIK_WARGA',
    },
    {
      ID_BUKTI: 'BKT-PRIV',
      ID_LAPORAN: 'SW-2026-000010',
      ID_UPDATE: 'UPD-2',
      NAMA_FILE: 'memo_internal_rab.pdf',
      MIME_TYPE: 'application/pdf',
      UKURAN_BYTES: 340000,
      JENIS_BUKTI: 'Dokumen pendukung lainnya',
      DRIVE_FOLDER_SUB: '04_SURAT_KE_DINAS',
      DRIVE_FILE_ID: 'DRV-2',
      DRIVE_URL: '/api/evidence/BKT-PRIV',
      TANGGAL_UPLOAD: '2026-11-05T10:00:00.000Z',
      DIUNGGAH_OLEH: 'Hendra Wijaya',
      VISIBILITAS: 'INTERNAL_DESA',
    },
  ];

  assert.equal(verifyCitizenTrackingAccess(report, { tanggalLahir: '1978-05-12' }), true);
  assert.equal(verifyCitizenTrackingAccess(report, { last4Hp: '7890' }), true);
  assert.equal(verifyCitizenTrackingAccess(report, { tanggalLahir: '1999-01-01', last4Hp: '0000' }), false);

  const sanitized = sanitizeReportForCitizenTracking(report, followUps, evidences);
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes('Budi Santoso Rahasia'), false);
  assert.equal(serialized.includes('081234567890'), false);
  assert.equal(serialized.includes('330901'), false);
  assert.equal(sanitized.buktiPublik.length, 1);
  assert.equal(sanitized.buktiPublik[0].idBukti, 'BKT-PUB');
  assert.equal(sanitized.pesanKhususDinas, DINAS_PROPOSAL_MESSAGE);
  assert.equal(sanitized.riwayatTindakLanjut.length, 2);
});

test('computeDashboardStats and buildCsvExport compute accurate totals', () => {
  const reports: SheetLaporan[] = [
    {
      ID_LAPORAN: 'SW-2026-000001',
      NAMA_PELAPOR: 'A',
      NO_HP_PELAPOR: '0811111111',
      TANGGAL_LAHIR_VERIFIKASI: '1980-01-01',
      KODE_GRUP: 'A. Pengaduan',
      ID_LAYANAN: 'L1',
      NAMA_LAYANAN: 'Jalan rusak',
      JUDUL_LAPORAN: 'Laporan 1',
      MASALAH_UTAMA: 'Jalan rusak',
      URAIAN_MASALAH: 'Rusak',
      LOKASI_ALAMAT: 'Desa',
      RT_RW: 'RT 01/01',
      DATA_FORM_DINAMIS: {},
      STATUS_TERBARU: 'Sudah diperbaiki atau ditangani',
      DRIVE_FOLDER_NAME: 'SW-2026-000001',
      DRIVE_FOLDER_URL: '',
      CREATED_AT: '2026-10-12T08:00:00.000Z',
      UPDATED_AT: '2026-10-15T08:00:00.000Z',
    },
    {
      ID_LAPORAN: 'SW-2026-000002',
      NAMA_PELAPOR: 'B',
      NO_HP_PELAPOR: '0822222222',
      TANGGAL_LAHIR_VERIFIKASI: '1985-02-02',
      KODE_GRUP: 'GENERAL_INQUIRY',
      ID_LAYANAN: 'GENERAL_INQUIRY',
      NAMA_LAYANAN: 'Laporan Umum',
      JUDUL_LAPORAN: 'Laporan 2',
      MASALAH_UTAMA: 'Belum diklasifikasi',
      URAIAN_MASALAH: 'Bingung pilih menu',
      LOKASI_ALAMAT: 'Desa',
      RT_RW: 'RT 02/01',
      DATA_FORM_DINAMIS: {},
      STATUS_TERBARU: 'Laporan diterima',
      DRIVE_FOLDER_NAME: 'SW-2026-000002',
      DRIVE_FOLDER_URL: '',
      CREATED_AT: '2026-11-10T08:00:00.000Z',
      UPDATED_AT: '2026-11-10T08:00:00.000Z',
    },
  ];
  const warga: SheetWarga[] = [
    {
      ID_WARGA: 'W1',
      NAMA_LENGKAP: 'Warga 1',
      NIK_MASKED: '330901******0001',
      NIK_HASH: 'abc',
      KK_MASKED: '330901******0002',
      TANGGAL_LAHIR: '1980-01-01',
      ALAMAT: 'RT 01',
      RT_RW: 'RT 01/01',
      NO_HP: '0811111111',
      STATUS_VERIFIKASI: 'TERVERIFIKASI',
      CREATED_AT: '2026-01-01',
    },
  ];
  const petugas: SheetPetugas[] = [
    {
      ID_PETUGAS: 'P1',
      ID_USER: 'U1',
      NAMA_PETUGAS: 'Petugas 1',
      JABATAN: 'Kasi Pelayanan',
      BIDANG_TUGAS: 'Pengaduan',
      NO_HP: '0812',
      STATUS: 'AKTIF',
      CREATED_AT: '2026-01-01',
    },
  ];

  const stats = computeDashboardStats(reports, warga, petugas);
  assert.equal(stats.totalLaporan, 2);
  assert.equal(stats.selesai, 1);
  assert.equal(stats.laporanBaru, 1);
  assert.equal(stats.completedVsUnfinished.belumSelesai, 1);
  assert.equal(stats.totalWarga, 1);
  assert.equal(stats.totalPetugas, 1);

  const csv = buildCsvExport(reports, []);
  assert.ok(csv.includes('SW-2026-000001'));
  assert.ok(csv.includes('SW-2026-000002'));
});
