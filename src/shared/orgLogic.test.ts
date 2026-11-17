import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl,
  filterOrgProfiles,
  isValidIndonesianPhone,
  normalizeIndonesianPhone,
  sanitizePublicOrgData,
  validateOrgInput,
} from './orgLogic';
import { SiwargaDatabase } from './types';

function makeMinimalDb(): SiwargaDatabase {
  return {
    USERS: [],
    WARGA: [],
    PETUGAS: [],
    LAPORAN: [],
    KATEGORI_LAYANAN: [],
    KONFIGURASI_FORM: [],
    TINDAK_LANJUT: [],
    BUKTI_DOKUMEN: [],
    NOTIFIKASI: [],
    PENGUMUMAN: [],
    PENGATURAN: [],
    LOG_AKTIVITAS: [],
    ORG_KELURAHAN: [
      {
        ID_KELURAHAN: 'KEL-1',
        NAMA: 'Budi Santoso',
        JABATAN: 'Lurah Ampel',
        TINGKAT: 'LURAH',
        NO_HP: '081234567890',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
      {
        ID_KELURAHAN: 'KEL-2',
        NAMA: 'Staf Nonaktif',
        JABATAN: 'Staf Pelayanan',
        TINGKAT: 'STAF',
        NO_HP: '081234567891',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: false,
        URUTAN: 2,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_TP_PKK: [
      {
        ID_PKK: 'PKK-1',
        NAMA: 'Pembina PKK Ampel',
        JABATAN: 'Pembina PKK',
        POKJA: 'Pembina',
        BIDANG: 'Pembinaan PKK',
        NO_HP: '081234500801',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
      {
        ID_PKK: 'PKK-2',
        NAMA: 'Ketua Pokja I',
        JABATAN: 'Ketua POKJA I',
        NO_HP: '081234500802',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_LPMK: [
      {
        ID_LPMK: 'LPMK-1',
        NAMA: 'H. Ahmad',
        JABATAN: 'Ketua LPMK',
        NO_HP: '081299988877',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_RW: [
      {
        ID_RW: 'RW-01',
        NOMOR_RW: 'RW 01',
        NAMA_KETUA: 'Sukarno',
        JABATAN: 'Ketua RW 01',
        WILAYAH_TUGAS: 'Dusun Krajan',
        NO_HP: '081300000001',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_RT: [
      {
        ID_RT: 'RT-01-01',
        ID_RW: 'RW-01',
        NOMOR_RT: 'RT 01',
        NAMA_KETUA: 'Slamet',
        JABATAN: 'Ketua RT 01 / RW 01',
        WILAYAH_TUGAS: 'Blok A',
        NO_HP: '081300000002',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_KADER: [
      {
        ID_KADER: 'KDR-1',
        ID_RT: 'RT-01-01',
        NAMA: 'Siti Aminah',
        JABATAN: 'Kader Posyandu',
        NO_HP: '081300000003',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_SEKOLAH: [
      {
        ID_SEKOLAH: 'SKL-1',
        NAMA_SEKOLAH: 'SD Negeri Ampel 01',
        JENJANG: 'SD / MI',
        KEPALA_SEKOLAH: 'Drs. Hendra',
        ALAMAT: 'Jl. Raya Ampel No. 45',
        NO_HP: '0336441201',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_GURU: [
      {
        ID_GURU: 'GRU-1',
        ID_SEKOLAH: 'SKL-1',
        NAMA: 'Ratna Dewi, S.Pd.',
        JABATAN: 'Guru Kelas IV',
        NO_HP: '081234560001',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
    ORG_BALAI_RW: [
      {
        ID_BALAI: 'BLR-1',
        ID_RW: 'RW-01',
        NAMA_BALAI: 'Balai RW 01 Ampel',
        ALAMAT: 'Jl. Balai Desa No. 4, RW 01',
        JAM_LAYANAN: 'Senin-Sabtu 08.00-15.00 WIB',
        NO_HP: '081234560002',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: '',
        UPDATED_AT: '',
      },
    ],
  };
}

test('Indonesian phone validation and wa.me/62 formatting respect privacy toggle', () => {
  assert.equal(isValidIndonesianPhone('081234567890'), true);
  assert.equal(isValidIndonesianPhone('+6281234567890'), true);
  assert.equal(isValidIndonesianPhone(81234567890), true);
  assert.equal(isValidIndonesianPhone('62081234567890'), true);
  assert.equal(isValidIndonesianPhone('Tidak ada'), true);
  assert.equal(isValidIndonesianPhone('12345'), false);

  assert.equal(normalizeIndonesianPhone(81100000001), '081100000001');
  assert.equal(normalizeIndonesianPhone("'081234567890"), '081234567890');
  assert.equal(normalizeIndonesianPhone('0812-3456-7890 / 081300001111'), '081234567890');
  assert.equal(normalizeIndonesianPhone('-'), '');

  assert.equal(buildWhatsAppUrl('081234567890', true), 'https://wa.me/6281234567890');
  assert.equal(buildWhatsAppUrl('081234567890', false), null);
});

test('sanitizePublicOrgData hides inactive profiles, strips hidden phone numbers, and enriches sekolah/guru/balaiRw', () => {
  const pub = sanitizePublicOrgData(makeMinimalDb());
  assert.equal(pub.kelurahan.length, 1);
  assert.equal(pub.kelurahan[0].nama, 'Budi Santoso');
  assert.equal(pub.kelurahan[0].noHp, undefined);
  assert.equal(pub.kelurahan[0].waUrl, null);

  assert.equal(pub.tpPkk.length, 2);
  assert.equal(pub.tpPkk[0].pokja, 'Pembina');
  assert.equal(pub.tpPkk[1].pokja, 'POKJA I');
  assert.equal(pub.tpPkk[1].waUrl, 'https://wa.me/6281234500802');

  assert.equal(pub.lpmk[0].noHp, '081299988877');
  assert.equal(pub.lpmk[0].waUrl, 'https://wa.me/6281299988877');

  assert.equal(pub.kader[0].nomorRw, 'RW 01');
  assert.equal(pub.kader[0].nomorRt, 'RT 01');
  assert.equal(pub.kader[0].noHp, undefined);

  assert.equal(pub.sekolah.length, 1);
  assert.ok(pub.sekolah[0].mapsUrl?.includes('google.com/maps'));
  assert.equal(pub.guru[0].namaSekolah, 'SD Negeri Ampel 01');
  assert.equal(pub.balaiRw[0].nomorRw, 'RW 01');
  assert.ok(pub.balaiRw[0].mapsUrl?.includes('google.com/maps'));
});

test('validateOrgInput enforces required fields and RW/RT/Sekolah foreign keys', () => {
  const db = makeMinimalDb();
  assert.ok(validateOrgInput('rt', { namaKetua: 'Ali', jabatan: 'Ketua RT', nomorRt: 'RT 02', idRw: 'MISSING' }, db));
  assert.equal(
    validateOrgInput('rt', { namaKetua: 'Ali', jabatan: 'Ketua RT', nomorRt: 'RT 02', idRw: 'RW-01', noHp: '081234567890' }, db),
    null
  );
  assert.ok(validateOrgInput('kader', { nama: 'Ani', jabatan: 'Kader PKK', idRt: 'MISSING' }, db));
  assert.ok(validateOrgInput('guru', { nama: 'Budi, S.Pd.', jabatan: 'Guru IPA', idSekolah: 'MISSING' }, db));
  assert.equal(
    validateOrgInput('guru', { nama: 'Budi, S.Pd.', jabatan: 'Guru IPA', idSekolah: 'SKL-1' }, db),
    null
  );
  assert.ok(validateOrgInput('balai_rw', { namaBalai: 'Balai', alamat: 'Jl. Merdeka No 1', idRw: 'MISSING' }, db));
  assert.equal(
    validateOrgInput('sekolah', { namaSekolah: 'TK Ampel', jenjang: 'PAUD / TK', alamat: 'Jl. Masjid No 5' }, db),
    null
  );
});

test('filterOrgProfiles filters by name, role, category, RW, RT, and sekolah/balaiRw addresses', () => {
  const pub = sanitizePublicOrgData(makeMinimalDb());
  const all = [
    ...pub.kelurahan,
    ...pub.lpmk,
    ...pub.rw,
    ...pub.rt,
    ...pub.kader,
    ...pub.sekolah,
    ...pub.guru,
    ...pub.balaiRw,
  ];
  const onlyPosyandu = filterOrgProfiles(all, {
    queryName: 'siti',
    queryRole: 'posyandu',
    category: 'KADER',
    rwId: 'RW-01',
    rtId: 'RT-01-01',
  });
  assert.equal(onlyPosyandu.length, 1);
  assert.equal(onlyPosyandu[0].nama, 'Siti Aminah');

  const onlyGuru = filterOrgProfiles(all, {
    queryName: 'ampel 01',
    queryRole: '',
    category: 'GURU',
    rwId: '',
    rtId: '',
  });
  assert.equal(onlyGuru.length, 1);
  assert.equal(onlyGuru[0].nama, 'Ratna Dewi, S.Pd.');
});
