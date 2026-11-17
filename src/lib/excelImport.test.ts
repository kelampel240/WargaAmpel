import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkbookBuffer } from './excelExport.ts';
import { parseOrgImportExcel, parsePetugasImportExcel } from './excelImport.ts';
import type { AdminOrgStructureResponse } from '../shared/types.ts';

const sampleOrgRef: Pick<AdminOrgStructureResponse, 'rw' | 'rt' | 'sekolah'> = {
  rw: [
    {
      ID_RW: 'RW-01',
      NOMOR_RW: 'RW 01',
      NAMA_KETUA: 'Ketua 1',
      JABATAN: 'Ketua RW 01',
      WILAYAH_TUGAS: 'Utara',
      TAMPILKAN_HP: false,
      TAMPILKAN_PUBLIK: true,
      AKTIF: true,
      URUTAN: 1,
      CREATED_AT: '',
      UPDATED_AT: '',
    },
  ],
  rt: [
    {
      ID_RT: 'RT-01-01',
      ID_RW: 'RW-01',
      NOMOR_RT: 'RT 01',
      NAMA_KETUA: 'Ketua RT 1',
      JABATAN: 'Ketua RT 01',
      WILAYAH_TUGAS: 'Blok A',
      TAMPILKAN_HP: false,
      TAMPILKAN_PUBLIK: true,
      AKTIF: true,
      URUTAN: 1,
      CREATED_AT: '',
      UPDATED_AT: '',
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
      CREATED_AT: '',
      UPDATED_AT: '',
    },
  ],
};

test('parseOrgImportExcel parses Kelurahan rows and preserves HP privacy default', () => {
  const buf = createWorkbookBuffer([
    {
      name: 'Kelurahan',
      rows: [
        {
          Urutan: 2,
          Tingkat: 'KASI',
          Nama: 'Rina Kasi',
          Jabatan: 'Kasi Kesejahteraan',
          'Wilayah Tugas': 'Kelurahan Ampel',
          'No. HP': '081234567890',
        },
        {
          Urutan: 3,
          Tingkat: 'STAF',
          Nama: 'X',
          Jabatan: 'Staf',
        },
      ],
    },
  ]);

  const parsed = parseOrgImportExcel(buf, 'kelurahan', sampleOrgRef);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].error, null);
  assert.equal(parsed[0].payload.tingkat, 'KASI');
  assert.equal(parsed[0].payload.tampilkanHp, false);
  assert.ok(parsed[1].error !== null);
});

test('parseOrgImportExcel resolves RW and RT references for RT and Kader sheets', () => {
  const buf = createWorkbookBuffer([
    {
      name: 'Kelurahan',
      rows: [{ Nama: 'Dummy', Jabatan: 'Staf', Tingkat: 'STAF' }],
    },
    {
      name: 'Data Kader',
      rows: [
        {
          Urutan: 1,
          RW: 'RW 01',
          RT: 'RT 01',
          'Nama Kader': 'Dewi Kader',
          'Jabatan / Peran': 'Kader Posyandu',
          'No. HP': '081398765432',
          'Tampilkan HP Publik': 'Ya',
        },
        {
          Urutan: 2,
          RW: 'RW 99',
          RT: 'RT 01',
          'Nama Kader': 'Invalid RW',
          'Jabatan / Peran': 'Kader',
        },
      ],
    },
  ]);

  const parsed = parseOrgImportExcel(buf, 'kader', sampleOrgRef);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].error, null);
  assert.equal(parsed[0].payload.idRt, 'RT-01-01');
  assert.equal(parsed[0].payload.tampilkanHp, true);
  assert.ok(parsed[1].error?.includes('tidak ditemukan'));
});

test('parsePetugasImportExcel validates petugas rows cleanly', () => {
  const buf = createWorkbookBuffer([
    {
      name: 'Data Petugas',
      rows: [
        {
          'Nama Petugas': 'Agus Petugas',
          Jabatan: 'Kasi Pemerintahan',
          'Bidang Tugas': 'Surat & Pelayanan',
          'No. HP': '081211112222',
        },
        {
          'Nama Petugas': 'A',
          Jabatan: '',
        },
      ],
    },
  ]);

  const parsed = parsePetugasImportExcel(buf);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].error, null);
  assert.equal(parsed[0].payload.namaPetugas, 'Agus Petugas');
  assert.ok(parsed[1].error !== null);
});

test('parseOrgImportExcel resolves Sekolah, Guru, and Balai RW references', () => {
  const buf = createWorkbookBuffer([
    {
      name: 'Sekolah',
      rows: [
        {
          Urutan: 1,
          'Nama Sekolah': 'TK Dharma Wanita Ampel',
          Jenjang: 'PAUD / TK',
          'Kepala Sekolah': 'Sri Wahyuni',
          'Alamat Lokasi': 'Jl. Pendidikan No. 2, Kelurahan Ampel',
        },
      ],
    },
    {
      name: 'Data Guru',
      rows: [
        {
          Urutan: 1,
          'Nama Sekolah': 'SD Negeri Ampel 01',
          'Nama Guru': 'Ahmad Fauzi, S.Pd.',
          'Mata Pelajaran / Jabatan': 'Guru PJOK',
        },
        {
          Urutan: 2,
          'Nama Sekolah': 'Sekolah Tidak Ada',
          'Nama Guru': 'Anonim',
          'Mata Pelajaran / Jabatan': 'Guru',
        },
      ],
    },
    {
      name: 'Balai RW',
      rows: [
        {
          Urutan: 1,
          RW: 'RW 01',
          'Nama Balai RW': 'Balai RW 01 Kelurahan Ampel',
          'Alamat Balai RW': 'Jl. Balai Desa No. 4, RW 01',
          'Jam Layanan / Fasilitas': 'Senin-Sabtu 08.00-15.00 WIB',
        },
      ],
    },
  ]);

  const parsedSekolah = parseOrgImportExcel(buf, 'sekolah', sampleOrgRef);
  assert.equal(parsedSekolah.length, 1);
  assert.equal(parsedSekolah[0].error, null);
  assert.equal(parsedSekolah[0].payload.jenjang, 'PAUD / TK');

  const parsedGuru = parseOrgImportExcel(buf, 'guru', sampleOrgRef);
  assert.equal(parsedGuru.length, 2);
  assert.equal(parsedGuru[0].error, null);
  assert.equal(parsedGuru[0].payload.idSekolah, 'SKL-1');
  assert.ok(parsedGuru[1].error?.includes('belum terdaftar'));

  const parsedBalai = parseOrgImportExcel(buf, 'balai_rw', sampleOrgRef);
  assert.equal(parsedBalai.length, 1);
  assert.equal(parsedBalai[0].error, null);
  assert.equal(parsedBalai[0].payload.idRw, 'RW-01');
});

test('parseOrgImportExcel normalizes Excel numeric phone numbers without leading zero and RW defaults', () => {
  const buf = createWorkbookBuffer([
    {
      name: 'RW',
      rows: [
        {
          Urutan: 1,
          'Nomor RW': 'RW 01',
          'Nama Ketua': 'ABDULLAH ASEGAF',
          'Wilayah Tugas': 'RW 01',
          'No. HP': 81234567890,
        },
        {
          Urutan: 2,
          'Nomor RW': 'RW 02',
          'Nama Ketua': 'DRS. MUHAMMAD HARRIS A. MUKARROM, M.M.',
          'Wilayah Tugas': 'RW 02',
          'No. WA': '62081345678901',
        },
        {
          Urutan: 3,
          'Nomor RW': 'RW 03',
          'Nama Ketua': 'U M A R',
          'Wilayah Tugas': 'RW 03',
          Telp: 'Tidak ada',
        },
      ],
    },
  ]);

  const parsed = parseOrgImportExcel(buf, 'rw', sampleOrgRef);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].error, null);
  assert.equal(parsed[0].payload.noHp, '081234567890');
  assert.equal(parsed[0].payload.jabatan, 'Ketua RW 01');
  assert.equal(parsed[1].error, null);
  assert.equal(parsed[1].payload.noHp, '081345678901');
  assert.equal(parsed[2].error, null);
  assert.equal(parsed[2].payload.noHp, '');
});
