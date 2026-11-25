import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildOrgStructureSheets,
  buildReportRows,
  buildWargaRows,
  createWorkbookBuffer,
  sanitizeSheetName,
} from './excelExport.ts';
import type {
  AdminOrgStructureResponse,
  SheetLaporan,
  SheetWarga,
} from '../shared/types.ts';

test('sanitizeSheetName removes forbidden Excel chars and enforces 31 char limit', () => {
  const sanitized = sanitizeSheetName('Daftar:Laporan/[2026]*?\\SangatPanjangSekali');
  assert.ok(sanitized.length <= 31);
  assert.equal(/[:\\/?*[\]]/.test(sanitized), false);
});

test('createWorkbookBuffer creates valid parseable multi-sheet xlsx bytes even when rows are empty', () => {
  const buf = createWorkbookBuffer([
    { name: 'Sheet A', rows: [{ Kolom: 'Nilai 1', Angka: 42 }] },
    { name: 'Sheet Kosong', rows: [] },
  ]);

  // XLSX files are ZIP archives starting with "PK" (0x50, 0x4b)
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);

  const wb = XLSX.read(buf, { type: 'array' });
  assert.deepEqual(wb.SheetNames, ['Sheet A', 'Sheet Kosong']);

  const parsedA = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Sheet A']);
  assert.equal(parsedA[0].Kolom, 'Nilai 1');
  assert.equal(parsedA[0].Angka, 42);

  const parsedEmpty = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Sheet Kosong']);
  assert.equal(parsedEmpty[0].Keterangan, 'Belum ada data tersedia.');
});

test('buildOrgStructureSheets resolves RW/RT/Sekolah names and exports all 9 organization sheets including TP PKK', () => {
  const sample: AdminOrgStructureResponse = {
    kelurahan: [
      {
        ID_KELURAHAN: 'KEL-1',
        NAMA: 'Budi Lurah',
        JABATAN: 'Lurah Ampel',
        TINGKAT: 'LURAH',
        WILAYAH_TUGAS: 'Kelurahan Ampel',
        NO_HP: '08123456789',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    tpPkk: [
      {
        ID_PKK: 'PKK-1',
        NAMA: 'Ibu Pembina PKK',
        JABATAN: 'Pembina PKK',
        POKJA: 'Pembina',
        BIDANG: 'Pembinaan PKK',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    lpmk: [],
    rw: [
      {
        ID_RW: 'RW-01',
        NOMOR_RW: 'RW 01',
        NAMA_KETUA: 'Ketua RW Satu',
        JABATAN: 'Ketua RW 01',
        WILAYAH_TUGAS: 'Dusun Utara',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    rt: [
      {
        ID_RT: 'RT-01-01',
        ID_RW: 'RW-01',
        NOMOR_RT: 'RT 01',
        NAMA_KETUA: 'Ketua RT Satu',
        JABATAN: 'Ketua RT 01',
        WILAYAH_TUGAS: 'Blok A',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    kader: [
      {
        ID_KADER: 'KDR-1',
        ID_RT: 'RT-01-01',
        NAMA: 'Siti Kader',
        JABATAN: 'Kader Posyandu',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    sekolah: [
      {
        ID_SEKOLAH: 'SKL-1',
        NAMA_SEKOLAH: 'SD Negeri Ampel 01',
        JENJANG: 'SD / MI',
        KEPALA_SEKOLAH: 'Hendra, S.Pd.',
        ALAMAT: 'Jl. Raya Ampel No. 45',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    guru: [
      {
        ID_GURU: 'GRU-1',
        ID_SEKOLAH: 'SKL-1',
        NAMA: 'Ratna Dewi, S.Pd.',
        JABATAN: 'Guru Kelas IV',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    balaiRw: [
      {
        ID_BALAI: 'BLR-1',
        ID_RW: 'RW-01',
        NAMA_BALAI: 'Balai RW 01 Kelurahan Ampel',
        ALAMAT: 'Jl. Balai Kelurahan No. 4, RW 01',
        JAM_LAYANAN: 'Senin-Sabtu 08.00-15.00 WIB',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '2026-01-01T00:00:00Z',
        UPDATED_AT: '2026-01-01T00:00:00Z',
      },
    ],
    displaySettings: {
      pengumumanBeranda: 'Info',
      urutanBagian: ['KELURAHAN', 'TP_PKK', 'LPMK_RW_RT', 'KADER', 'SEKOLAH_GURU', 'BALAI_RW'],
      tampilkanBagian: {
        kelurahan: true,
        tpPkk: true,
        lpmk: true,
        rwRt: true,
        kader: true,
        sekolahGuru: true,
        balaiRw: true,
      },
    },
    summary: {
      totalLurah: 1,
      totalKasi: 0,
      totalStaf: 0,
      totalTpPkk: 1,
      totalLpmk: 0,
      totalRw: 1,
      totalRt: 1,
      totalKader: 1,
      totalSekolah: 1,
      totalGuru: 1,
      totalBalaiRw: 1,
    },
  };

  const sheets = buildOrgStructureSheets(sample);
  const buf = createWorkbookBuffer(sheets);
  const wb = XLSX.read(buf, { type: 'array' });

  assert.deepEqual(wb.SheetNames, [
    'Kelurahan',
    'TP PKK',
    'LPMK',
    'Daftar RW',
    'Daftar RT',
    'Data Kader',
    'Sekolah',
    'Data Guru',
    'Balai RW',
  ]);
  const kaderSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Data Kader']);
  assert.equal(kaderSheet[0].RW, 'RW 01');
  assert.equal(kaderSheet[0].RT, 'RT 01');
  assert.equal(kaderSheet[0]['Nama Kader'], 'Siti Kader');

  const guruSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Data Guru']);
  assert.equal(guruSheet[0]['Nama Sekolah'], 'SD Negeri Ampel 01');
  assert.equal(guruSheet[0]['Nama Guru'], 'Ratna Dewi, S.Pd.');

  const balaiSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Balai RW']);
  assert.equal(balaiSheet[0].RW, 'RW 01');
  assert.equal(balaiSheet[0]['Nama Balai RW'], 'Balai RW 01 Kelurahan Ampel');
});

test('buildWargaRows strictly exports masked NIK/KK and excludes NIK_HASH', () => {
  const warga: SheetWarga[] = [
    {
      ID_WARGA: 'WRG-1',
      NAMA_LENGKAP: 'Slamet',
      NIK_MASKED: '3511********0001',
      NIK_HASH: 'secret_hash_should_never_appear',
      KK_MASKED: '3511********9999',
      TANGGAL_LAHIR: '1980-05-10',
      ALAMAT: 'Jl. Ampel 1',
      RT_RW: 'RT 01 / RW 01',
      NO_HP: '081200001111',
      STATUS_VERIFIKASI: 'TERVERIFIKASI',
      CREATED_AT: '2026-02-01T00:00:00Z',
    },
  ];
  const rows = buildWargaRows(warga);
  assert.equal(rows[0]['NIK (Ter-mask)'], '3511********0001');
  assert.equal(rows[0]['KK (Ter-mask)'], '3511********9999');
  assert.equal(Object.values(rows[0]).includes('secret_hash_should_never_appear'), false);
});

test('buildReportRows formats report fields into readable Indonesian Excel columns', () => {
  const reports: SheetLaporan[] = [
    {
      ID_LAPORAN: 'SW-2026-000001',
      NAMA_PELAPOR: 'Ahmad',
      NO_HP_PELAPOR: '081234',
      TANGGAL_LAHIR_VERIFIKASI: '1990-01-01',
      KODE_GRUP: 'A. Pengaduan',
      ID_LAYANAN: 'L1',
      NAMA_LAYANAN: 'Lampu Jalan Mati',
      JUDUL_LAPORAN: 'Lampu jalan mati di pertigaan',
      MASALAH_UTAMA: 'Gelap',
      URAIAN_MASALAH: 'Sudah 3 hari mati',
      LOKASI_ALAMAT: 'Jl. Ampel Raya',
      RT_RW: 'RT 02 / RW 01',
      DATA_FORM_DINAMIS: {},
      STATUS_TERBARU: 'Laporan diterima',
      DRIVE_FOLDER_NAME: 'SW-2026-000001',
      DRIVE_FOLDER_URL: 'https://drive.google.com/drive/folders/abc',
      CREATED_AT: '2026-03-01T00:00:00Z',
      UPDATED_AT: '2026-03-01T00:00:00Z',
    },
  ];
  const rows = buildReportRows(reports);
  assert.equal(rows[0]['Nomor Tiket'], 'SW-2026-000001');
  assert.equal(rows[0]['Judul Laporan'], 'Lampu jalan mati di pertigaan');
  assert.equal(rows[0]['Status Terbaru'], 'Laporan diterima');
});
