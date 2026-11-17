import fs from 'node:fs';
import path from 'node:path';
import {
  REPORT_STATUSES,
  SheetKategoriLayanan,
  SheetKonfigurasiForm,
  SheetLaporan,
  SheetPetugas,
  SheetTindakLanjut,
  SheetUser,
  SheetWarga,
  SiwargaDatabase,
} from '../shared/types';
import { maskKk, maskNik } from '../shared/siwargaLogic';
import { hashPassword, hashSensitiveId, TicketLockManager } from './cryptoUtils';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'siwarga_db.json');
export const DRIVE_ROOT_DIR = path.join(DATA_DIR, 'SIWARGA_DESA');

export const DRIVE_SUBFOLDERS = [
  '01_LAPORAN_WARGA',
  '02_SURAT_ADMINISTRASI',
  '03_BUKTI_PENANGANAN',
  '04_SURAT_KE_DINAS',
  '05_DOKUMEN_PENDUKUNG',
  '06_FOTO_ORGANISASI',
] as const;

export const ticketLock = new TicketLockManager();

export function ensureDriveStructure(): void {
  if (!fs.existsSync(DRIVE_ROOT_DIR)) {
    fs.mkdirSync(DRIVE_ROOT_DIR, { recursive: true });
  }
  for (const sub of DRIVE_SUBFOLDERS) {
    const dirPath = path.join(DRIVE_ROOT_DIR, sub);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

export function ensureTicketFolder(ticketId: string): {
  folderName: string;
  folderPath: string;
  subPath: string;
} {
  ensureDriveStructure();
  const safeId = ticketId.replace(/[^A-Za-z0-9_-]/g, '');
  const subPath = path.posix.join('01_LAPORAN_WARGA', safeId);
  const folderPath = path.join(DRIVE_ROOT_DIR, '01_LAPORAN_WARGA', safeId);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return { folderName: safeId, folderPath, subPath };
}

function copySeedImageToDrive(srcPublicAsset: string, destSubFolder: string, destFileName: string): number {
  const srcPath = path.resolve(process.cwd(), srcPublicAsset.replace(/^\//, ''));
  const destDir = path.join(DRIVE_ROOT_DIR, destSubFolder);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPath = path.join(destDir, destFileName);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    return fs.statSync(destPath).size;
  }
  // Fallback minimal buffer if asset missing in test environment
  const fallback = Buffer.from('SIWARGA_DRIVE_PLACEHOLDER');
  fs.writeFileSync(destPath, fallback);
  return fallback.length;
}

function buildSeedServices(): {
  services: SheetKategoriLayanan[];
  forms: SheetKonfigurasiForm[];
} {
  const defaultFlow = [...REPORT_STATUSES];
  const now = '2026-01-05T07:00:00.000Z';

  const services: SheetKategoriLayanan[] = [
    // A. Pengaduan
    {
      ID_LAYANAN: 'LAY-A01',
      KODE_LAYANAN: 'PGD-JALAN',
      NAMA_LAYANAN: 'Jalan rusak',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Laporan jalan berlubang, aspal terkelupas, atau jembatan desa rusak.',
      IKON: 'road',
      PERSYARATAN_DOKUMEN: 'Foto kondisi lokasi (opsional)',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 1,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-A02',
      KODE_LAYANAN: 'PGD-SAMPAH',
      NAMA_LAYANAN: 'Sampah menumpuk',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Penumpukan sampah liar atau keterlambatan pengangkutan sampah dusun.',
      IKON: 'trash',
      PERSYARATAN_DOKUMEN: 'Foto titik sampah (opsional)',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 2,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-A03',
      KODE_LAYANAN: 'PGD-LAMPU',
      NAMA_LAYANAN: 'Lampu jalan mati',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Penerangan jalan umum (PJU) padam, berkedip, atau tiang miring.',
      IKON: 'lamp',
      PERSYARATAN_DOKUMEN: 'Foto tiang/lokasi (opsional)',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 3,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-A04',
      KODE_LAYANAN: 'PGD-DRAINASE',
      NAMA_LAYANAN: 'Saluran air tersumbat',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Selokan tersumbat, gorong-gorong rusak, atau genangan air saat hujan.',
      IKON: 'droplets',
      PERSYARATAN_DOKUMEN: 'Foto saluran air (opsional)',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 4,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-A05',
      KODE_LAYANAN: 'PGD-KEAMANAN',
      NAMA_LAYANAN: 'Gangguan keamanan',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Gangguan ketertiban lingkungan, ronda, atau kerawanan malam hari.',
      IKON: 'shield',
      PERSYARATAN_DOKUMEN: 'Keterangan kronologi',
      ID_PETUGAS_PJ: 'PTG-002',
      NAMA_PETUGAS_PJ: 'Siti Aminah',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 5,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-A06',
      KODE_LAYANAN: 'PGD-LINGKUNGAN',
      NAMA_LAYANAN: 'Masalah lingkungan',
      KATEGORI_GRUP: 'A. Pengaduan',
      DESKRIPSI: 'Pencemaran air, pohon tumbang, atau gangguan kebersihan lingkungan.',
      IKON: 'trees',
      PERSYARATAN_DOKUMEN: 'Foto lokasi (opsional)',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 6,
      CREATED_AT: now,
    },
    // B. Bantuan
    {
      ID_LAYANAN: 'LAY-B01',
      KODE_LAYANAN: 'BNT-SOSIAL',
      NAMA_LAYANAN: 'Bantuan sosial',
      KATEGORI_GRUP: 'B. Bantuan',
      DESKRIPSI: 'Permohonan bantuan pangan, PKH/BLT desa, atau dukungan lansia kurang mampu.',
      IKON: 'heart',
      PERSYARATAN_DOKUMEN: 'Foto KK / kondisi rumah (opsional)',
      ID_PETUGAS_PJ: 'PTG-002',
      NAMA_PETUGAS_PJ: 'Siti Aminah',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 7,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-B02',
      KODE_LAYANAN: 'BNT-PENDIDIKAN',
      NAMA_LAYANAN: 'Pendidikan',
      KATEGORI_GRUP: 'B. Bantuan',
      DESKRIPSI: 'Rekomendasi beasiswa desa atau bantuan perlengkapan sekolah.',
      IKON: 'graduation',
      PERSYARATAN_DOKUMEN: 'Surat keterangan sekolah (PDF/JPG opsional)',
      ID_PETUGAS_PJ: 'PTG-002',
      NAMA_PETUGAS_PJ: 'Siti Aminah',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 8,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-B03',
      KODE_LAYANAN: 'BNT-KESEHATAN',
      NAMA_LAYANAN: 'Kesehatan',
      KATEGORI_GRUP: 'B. Bantuan',
      DESKRIPSI: 'Bantuan rujukan BPJS, ambulans desa, atau pendampingan pasien.',
      IKON: 'heart-pulse',
      PERSYARATAN_DOKUMEN: 'Surat rujukan atau keterangan medis (opsional)',
      ID_PETUGAS_PJ: 'PTG-002',
      NAMA_PETUGAS_PJ: 'Siti Aminah',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 9,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-B04',
      KODE_LAYANAN: 'BNT-EKONOMI',
      NAMA_LAYANAN: 'Ekonomi & Darurat',
      KATEGORI_GRUP: 'B. Bantuan',
      DESKRIPSI: 'Bantuan modal UMKM warga atau tanggap darurat bencana rumah tangga.',
      IKON: 'hand-coins',
      PERSYARATAN_DOKUMEN: 'Foto kondisi usaha / kejadian (opsional)',
      ID_PETUGAS_PJ: 'PTG-002',
      NAMA_PETUGAS_PJ: 'Siti Aminah',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 10,
      CREATED_AT: now,
    },
    // C. Administrasi
    {
      ID_LAYANAN: 'LAY-C01',
      KODE_LAYANAN: 'ADM-DOMISILI',
      NAMA_LAYANAN: 'Surat domisili',
      KATEGORI_GRUP: 'C. Administrasi',
      DESKRIPSI: 'Pengurusan surat keterangan domisili tempat tinggal warga Desa Ampel.',
      IKON: 'file-text',
      PERSYARATAN_DOKUMEN: 'Foto KTP & KK (opsional)',
      ID_PETUGAS_PJ: 'PTG-003',
      NAMA_PETUGAS_PJ: 'Rina Kusuma',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 11,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-C02',
      KODE_LAYANAN: 'ADM-USAHA',
      NAMA_LAYANAN: 'Surat keterangan usaha',
      KATEGORI_GRUP: 'C. Administrasi',
      DESKRIPSI: 'Surat keterangan usaha (SKU) untuk pengajuan KUR atau izin usaha mikro.',
      IKON: 'store',
      PERSYARATAN_DOKUMEN: 'Foto tempat usaha (opsional)',
      ID_PETUGAS_PJ: 'PTG-003',
      NAMA_PETUGAS_PJ: 'Rina Kusuma',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 12,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-C03',
      KODE_LAYANAN: 'ADM-SKTM',
      NAMA_LAYANAN: 'Surat tidak mampu',
      KATEGORI_GRUP: 'C. Administrasi',
      DESKRIPSI: 'Surat Keterangan Tidak Mampu (SKTM) untuk keperluan pendidikan atau kesehatan.',
      IKON: 'file-check',
      PERSYARATAN_DOKUMEN: 'Surat pengantar RT/RW (opsional)',
      ID_PETUGAS_PJ: 'PTG-003',
      NAMA_PETUGAS_PJ: 'Rina Kusuma',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 13,
      CREATED_AT: now,
    },
    {
      ID_LAYANAN: 'LAY-C04',
      KODE_LAYANAN: 'ADM-PENGANTAR',
      NAMA_LAYANAN: 'Surat pengantar & lainnya',
      KATEGORI_GRUP: 'C. Administrasi',
      DESKRIPSI: 'Surat pengantar SKCK, pindah datang, atau keperluan administrasi kependudukan lainnya.',
      IKON: 'folder-open',
      PERSYARATAN_DOKUMEN: 'Dokumen pendukung (opsional)',
      ID_PETUGAS_PJ: 'PTG-003',
      NAMA_PETUGAS_PJ: 'Rina Kusuma',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 14,
      CREATED_AT: now,
    },
    // D. Aspirasi
    {
      ID_LAYANAN: 'LAY-D01',
      KODE_LAYANAN: 'ASP-PEMBANGUNAN',
      NAMA_LAYANAN: 'Usulan pembangunan',
      KATEGORI_GRUP: 'D. Aspirasi',
      DESKRIPSI: 'Usulan pembangunan fasilitas umum, irigasi, atau musrenbang desa.',
      IKON: 'building',
      PERSYARATAN_DOKUMEN: 'Tidak ada',
      ID_PETUGAS_PJ: 'PTG-001',
      NAMA_PETUGAS_PJ: 'Hendra Wijaya',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 15,
      CREATED_AT: now,
    },
    // E. Konsultasi
    {
      ID_LAYANAN: 'LAY-E01',
      KODE_LAYANAN: 'KNS-UMUM',
      NAMA_LAYANAN: 'Pertanyaan & konsultasi desa',
      KATEGORI_GRUP: 'E. Konsultasi',
      DESKRIPSI: 'Pertanyaan seputar administrasi, bantuan sosial, atau informasi pelayanan desa.',
      IKON: 'message-circle',
      PERSYARATAN_DOKUMEN: 'Tidak ada',
      ID_PETUGAS_PJ: 'PTG-003',
      NAMA_PETUGAS_PJ: 'Rina Kusuma',
      ALUR_STATUS: defaultFlow,
      STATUS_AKTIF: true,
      URUTAN: 16,
      CREATED_AT: now,
    },
  ];

  const forms: SheetKonfigurasiForm[] = [
    {
      ID_FIELD: 'FLD-001',
      ID_LAYANAN: 'LAY-A01',
      LABEL_PERTANYAAN: 'Tingkat kerusakan jalan',
      TIPE_ISIAN: 'radio',
      OPSI_PILIHAN: ['Lubang kecil', 'Rusak sedang / bergelombang', 'Rusak berat / membahayakan'],
      WAJIB: false,
      PLACEHOLDER: '',
      URUTAN: 1,
    },
    {
      ID_FIELD: 'FLD-002',
      ID_LAYANAN: 'LAY-C02',
      LABEL_PERTANYAAN: 'Nama bidang usaha',
      TIPE_ISIAN: 'text',
      OPSI_PILIHAN: [],
      WAJIB: true,
      PLACEHOLDER: 'Contoh: Warung Sembako Barokah',
      URUTAN: 1,
    },
    {
      ID_FIELD: 'FLD-003',
      ID_LAYANAN: 'LAY-C02',
      LABEL_PERTANYAAN: 'Keperluan surat',
      TIPE_ISIAN: 'dropdown',
      OPSI_PILIHAN: ['Pengajuan KUR Bank', 'Izin Usaha Mikro (NIB)', 'Administrasi Koperasi', 'Lainnya'],
      WAJIB: true,
      PLACEHOLDER: '',
      URUTAN: 2,
    },
    {
      ID_FIELD: 'FLD-004',
      ID_LAYANAN: 'LAY-B01',
      LABEL_PERTANYAAN: 'Jumlah tanggungan keluarga',
      TIPE_ISIAN: 'dropdown',
      OPSI_PILIHAN: ['1 - 2 orang', '3 - 4 orang', '5 orang atau lebih'],
      WAJIB: true,
      PLACEHOLDER: '',
      URUTAN: 1,
    },
  ];

  return { services, forms };
}

function createInitialDatabase(): SiwargaDatabase {
  ensureDriveStructure();
  const { services, forms } = buildSeedServices();

  const users: SheetUser[] = [
    {
      ID_USER: 'USR-ADMIN-01',
      USERNAME: 'admin',
      NAMA_LENGKAP: 'Arif Rahman (Super Admin)',
      EMAIL: 'admin@ampel.desa.id',
      NO_HP: '081100000001',
      PASSWORD_HASH: hashPassword('AdminAmpel2026!'),
      ROLE: 'SUPER_ADMIN',
      STATUS_AKUN: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_USER: 'USR-KADES-01',
      USERNAME: 'kades',
      NAMA_LENGKAP: 'H. Sutrisno (Kepala Desa)',
      EMAIL: 'kades@ampel.desa.id',
      NO_HP: '081100000002',
      PASSWORD_HASH: hashPassword('KadesAmpel2026!'),
      ROLE: 'KEPALA_DESA',
      STATUS_AKUN: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_USER: 'USR-OP-01',
      USERNAME: 'operator',
      NAMA_LENGKAP: 'Rina Kusuma (Operator)',
      EMAIL: 'operator@ampel.desa.id',
      NO_HP: '081100000003',
      PASSWORD_HASH: hashPassword('OperatorAmpel2026!'),
      ROLE: 'OPERATOR',
      STATUS_AKUN: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_USER: 'USR-PTG-01',
      USERNAME: 'petugas',
      NAMA_LENGKAP: 'Hendra Wijaya (Petugas Lapangan)',
      EMAIL: 'hendra@ampel.desa.id',
      NO_HP: '081100000004',
      PASSWORD_HASH: hashPassword('PetugasAmpel2026!'),
      ROLE: 'PETUGAS',
      STATUS_AKUN: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_USER: 'USR-WRG-01',
      USERNAME: 'sriwahyuni',
      NAMA_LENGKAP: 'Ibu Sri Wahyuni',
      EMAIL: 'sri.wahyuni@warga.ampel.id',
      NO_HP: '081234567801',
      PASSWORD_HASH: hashPassword('WargaAmpel2026!'),
      ROLE: 'WARGA',
      STATUS_AKUN: 'AKTIF',
      KODE_VERIFIKASI: 'AMP-4821',
      CREATED_AT: '2026-02-10T08:00:00.000Z',
    },
    {
      ID_USER: 'USR-WRG-02',
      USERNAME: 'pakslamet',
      NAMA_LENGKAP: 'Bapak Slamet Riyadi',
      EMAIL: 'slamet@warga.ampel.id',
      NO_HP: '081398765402',
      PASSWORD_HASH: hashPassword('WargaAmpel2026!'),
      ROLE: 'WARGA',
      STATUS_AKUN: 'AKTIF',
      KODE_VERIFIKASI: 'AMP-7712',
      CREATED_AT: '2026-03-14T09:00:00.000Z',
    },
  ];

  const warga: SheetWarga[] = [
    {
      ID_WARGA: 'WRG-001',
      ID_USER: 'USR-WRG-01',
      NAMA_LENGKAP: 'Ibu Sri Wahyuni',
      NIK_MASKED: maskNik('3309015407750003'),
      NIK_HASH: hashSensitiveId('3309015407750003'),
      KK_MASKED: maskKk('3309011204080011'),
      TANGGAL_LAHIR: '1975-07-14',
      ALAMAT: 'Dusun Krajan Timur No. 12',
      RT_RW: 'RT 02 / RW 01',
      NO_HP: '081234567801',
      STATUS_VERIFIKASI: 'TERVERIFIKASI',
      CREATED_AT: '2026-02-10T08:00:00.000Z',
    },
    {
      ID_WARGA: 'WRG-002',
      ID_USER: 'USR-WRG-02',
      NAMA_LENGKAP: 'Bapak Slamet Riyadi',
      NIK_MASKED: maskNik('3309011803640008'),
      NIK_HASH: hashSensitiveId('3309011803640008'),
      KK_MASKED: maskKk('3309010506010022'),
      TANGGAL_LAHIR: '1964-03-18',
      ALAMAT: 'Dusun Sumberjo No. 05',
      RT_RW: 'RT 04 / RW 02',
      NO_HP: '081398765402',
      STATUS_VERIFIKASI: 'TERVERIFIKASI',
      CREATED_AT: '2026-03-14T09:00:00.000Z',
    },
    {
      ID_WARGA: 'WRG-003',
      NAMA_LENGKAP: 'Dian Pertiwi',
      NIK_MASKED: maskNik('3309016109920001'),
      NIK_HASH: hashSensitiveId('3309016109920001'),
      KK_MASKED: maskKk('3309012208150004'),
      TANGGAL_LAHIR: '1992-09-21',
      ALAMAT: 'Dusun Ngemplak No. 27',
      RT_RW: 'RT 01 / RW 03',
      NO_HP: '085643219876',
      STATUS_VERIFIKASI: 'MENUNGGU_VERIFIKASI',
      CREATED_AT: '2026-11-08T10:30:00.000Z',
    },
  ];

  const petugas: SheetPetugas[] = [
    {
      ID_PETUGAS: 'PTG-001',
      ID_USER: 'USR-PTG-01',
      NAMA_PETUGAS: 'Hendra Wijaya',
      JABATAN: 'Kasi Kesejahteraan & Infrastruktur',
      BIDANG_TUGAS: 'Pengaduan Infrastruktur & Lingkungan',
      NO_HP: '081100000004',
      STATUS: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_PETUGAS: 'PTG-002',
      ID_USER: 'USR-ADMIN-01',
      NAMA_PETUGAS: 'Siti Aminah',
      JABATAN: 'Kaur Sosial & Pemberdayaan',
      BIDANG_TUGAS: 'Bantuan Sosial, Pendidikan & Kesehatan',
      NO_HP: '081100000005',
      STATUS: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
    {
      ID_PETUGAS: 'PTG-003',
      ID_USER: 'USR-OP-01',
      NAMA_PETUGAS: 'Rina Kusuma',
      JABATAN: 'Kasi Pelayanan & Administrasi',
      BIDANG_TUGAS: 'Surat Keterangan & Konsultasi Warga',
      NO_HP: '081100000003',
      STATUS: 'AKTIF',
      CREATED_AT: '2026-01-01T07:00:00.000Z',
    },
  ];

  // Seed Drive folders & evidence photos for ticket SW-2026-000001
  const t1Folder = ensureTicketFolder('SW-2026-000001');
  const beforeSize = copySeedImageToDrive(
    '/src/assets/images/sample_jalan_rusak_1794843784170.jpg',
    t1Folder.subPath,
    'Foto_sebelum_perbaikan.jpg'
  );
  const afterSize = copySeedImageToDrive(
    '/src/assets/images/sample_jalan_diperbaiki_1794843786633.jpg',
    t1Folder.subPath,
    'Foto_sesudah_perbaikan.jpg'
  );
  ensureTicketFolder('SW-2026-000002');
  ensureTicketFolder('SW-2026-000003');
  ensureTicketFolder('SW-2026-000004');
  ensureTicketFolder('SW-2026-000005');

  const laporan: SheetLaporan[] = [
    {
      ID_LAPORAN: 'SW-2026-000001',
      ID_WARGA: 'WRG-001',
      ID_USER_PELAPOR: 'USR-WRG-01',
      NAMA_PELAPOR: 'Ibu Sri Wahyuni',
      NO_HP_PELAPOR: '081234567801',
      TANGGAL_LAHIR_VERIFIKASI: '1975-07-14',
      NIK_MASKED_PELAPOR: '330901******0003',
      KODE_GRUP: 'A. Pengaduan',
      ID_LAYANAN: 'LAY-A01',
      NAMA_LAYANAN: 'Jalan rusak',
      JUDUL_LAPORAN: 'Jalan Berlubang dan Tergenang di Dusun Krajan Timur',
      MASALAH_UTAMA: 'Jalan rusak',
      URAIAN_MASALAH: 'Aspal jalan di depan mushola Dusun Krajan Timur berlubang cukup dalam dan tergenang air saat hujan sehingga membahayakan pengendara motor dan anak sekolah.',
      LOKASI_ALAMAT: 'Jl. Balai Desa Dusun Krajan Timur',
      RT_RW: 'RT 02 / RW 01',
      DATA_FORM_DINAMIS: { 'FLD-001': 'Rusak berat / membahayakan' },
      STATUS_TERBARU: 'Sudah diperbaiki atau ditangani',
      ID_PETUGAS_TUGAS: 'PTG-001',
      NAMA_PETUGAS_TUGAS: 'Hendra Wijaya',
      DRIVE_FOLDER_NAME: 'SW-2026-000001',
      DRIVE_FOLDER_URL: 'SIWARGA_DESA/01_LAPORAN_WARGA/SW-2026-000001',
      CREATED_AT: '2026-09-14T08:15:00.000Z',
      UPDATED_AT: '2026-09-25T15:30:00.000Z',
    },
    {
      ID_LAPORAN: 'SW-2026-000002',
      ID_WARGA: 'WRG-002',
      ID_USER_PELAPOR: 'USR-WRG-02',
      NAMA_PELAPOR: 'Bapak Slamet Riyadi',
      NO_HP_PELAPOR: '081398765402',
      TANGGAL_LAHIR_VERIFIKASI: '1964-03-18',
      NIK_MASKED_PELAPOR: '330901******0008',
      KODE_GRUP: 'A. Pengaduan',
      ID_LAYANAN: 'LAY-A04',
      NAMA_LAYANAN: 'Saluran air tersumbat',
      JUDUL_LAPORAN: 'Gorong-Gorong Jalan Kabupaten Tersumbat Sedimen',
      MASALAH_UTAMA: 'Saluran air tersumbat',
      URAIAN_MASALAH: 'Gorong-gorong utama di perbatasan Dusun Sumberjo tersumbat lumpur dan akar pohon, air meluap ke pekarangan warga setiap hujan deras.',
      LOKASI_ALAMAT: 'Pertigaan Dusun Sumberjo',
      RT_RW: 'RT 04 / RW 02',
      DATA_FORM_DINAMIS: {},
      STATUS_TERBARU: 'Sudah diusulkan ke dinas terkait',
      ID_PETUGAS_TUGAS: 'PTG-001',
      NAMA_PETUGAS_TUGAS: 'Hendra Wijaya',
      DRIVE_FOLDER_NAME: 'SW-2026-000002',
      DRIVE_FOLDER_URL: 'SIWARGA_DESA/01_LAPORAN_WARGA/SW-2026-000002',
      CREATED_AT: '2026-10-18T09:20:00.000Z',
      UPDATED_AT: '2026-10-28T11:00:00.000Z',
    },
    {
      ID_LAPORAN: 'SW-2026-000003',
      ID_WARGA: 'WRG-001',
      ID_USER_PELAPOR: 'USR-WRG-01',
      NAMA_PELAPOR: 'Ibu Sri Wahyuni',
      NO_HP_PELAPOR: '081234567801',
      TANGGAL_LAHIR_VERIFIKASI: '1975-07-14',
      NIK_MASKED_PELAPOR: '330901******0003',
      KODE_GRUP: 'C. Administrasi',
      ID_LAYANAN: 'LAY-C02',
      NAMA_LAYANAN: 'Surat keterangan usaha',
      JUDUL_LAPORAN: 'Permohonan Surat Keterangan Usaha Warung Sembako',
      MASALAH_UTAMA: 'Surat keterangan usaha',
      URAIAN_MASALAH: 'Mohon dibuatkan Surat Keterangan Usaha untuk keperluan pengajuan modal usaha mikro di bank.',
      LOKASI_ALAMAT: 'Dusun Krajan Timur No. 12',
      RT_RW: 'RT 02 / RW 01',
      DATA_FORM_DINAMIS: { 'FLD-002': 'Warung Sembako Barokah', 'FLD-003': 'Pengajuan KUR Bank' },
      STATUS_TERBARU: 'Sedang ditindaklanjuti',
      ID_PETUGAS_TUGAS: 'PTG-003',
      NAMA_PETUGAS_TUGAS: 'Rina Kusuma',
      DRIVE_FOLDER_NAME: 'SW-2026-000003',
      DRIVE_FOLDER_URL: 'SIWARGA_DESA/01_LAPORAN_WARGA/SW-2026-000003',
      CREATED_AT: '2026-11-04T08:45:00.000Z',
      UPDATED_AT: '2026-11-05T10:15:00.000Z',
    },
    {
      ID_LAPORAN: 'SW-2026-000004',
      ID_WARGA: 'WRG-002',
      ID_USER_PELAPOR: 'USR-WRG-02',
      NAMA_PELAPOR: 'Bapak Slamet Riyadi',
      NO_HP_PELAPOR: '081398765402',
      TANGGAL_LAHIR_VERIFIKASI: '1964-03-18',
      NIK_MASKED_PELAPOR: '330901******0008',
      KODE_GRUP: 'B. Bantuan',
      ID_LAYANAN: 'LAY-B01',
      NAMA_LAYANAN: 'Bantuan sosial',
      JUDUL_LAPORAN: 'Pengajuan Pendataan Bantuan Pangan Lansia',
      MASALAH_UTAMA: 'Bantuan sosial',
      URAIAN_MASALAH: 'Mengajukan pendataan ulang penerima bantuan pangan lansia untuk keluarga kami karena sudah tidak bekerja tetap.',
      LOKASI_ALAMAT: 'Dusun Sumberjo No. 05',
      RT_RW: 'RT 04 / RW 02',
      DATA_FORM_DINAMIS: { 'FLD-004': '1 - 2 orang' },
      STATUS_TERBARU: 'Sedang dalam proses perbaikan',
      ID_PETUGAS_TUGAS: 'PTG-002',
      NAMA_PETUGAS_TUGAS: 'Siti Aminah',
      DRIVE_FOLDER_NAME: 'SW-2026-000004',
      DRIVE_FOLDER_URL: 'SIWARGA_DESA/01_LAPORAN_WARGA/SW-2026-000004',
      CREATED_AT: '2026-11-09T11:10:00.000Z',
      UPDATED_AT: '2026-11-11T09:00:00.000Z',
    },
    {
      ID_LAPORAN: 'SW-2026-000005',
      ID_WARGA: 'WRG-003',
      NAMA_PELAPOR: 'Dian Pertiwi',
      NO_HP_PELAPOR: '085643219876',
      TANGGAL_LAHIR_VERIFIKASI: '1992-09-21',
      NIK_MASKED_PELAPOR: '330901******0001',
      KODE_GRUP: 'GENERAL_INQUIRY',
      ID_LAYANAN: 'GENERAL_INQUIRY',
      NAMA_LAYANAN: 'Saya Tidak Tahu (Perlu Klasifikasi)',
      JUDUL_LAPORAN: 'Air Sumur Keruh dan Berbau di Dekat Saluran Lama',
      MASALAH_UTAMA: 'Belum diklasifikasi',
      URAIAN_MASALAH: 'Saya sedang mengalami masalah air sumur warga di RT 01 RW 03 mendadak keruh sejak tiga hari terakhir, saya tidak tahu harus melapor ke layanan yang mana.',
      LOKASI_ALAMAT: 'Dusun Ngemplak Gang Mawar',
      RT_RW: 'RT 01 / RW 03',
      DATA_FORM_DINAMIS: {},
      STATUS_TERBARU: 'Laporan diterima',
      DRIVE_FOLDER_NAME: 'SW-2026-000005',
      DRIVE_FOLDER_URL: 'SIWARGA_DESA/01_LAPORAN_WARGA/SW-2026-000005',
      CREATED_AT: '2026-11-14T07:30:00.000Z',
      UPDATED_AT: '2026-11-14T07:30:00.000Z',
    },
  ];

  const tindakLanjut: SheetTindakLanjut[] = [
    {
      ID_UPDATE: 'UPD-0001',
      ID_LAPORAN: 'SW-2026-000001',
      TANGGAL_UPDATE: '2026-09-14',
      STATUS: 'Laporan diterima',
      KETERANGAN: 'Laporan warga diterima oleh sistem dan diteruskan ke Kasi Infrastruktur.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Sistem WARGA AMPEL',
      CREATED_AT: '2026-09-14T08:15:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0002',
      ID_LAPORAN: 'SW-2026-000001',
      TANGGAL_UPDATE: '2026-09-16',
      STATUS: 'Sedang dalam proses perbaikan',
      KETERANGAN: 'Tim teknis desa telah melakukan pengecekan lubang jalan dan penambalan aspal sepanjang 35 meter beserta pembersihan bahu jalan.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Hendra Wijaya',
      CREATED_AT: '2026-09-16T10:00:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0003',
      ID_LAPORAN: 'SW-2026-000001',
      TANGGAL_UPDATE: '2026-09-25',
      STATUS: 'Sudah diperbaiki atau ditangani',
      KETERANGAN: 'Pengaspalan dan perbaikan saluran tepi jalan Dusun Krajan Timur selesai dikerjakan dan aman dilalui.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Hendra Wijaya',
      CREATED_AT: '2026-09-25T15:30:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0004',
      ID_LAPORAN: 'SW-2026-000002',
      TANGGAL_UPDATE: '2026-10-18',
      STATUS: 'Laporan diterima',
      KETERANGAN: 'Laporan masuk dan diverifikasi petugas wilayah Sumberjo.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Rina Kusuma',
      CREATED_AT: '2026-10-18T09:20:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0005',
      ID_LAPORAN: 'SW-2026-000002',
      TANGGAL_UPDATE: '2026-10-28',
      STATUS: 'Sudah diusulkan ke dinas terkait',
      KETERANGAN: 'Karena gorong-gorong berada pada jalur jalan kabupaten, Kepala Desa telah mengirimkan surat usulan pengerukan dan rehabilitasi.',
      DINAS_TUJUAN: 'Dinas Pekerjaan Umum dan Penataan Ruang (PUPR) Kabupaten',
      NOMOR_SURAT: '600/142/DS-AMP/X/2026',
      PETUGAS: 'Hendra Wijaya',
      CREATED_AT: '2026-10-28T11:00:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0006',
      ID_LAPORAN: 'SW-2026-000003',
      TANGGAL_UPDATE: '2026-11-05',
      STATUS: 'Sedang ditindaklanjuti',
      KETERANGAN: 'Berkas pengajuan SKU sedang diverifikasi dan disiapkan untuk tanda tangan Kepala Desa.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '470/051/DS-AMP/XI/2026',
      PETUGAS: 'Rina Kusuma',
      CREATED_AT: '2026-11-05T10:15:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0007',
      ID_LAPORAN: 'SW-2026-000004',
      TANGGAL_UPDATE: '2026-11-11',
      STATUS: 'Sedang dalam proses perbaikan',
      KETERANGAN: 'Tim verifikasi bansos desa sedang melakukan kunjungan lapangan untuk pencocokan DTKS.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Siti Aminah',
      CREATED_AT: '2026-11-11T09:00:00.000Z',
    },
    {
      ID_UPDATE: 'UPD-0008',
      ID_LAPORAN: 'SW-2026-000005',
      TANGGAL_UPDATE: '2026-11-14',
      STATUS: 'Laporan diterima',
      KETERANGAN: 'Laporan umum diterima. Menunggu klasifikasi layanan oleh Operator Desa.',
      DINAS_TUJUAN: '',
      NOMOR_SURAT: '',
      PETUGAS: 'Sistem WARGA AMPEL',
      CREATED_AT: '2026-11-14T07:30:00.000Z',
    },
  ];

  const buktiDokumen = [
    {
      ID_BUKTI: 'BKT-0001',
      ID_LAPORAN: 'SW-2026-000001',
      ID_UPDATE: 'UPD-0001',
      NAMA_FILE: 'Foto_sebelum_perbaikan.jpg',
      MIME_TYPE: 'image/jpeg',
      UKURAN_BYTES: beforeSize,
      JENIS_BUKTI: 'Foto sebelum perbaikan' as const,
      DRIVE_FOLDER_SUB: t1Folder.subPath,
      DRIVE_FILE_ID: 'DRV-SEED-0001',
      DRIVE_URL: '/api/evidence/BKT-0001',
      TANGGAL_UPLOAD: '2026-09-14T08:15:00.000Z',
      DIUNGGAH_OLEH: 'Ibu Sri Wahyuni',
      VISIBILITAS: 'PUBLIK_WARGA' as const,
    },
    {
      ID_BUKTI: 'BKT-0002',
      ID_LAPORAN: 'SW-2026-000001',
      ID_UPDATE: 'UPD-0003',
      NAMA_FILE: 'Foto_sesudah_perbaikan.jpg',
      MIME_TYPE: 'image/jpeg',
      UKURAN_BYTES: afterSize,
      JENIS_BUKTI: 'Foto sesudah perbaikan' as const,
      DRIVE_FOLDER_SUB: t1Folder.subPath,
      DRIVE_FILE_ID: 'DRV-SEED-0002',
      DRIVE_URL: '/api/evidence/BKT-0002',
      TANGGAL_UPLOAD: '2026-09-25T15:30:00.000Z',
      DIUNGGAH_OLEH: 'Hendra Wijaya',
      VISIBILITAS: 'PUBLIK_WARGA' as const,
    },
  ];

  return {
    USERS: users,
    WARGA: warga,
    PETUGAS: petugas,
    LAPORAN: laporan,
    KATEGORI_LAYANAN: services,
    KONFIGURASI_FORM: forms,
    TINDAK_LANJUT: tindakLanjut,
    BUKTI_DOKUMEN: buktiDokumen,
    NOTIFIKASI: [
      {
        ID_NOTIFIKASI: 'NTF-001',
        TARGET_USER_ID: 'USR-WRG-01',
        TARGET_ROLE: 'WARGA',
        ID_LAPORAN: 'SW-2026-000001',
        JUDUL: 'Perbaikan Jalan Selesai',
        PESAN: 'Laporan SW-2026-000001 (Jalan rusak Dusun Krajan Timur) telah selesai ditangani beserta foto bukti.',
        DIBACA: false,
        CREATED_AT: '2026-09-25T15:35:00.000Z',
      },
      {
        ID_NOTIFIKASI: 'NTF-002',
        TARGET_USER_ID: 'USR-WRG-02',
        TARGET_ROLE: 'WARGA',
        ID_LAPORAN: 'SW-2026-000002',
        JUDUL: 'Usulan Dikirim ke Dinas PUPR',
        PESAN: 'Laporan SW-2026-000002 telah diusulkan ke Dinas PUPR Kabupaten dengan surat nomor 600/142/DS-AMP/X/2026.',
        DIBACA: false,
        CREATED_AT: '2026-10-28T11:05:00.000Z',
      },
      {
        ID_NOTIFIKASI: 'NTF-003',
        TARGET_USER_ID: 'ALL_STAFF',
        TARGET_ROLE: 'OPERATOR',
        ID_LAPORAN: 'SW-2026-000005',
        JUDUL: 'Laporan Baru Perlu Klasifikasi',
        PESAN: 'Warga mengirim laporan kategori "Saya Tidak Tahu" (SW-2026-000005). Mohon klasifikasi layanan.',
        DIBACA: false,
        CREATED_AT: '2026-11-14T07:31:00.000Z',
      },
    ],
    PENGUMUMAN: [
      {
        ID_PENGUMUMAN: 'PGM-001',
        JUDUL: 'Jadwal Pelayanan Administrasi Balai Desa Ampel',
        RINGKASAN: 'Pelayanan tatap muka buka Senin–Jumat pukul 08.00–14.30 WIB. Pengajuan online WARGA AMPEL aktif 24 jam.',
        ISI: 'Pemerintah Desa Ampel membuka layanan administrasi kependudukan, surat pengantar, dan konsultasi warga secara tatap muka setiap Senin hingga Jumat pukul 08.00–14.30 WIB. Warga tetap dapat mengirim laporan dan permohonan kapan saja melalui portal WARGA AMPEL.',
        KATEGORI: 'Jadwal Desa',
        TANGGAL_TERBIT: '2026-11-01',
        PENULIS: 'Sekretariat Desa Ampel',
        AKTIF: true,
      },
      {
        ID_PENGUMUMAN: 'PGM-002',
        JUDUL: 'Penyaluran Bantuan Pangan Beras Tahap IV Tahun 2026',
        RINGKASAN: 'Pengambilan bantuan dilaksanakan di Pendopo Balai Desa mulai pukul 08.30 WIB dengan membawa KTP dan KK asli.',
        ISI: 'Berdasarkan verifikasi data warga Desa Ampel, penyaluran Bantuan Pangan Tahap IV dilaksanakan bagi KPM terdaftar pada hari Kamis pekan ini di Pendopo Balai Desa Ampel. Warga lansia yang berhalangan hadir akan diantar oleh petugas dusun.',
        KATEGORI: 'Bantuan',
        TANGGAL_TERBIT: '2026-11-10',
        PENULIS: 'Kaur Sosial Desa Ampel',
        AKTIF: true,
      },
      {
        ID_PENGUMUMAN: 'PGM-003',
        JUDUL: 'Kerja Bakti Pembersihan Saluran Drainase Menjelang Musim Hujan',
        RINGKASAN: 'Dihimbau kepada seluruh Ketua RT/RW mengoordinasikan kerja bakti lingkungan pada Minggu pagi.',
        ISI: 'Untuk mencegah genangan di pemukiman warga, Pemerintah Desa Ampel mengajak seluruh warga bergotong royong membersihkan selokan dan saluran pembuangan air lingkungan pada hari Minggu pukul 07.00 WIB.',
        KATEGORI: 'Pembangunan',
        TANGGAL_TERBIT: '2026-11-12',
        PENULIS: 'Kasi Infrastruktur Desa Ampel',
        AKTIF: true,
      },
    ],
    PENGATURAN: [
      { KUNCI: 'NAMA_DESA', NILAI: 'Desa Ampel', KETERANGAN: 'Nama desa yang tampil di portal warga' },
      { KUNCI: 'TAHUN_TIKET', NILAI: '2026', KETERANGAN: 'Tahun aktif penomoran tiket SW-TAHUN-NOMOR' },
      { KUNCI: 'TICKET_COUNTER', NILAI: '5', KETERANGAN: 'Counter berurutan nomor tiket terakhir (dilindungi Lock)' },
      { KUNCI: 'MAX_FILE_MB', NILAI: '5', KETERANGAN: 'Batas maksimal ukuran file unggahan (MB)' },
      { KUNCI: 'SPREADSHEET_ID', NILAI: '1yGeHQ_rWh24fhTrK9NP19hO3L0TwoKXOVboczMAPhkY', KETERANGAN: 'ID Google Spreadsheet DATABASE_SIWARGA' },
      { KUNCI: 'DRIVE_ROOT_FOLDER_ID', NILAI: '1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx', KETERANGAN: 'ID Folder Induk Google Drive SIWARGA_DESA (Foto & Dokumen)' },
      { KUNCI: 'GAS_WEB_APP_URL', NILAI: 'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec', KETERANGAN: 'URL Web App Google Apps Script (/exec)' },
      { KUNCI: 'GAS_DEPLOYMENT_ID', NILAI: 'AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ', KETERANGAN: 'ID Penerapan Google Apps Script Web App' },
      { KUNCI: 'GAS_SYNC_ENABLED', NILAI: 'false', KETERANGAN: 'Aktifkan sinkronisasi langsung ke Google Apps Script Web App' },
      {
        KUNCI: 'ORG_PENGUMUMAN',
        NILAI: 'Kenali jajaran pemerintahan, LPMK, pengurus RW/RT, serta kader pelayanan di lingkungan Warga Ampel.',
        KETERANGAN: 'Pengumuman beranda pada Portal Struktur Organisasi Warga Ampel',
      },
      {
        KUNCI: 'ORG_URUTAN_BAGIAN',
        NILAI: JSON.stringify(['KELURAHAN', 'LPMK_RW_RT', 'KADER']),
        KETERANGAN: 'Urutan tampilan bagian beranda Struktur Organisasi',
      },
      {
        KUNCI: 'ORG_TAMPILKAN_BAGIAN',
        NILAI: JSON.stringify({ kelurahan: true, lpmk: true, rwRt: true, kader: true }),
        KETERANGAN: 'Kontrol tampil/sembunyikan tiap bagian Struktur Organisasi',
      },
    ],
    LOG_AKTIVITAS: [
      {
        ID_LOG: 'LOG-0001',
        WAKTU: '2026-09-25T15:30:00.000Z',
        ID_USER: 'USR-PTG-01',
        NAMA_PENGGUNA: 'Hendra Wijaya',
        ROLE: 'PETUGAS',
        AKSI: 'UPDATE_STATUS_SELESAI',
        ID_TERKAIT: 'SW-2026-000001',
        DETAIL: 'Menandai laporan SW-2026-000001 selesai dengan foto sesudah perbaikan.',
      },
      {
        ID_LOG: 'LOG-0002',
        WAKTU: '2026-10-28T11:00:00.000Z',
        ID_USER: 'USR-PTG-01',
        NAMA_PENGGUNA: 'Hendra Wijaya',
        ROLE: 'PETUGAS',
        AKSI: 'USULKAN_KE_DINAS',
        ID_TERKAIT: 'SW-2026-000002',
        DETAIL: 'Mengusulkan laporan SW-2026-000002 ke Dinas PUPR Kabupaten (Surat 600/142/DS-AMP/X/2026).',
      },
    ],
    ...createInitialOrgSeed(),
  };
}

function createInitialOrgSeed(): Pick<
  SiwargaDatabase,
  | 'ORG_KELURAHAN'
  | 'ORG_LPMK'
  | 'ORG_RW'
  | 'ORG_RT'
  | 'ORG_KADER'
  | 'ORG_SEKOLAH'
  | 'ORG_GURU'
  | 'ORG_BALAI_RW'
> {
  const now = '2026-09-01T08:00:00.000Z';
  return {
    ORG_KELURAHAN: [
      {
        ID_KELURAHAN: 'KEL-001',
        NAMA: 'H. Ahmad Fauzi, S.Sos.',
        JABATAN: 'Lurah / Kepala Desa Ampel',
        TINGKAT: 'LURAH',
        WILAYAH_TUGAS: 'Wilayah Desa / Kelurahan Ampel',
        NO_HP: '081234500101',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KELURAHAN: 'KEL-002',
        NAMA: 'Siti Nurhayati, S.AP.',
        JABATAN: 'Kasi Pemerintahan & Pelayanan Umum',
        TINGKAT: 'KASI',
        WILAYAH_TUGAS: 'Pelayanan Administrasi & Kependudukan',
        NO_HP: '081234500102',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KELURAHAN: 'KEL-003',
        NAMA: 'Bambang Hermanto, S.E.',
        JABATAN: 'Kasi Kesejahteraan & Pembangunan',
        TINGKAT: 'KASI',
        WILAYAH_TUGAS: 'Infrastruktur, Bantuan Sosial & Pemberdayaan',
        NO_HP: '081234500103',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KELURAHAN: 'KEL-004',
        NAMA: 'Dewi Kartika Sari',
        JABATAN: 'Staf Administrasi & Pelayanan Warga',
        TINGKAT: 'STAF',
        WILAYAH_TUGAS: 'Loket Surat & Pengaduan',
        NO_HP: '081234500104',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 4,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KELURAHAN: 'KEL-005',
        NAMA: 'Hendra Wijaya',
        JABATAN: 'Staf Lapangan & Sarana Prasarana',
        TINGKAT: 'STAF',
        WILAYAH_TUGAS: 'Penanganan Lapangan Lingkungan & Infrastruktur',
        NO_HP: '081234500105',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 5,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_LPMK: [
      {
        ID_LPMK: 'LPMK-001',
        NAMA: 'Drs. H. Mulyono',
        JABATAN: 'Ketua LPMK',
        BIDANG: 'Koordinasi Pemberdayaan Masyarakat',
        NO_HP: '081234500201',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_LPMK: 'LPMK-002',
        NAMA: 'Ir. Gunawan Prasetyo',
        JABATAN: 'Sekretaris LPMK',
        BIDANG: 'Perencanaan Pembangunan Partisipatif',
        NO_HP: '081234500202',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_LPMK: 'LPMK-003',
        NAMA: 'Hj. Endang Lestari',
        JABATAN: 'Bendahara & Bidang Sosial Budaya',
        BIDANG: 'Kegiatan Sosial & Kemasyarakatan',
        NO_HP: '081234500203',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_RW: [
      {
        ID_RW: 'RW-01',
        NOMOR_RW: 'RW 01',
        NAMA_KETUA: 'H. Sudirman',
        JABATAN: 'Ketua RW 01',
        WILAYAH_TUGAS: 'Dusun Krajan Utara (RW 01)',
        NO_HP: '081234500301',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_RW: 'RW-02',
        NOMOR_RW: 'RW 02',
        NAMA_KETUA: 'Supriyanto',
        JABATAN: 'Ketua RW 02',
        WILAYAH_TUGAS: 'Dusun Krajan Selatan (RW 02)',
        NO_HP: '081234500302',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_RT: [
      {
        ID_RT: 'RT-01-01',
        ID_RW: 'RW-01',
        NOMOR_RT: 'RT 01',
        NAMA_KETUA: 'Slamet Riyadi',
        JABATAN: 'Ketua RT 01 / RW 01',
        WILAYAH_TUGAS: 'Blok Masjid & Jalan Melati',
        NO_HP: '081234500401',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_RT: 'RT-01-02',
        ID_RW: 'RW-01',
        NOMOR_RT: 'RT 02',
        NAMA_KETUA: 'Agus Setiawan',
        JABATAN: 'Ketua RT 02 / RW 01',
        WILAYAH_TUGAS: 'Blok Pasar & Gang Kenanga',
        NO_HP: '081234500402',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_RT: 'RT-02-01',
        ID_RW: 'RW-02',
        NOMOR_RT: 'RT 01',
        NAMA_KETUA: 'M. Yusuf',
        JABATAN: 'Ketua RT 01 / RW 02',
        WILAYAH_TUGAS: 'Blok Sawah Timur',
        NO_HP: '081234500403',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_RT: 'RT-02-02',
        ID_RW: 'RW-02',
        NOMOR_RT: 'RT 02',
        NAMA_KETUA: 'Tri Wahyudi',
        JABATAN: 'Ketua RT 02 / RW 02',
        WILAYAH_TUGAS: 'Blok Lapangan Desa',
        NO_HP: '081234500404',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 4,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_KADER: [
      {
        ID_KADER: 'KDR-001',
        ID_RT: 'RT-01-01',
        NAMA: 'Nurul Hidayah',
        JABATAN: 'Kader Posyandu Balita',
        NO_HP: '081234500501',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KADER: 'KDR-002',
        ID_RT: 'RT-01-01',
        NAMA: 'Wulandari',
        JABATAN: 'Kader PKK & Jumantik',
        NO_HP: '081234500502',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KADER: 'KDR-003',
        ID_RT: 'RT-01-02',
        NAMA: 'Ratna Dewi',
        JABATAN: 'Kader Kesehatan Lansia',
        NO_HP: '081234500503',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KADER: 'KDR-004',
        ID_RT: 'RT-02-01',
        NAMA: 'Siti Aminah',
        JABATAN: 'Kader Posyandu & Gizi',
        NO_HP: '081234500504',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 4,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_KADER: 'KDR-005',
        ID_RT: 'RT-02-02',
        NAMA: 'Lilik Suryani',
        JABATAN: 'Kader Sosial & Pendataan',
        NO_HP: '081234500505',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 5,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_SEKOLAH: [
      {
        ID_SEKOLAH: 'SKL-001',
        NAMA_SEKOLAH: 'TK Dharma Wanita Ampel',
        JENJANG: 'PAUD / TK',
        KEPALA_SEKOLAH: 'Dra. Hj. Umi Kulsum',
        ALAMAT: 'Jl. Balai Desa No. 04, RW 01, Kelurahan Ampel',
        NO_HP: '081234500601',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_SEKOLAH: 'SKL-002',
        NAMA_SEKOLAH: 'SD Negeri Ampel 01',
        JENJANG: 'SD / MI',
        KEPALA_SEKOLAH: 'Sutrisno, S.Pd., M.Pd.',
        ALAMAT: 'Jl. Raya Ampel No. 18, Dusun Krajan Utara, RW 01',
        NO_HP: '081234500602',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_SEKOLAH: 'SKL-003',
        NAMA_SEKOLAH: 'MI Miftahul Huda Ampel',
        JENJANG: 'SD / MI',
        KEPALA_SEKOLAH: 'H. Abdul Rozak, S.Ag.',
        ALAMAT: 'Jl. Masjid Besar No. 09, RW 01, Kelurahan Ampel',
        NO_HP: '081234500603',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_SEKOLAH: 'SKL-004',
        NAMA_SEKOLAH: 'SMP Negeri 2 Ampel',
        JENJANG: 'SMP / MTs',
        KEPALA_SEKOLAH: 'Drs. Eko Prasetyo, M.Si.',
        ALAMAT: 'Jl. Lapangan Olahraga No. 02, Dusun Krajan Selatan, RW 02',
        NO_HP: '081234500604',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 4,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_GURU: [
      {
        ID_GURU: 'GRU-001',
        ID_SEKOLAH: 'SKL-001',
        NAMA: 'Dra. Hj. Umi Kulsum',
        JABATAN: 'Kepala TK & Guru Kelas TK B',
        NO_HP: '081234500701',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-002',
        ID_SEKOLAH: 'SKL-001',
        NAMA: 'Rini Puspitasari, S.Pd.AUD.',
        JABATAN: 'Guru Kelompok Bermain & TK A',
        NO_HP: '081234500702',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-003',
        ID_SEKOLAH: 'SKL-002',
        NAMA: 'Sutrisno, S.Pd., M.Pd.',
        JABATAN: 'Kepala Sekolah SDN Ampel 01',
        NO_HP: '081234500703',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 3,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-004',
        ID_SEKOLAH: 'SKL-002',
        NAMA: 'Sri Wahyuni, S.Pd.SD.',
        JABATAN: 'Wali Kelas I & Literasi Dasar',
        NO_HP: '081234500704',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 4,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-005',
        ID_SEKOLAH: 'SKL-002',
        NAMA: 'Ahmad Zaenuri, S.Pd.I.',
        JABATAN: 'Guru Pendidikan Agama Islam',
        NO_HP: '081234500705',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 5,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-006',
        ID_SEKOLAH: 'SKL-002',
        NAMA: 'Budi Santoso, S.Or.',
        JABATAN: 'Guru PJOK / Olahraga',
        NO_HP: '081234500706',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 6,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-007',
        ID_SEKOLAH: 'SKL-003',
        NAMA: 'H. Abdul Rozak, S.Ag.',
        JABATAN: 'Kepala Madrasah & Guru Fiqih',
        NO_HP: '081234500707',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 7,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-008',
        ID_SEKOLAH: 'SKL-003',
        NAMA: 'Lailatul Fitria, S.Pd.',
        JABATAN: 'Guru Bahasa Arab & Kelas IV',
        NO_HP: '081234500708',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 8,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-009',
        ID_SEKOLAH: 'SKL-004',
        NAMA: 'Drs. Eko Prasetyo, M.Si.',
        JABATAN: 'Kepala Sekolah SMPN 2 Ampel',
        NO_HP: '081234500709',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 9,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_GURU: 'GRU-010',
        ID_SEKOLAH: 'SKL-004',
        NAMA: 'Indah Permatasari, S.Pd.',
        JABATAN: 'Guru Matematika & BK',
        NO_HP: '081234500710',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 10,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
    ORG_BALAI_RW: [
      {
        ID_BALAI: 'BLI-001',
        ID_RW: 'RW-01',
        NAMA_BALAI: 'Balai RW 01 Dusun Krajan Utara',
        ALAMAT: 'Jl. Melati No. 14, RT 01 / RW 01, Kelurahan Ampel',
        JAM_LAYANAN: 'Senin–Sabtu, 08.00–16.00 WIB (Posyandu & Musyawarah RW)',
        NO_HP: '081234500301',
        TAMPILKAN_HP: true,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 1,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
      {
        ID_BALAI: 'BLI-002',
        ID_RW: 'RW-02',
        NAMA_BALAI: 'Balai RW 02 Dusun Krajan Selatan',
        ALAMAT: 'Jl. Lapangan Desa No. 07, RT 02 / RW 02, Kelurahan Ampel',
        JAM_LAYANAN: 'Senin–Jumat, 08.30–15.30 WIB (Pendataan & Rapat Warga)',
        NO_HP: '081234500302',
        TAMPILKAN_HP: false,
        TAMPILKAN_PUBLIK: true,
        AKTIF: true,
        URUTAN: 2,
        CREATED_AT: now,
        UPDATED_AT: now,
      },
    ],
  };
}

let cachedDb: SiwargaDatabase | null = null;

export function loadDatabase(): SiwargaDatabase {
  ensureDriveStructure();
  if (cachedDb) return cachedDb;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
    cachedDb = initial;
    return cachedDb;
  }
  const raw = fs.readFileSync(DB_FILE, 'utf8');
  const parsed = JSON.parse(raw) as SiwargaDatabase;
  let mutated = false;
  // Auto-hydrate organization tabs if migrating an existing JSON DB
  if (
    !parsed.ORG_KELURAHAN ||
    !parsed.ORG_LPMK ||
    !parsed.ORG_RW ||
    !parsed.ORG_RT ||
    !parsed.ORG_KADER ||
    !parsed.ORG_SEKOLAH ||
    !parsed.ORG_GURU ||
    !parsed.ORG_BALAI_RW
  ) {
    const orgSeed = createInitialOrgSeed();
    parsed.ORG_KELURAHAN = parsed.ORG_KELURAHAN || orgSeed.ORG_KELURAHAN;
    parsed.ORG_LPMK = parsed.ORG_LPMK || orgSeed.ORG_LPMK;
    parsed.ORG_RW = parsed.ORG_RW || orgSeed.ORG_RW;
    parsed.ORG_RT = parsed.ORG_RT || orgSeed.ORG_RT;
    parsed.ORG_KADER = parsed.ORG_KADER || orgSeed.ORG_KADER;
    parsed.ORG_SEKOLAH = parsed.ORG_SEKOLAH || orgSeed.ORG_SEKOLAH;
    parsed.ORG_GURU = parsed.ORG_GURU || orgSeed.ORG_GURU;
    parsed.ORG_BALAI_RW = parsed.ORG_BALAI_RW || orgSeed.ORG_BALAI_RW;
    mutated = true;
  }
  const driveSetting = parsed.PENGATURAN?.find((p) => p.KUNCI === 'DRIVE_ROOT_FOLDER_ID');
  if (driveSetting && (!driveSetting.NILAI || driveSetting.NILAI === '105o5hBhSGAUI_ckmVFADFTLbhqScmFIy')) {
    driveSetting.NILAI = '1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx';
    mutated = true;
  }
  const sheetSetting = parsed.PENGATURAN?.find((p) => p.KUNCI === 'SPREADSHEET_ID');
  if (
    sheetSetting &&
    (!sheetSetting.NILAI ||
      sheetSetting.NILAI === 'DATABASE_SIWARGA_CONTOH_ID' ||
      sheetSetting.NILAI.includes('GANTI_DENGAN'))
  ) {
    sheetSetting.NILAI = '1yGeHQ_rWh24fhTrK9NP19hO3L0TwoKXOVboczMAPhkY';
    mutated = true;
  }
  const gasUrlSetting = parsed.PENGATURAN?.find((p) => p.KUNCI === 'GAS_WEB_APP_URL');
  const targetGasUrl = 'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec';
  const oldGasUrl = 'https://script.google.com/macros/s/AKfycbz898DjJanfBIwZxbm6cMq6hbIr5Gkd9eREGpJ-uBVeU3jVRwBpNvHKoLT4JLwncwh-lw/exec';
  if (gasUrlSetting && (!gasUrlSetting.NILAI || gasUrlSetting.NILAI === oldGasUrl)) {
    gasUrlSetting.NILAI = targetGasUrl;
    mutated = true;
  }
  const gasDeploySetting = parsed.PENGATURAN?.find((p) => p.KUNCI === 'GAS_DEPLOYMENT_ID');
  const targetDeployId = 'AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ';
  if (!gasDeploySetting && parsed.PENGATURAN) {
    parsed.PENGATURAN.push({
      KUNCI: 'GAS_DEPLOYMENT_ID',
      NILAI: targetDeployId,
      KETERANGAN: 'ID Penerapan Google Apps Script Web App',
    });
    mutated = true;
  } else if (gasDeploySetting && gasDeploySetting.NILAI === 'AKfycbz898DjJanfBIwZxbm6cMq6hbIr5Gkd9eREGpJ-uBVeU3jVRwBpNvHKoLT4JLwncwh-lw') {
    gasDeploySetting.NILAI = targetDeployId;
    mutated = true;
  }
  if (mutated) {
    fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf8');
  }
  cachedDb = parsed;
  return cachedDb;
}

export function saveDatabase(db: SiwargaDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  cachedDb = db;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export function getSettingValue(db: SiwargaDatabase, key: string, fallback = ''): string {
  const row = db.PENGATURAN.find((p) => p.KUNCI === key);
  return row ? row.NILAI : fallback;
}

export function setSettingValue(db: SiwargaDatabase, key: string, value: string): void {
  const row = db.PENGATURAN.find((p) => p.KUNCI === key);
  if (row) {
    row.NILAI = value;
  } else {
    db.PENGATURAN.push({ KUNCI: key, NILAI: value, KETERANGAN: '' });
  }
}

export function appendActivityLog(
  db: SiwargaDatabase,
  actor: { idUser: string; nama: string; role: string },
  aksi: string,
  idTerkait: string,
  detail: string
): void {
  db.LOG_AKTIVITAS.unshift({
    ID_LOG: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    WAKTU: new Date().toISOString(),
    ID_USER: actor.idUser,
    NAMA_PENGGUNA: actor.nama,
    ROLE: actor.role,
    AKSI: aksi,
    ID_TERKAIT: idTerkait,
    DETAIL: detail,
  });
}
