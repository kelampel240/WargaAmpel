export type UserRole = 'WARGA' | 'PETUGAS' | 'OPERATOR' | 'KEPALA_DESA' | 'SUPER_ADMIN';

export const REPORT_STATUSES = [
  'Laporan diterima',
  'Sedang ditindaklanjuti',
  'Sedang dalam proses perbaikan',
  'Sudah diusulkan ke dinas terkait',
  'Menunggu tindak lanjut dinas',
  'Sudah diperbaiki atau ditangani',
  'Tidak dapat ditindaklanjuti',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const SERVICE_GROUPS = [
  'A. Pengaduan',
  'B. Bantuan',
  'C. Administrasi',
] as const;

export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

export const EVIDENCE_TYPES = [
  'Foto sebelum perbaikan',
  'Foto proses',
  'Foto sesudah perbaikan',
  'Surat usulan ke dinas',
  'Bukti pengiriman surat',
  'Tanda terima',
  'Surat balasan dinas',
  'Dokumen pendukung lainnya',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type EvidenceVisibility = 'PUBLIK_WARGA' | 'INTERNAL_DESA';

export const FORM_FIELD_TYPES = [
  'text',
  'textarea',
  'dropdown',
  'radio',
  'checkbox',
  'date',
  'photo',
  'pdf',
  'location',
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface SheetUser {
  ID_USER: string;
  USERNAME: string;
  NAMA_LENGKAP: string;
  EMAIL: string;
  NO_HP: string;
  PASSWORD_HASH: string;
  ROLE: UserRole;
  STATUS_AKUN: 'AKTIF' | 'MENUNGGU_VERIFIKASI' | 'NONAKTIF';
  KODE_VERIFIKASI?: string;
  RESET_TOKEN?: string;
  CREATED_AT: string;
}

export interface SheetWarga {
  ID_WARGA: string;
  ID_USER?: string;
  NAMA_LENGKAP: string;
  NIK_MASKED: string;
  NIK_HASH: string;
  KK_MASKED: string;
  TANGGAL_LAHIR: string; // YYYY-MM-DD
  ALAMAT: string;
  RT_RW: string;
  NO_HP: string;
  STATUS_VERIFIKASI: 'TERVERIFIKASI' | 'MENUNGGU_VERIFIKASI' | 'DITOLAK';
  CREATED_AT: string;
}

export interface SheetPetugas {
  ID_PETUGAS: string;
  ID_USER: string;
  NAMA_PETUGAS: string;
  JABATAN: string;
  BIDANG_TUGAS: string;
  NO_HP: string;
  STATUS: 'AKTIF' | 'NONAKTIF';
  CREATED_AT: string;
}

export interface SheetKategoriLayanan {
  ID_LAYANAN: string;
  KODE_LAYANAN: string;
  NAMA_LAYANAN: string;
  KATEGORI_GRUP: ServiceGroup;
  DESKRIPSI: string;
  IKON: string;
  PERSYARATAN_DOKUMEN: string;
  ID_PETUGAS_PJ: string;
  NAMA_PETUGAS_PJ: string;
  ALUR_STATUS: ReportStatus[];
  STATUS_AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
}

export interface SheetKonfigurasiForm {
  ID_FIELD: string;
  ID_LAYANAN: string;
  LABEL_PERTANYAAN: string;
  TIPE_ISIAN: FormFieldType;
  OPSI_PILIHAN: string[]; // For dropdown, radio, checkbox
  WAJIB: boolean;
  PLACEHOLDER: string;
  URUTAN: number;
}

export interface SheetLaporan {
  ID_LAPORAN: string; // e.g. SW-2026-000001
  ID_WARGA?: string;
  ID_USER_PELAPOR?: string;
  NAMA_PELAPOR: string;
  NO_HP_PELAPOR: string;
  TANGGAL_LAHIR_VERIFIKASI: string; // YYYY-MM-DD used for tracking identity verification
  NIK_MASKED_PELAPOR?: string;
  KODE_GRUP: ServiceGroup | 'GENERAL_INQUIRY';
  ID_LAYANAN: string;
  NAMA_LAYANAN: string;
  JUDUL_LAPORAN: string;
  MASALAH_UTAMA: string;
  URAIAN_MASALAH: string;
  LOKASI_ALAMAT: string;
  RT_RW: string;
  DATA_FORM_DINAMIS: Record<string, string | string[]>;
  STATUS_TERBARU: ReportStatus;
  ID_PETUGAS_TUGAS?: string;
  NAMA_PETUGAS_TUGAS?: string;
  ALASAN_TIDAK_DITINDAKLANJUTI?: string;
  DRIVE_FOLDER_NAME: string;
  DRIVE_FOLDER_URL: string;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetTindakLanjut {
  ID_UPDATE: string;
  ID_LAPORAN: string;
  TANGGAL_UPDATE: string;
  STATUS: ReportStatus;
  KETERANGAN: string;
  DINAS_TUJUAN: string;
  NOMOR_SURAT: string;
  PETUGAS: string;
  CREATED_AT: string;
}

export interface SheetBuktiDokumen {
  ID_BUKTI: string;
  ID_LAPORAN: string;
  ID_UPDATE: string;
  NAMA_FILE: string;
  MIME_TYPE: string;
  UKURAN_BYTES: number;
  JENIS_BUKTI: EvidenceType;
  DRIVE_FOLDER_SUB: string;
  DRIVE_FILE_ID: string;
  DRIVE_URL: string;
  TANGGAL_UPLOAD: string;
  DIUNGGAH_OLEH: string;
  VISIBILITAS: EvidenceVisibility;
}

export interface SheetNotifikasi {
  ID_NOTIFIKASI: string;
  TARGET_USER_ID: string;
  TARGET_ROLE: UserRole | 'ALL';
  ID_LAPORAN?: string;
  JUDUL: string;
  PESAN: string;
  DIBACA: boolean;
  CREATED_AT: string;
}

export interface SheetPengumuman {
  ID_PENGUMUMAN: string;
  JUDUL: string;
  RINGKASAN: string;
  ISI: string;
  KATEGORI: 'Pelayanan' | 'Pembangunan' | 'Bantuan' | 'Jadwal Desa';
  TANGGAL_TERBIT: string;
  PENULIS: string;
  AKTIF: boolean;
}

export interface SheetPengaturan {
  KUNCI: string;
  NILAI: string;
  KETERANGAN: string;
}

export interface SheetLogAktivitas {
  ID_LOG: string;
  WAKTU: string;
  ID_USER: string;
  NAMA_PENGGUNA: string;
  ROLE: string;
  AKSI: string;
  ID_TERKAIT: string;
  DETAIL: string;
}

export const PROGRAM_STATUS_OPTIONS = ['Akan Datang', 'Berjalan', 'Selesai'] as const;
export type ProgramStatus = (typeof PROGRAM_STATUS_OPTIONS)[number];

export interface SheetBanner {
  ID_BANNER: string;
  JUDUL: string;
  KALIMAT_SAMBUTAN: string;
  GAMBAR_URL: string;
  DRIVE_FILE_ID?: string;
  AKTIF: boolean;
  UPDATED_AT: string;
  UPDATED_BY?: string;
}

export interface SheetProgram {
  ID_PROGRAM: string;
  JUDUL: string;
  TANGGAL: string;
  RINGKASAN: string;
  STATUS: ProgramStatus;
  FOTO_URL: string;
  DRIVE_FILE_ID?: string;
  URUTAN: number;
  AKTIF: boolean;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetGaleri {
  ID_GALERI: string;
  JUDUL: string;
  KETERANGAN: string;
  TANGGAL: string;
  FOTO_URL: string;
  DRIVE_FILE_ID?: string;
  URUTAN: number;
  AKTIF: boolean;
  CREATED_AT: string;
}

export interface BerandaFooterInfo {
  namaKantor: string;
  alamat: string;
  telepon: string;
  email: string;
  jamLayanan: string;
}

export interface BerandaStats {
  programBerjalan: number;
  pengaduanSelesaiBulanIni: number;
  totalProgram: number;
}

export interface PublicBerandaResponse {
  banner: SheetBanner | null;
  program: SheetProgram[];
  galeri: SheetGaleri[];
  pengumuman: SheetPengumuman[];
  stats: BerandaStats;
  footer: BerandaFooterInfo;
  updatedAt: string;
}

export type OrgKelurahanLevel = 'LURAH' | 'KASI' | 'STAF';

export interface SheetOrgKelurahan {
  ID_KELURAHAN: string;
  NAMA: string;
  JABATAN: string;
  TINGKAT: OrgKelurahanLevel;
  WILAYAH_TUGAS?: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export const TP_PKK_JABATAN_OPTIONS = [
  'Pembina PKK',
  'Ketua PKK',
  'Wakil PKK',
  'Sekretaris PKK',
  'Bendahara PKK',
  'Ketua POKJA I',
  'Ketua POKJA II',
  'Ketua POKJA III',
  'Ketua POKJA IV',
  'Wakil POKJA I',
  'Wakil POKJA II',
  'Wakil POKJA III',
  'Wakil POKJA IV',
  'Sekretaris POKJA I',
  'Sekretaris POKJA II',
  'Sekretaris POKJA III',
  'Sekretaris POKJA IV',
  'Anggota POKJA I',
  'Anggota POKJA II',
  'Anggota POKJA III',
  'Anggota POKJA IV',
] as const;

export interface SheetOrgTpPkk {
  ID_PKK: string;
  NAMA: string;
  JABATAN: string;
  POKJA?: string;
  BIDANG?: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgLpmk {
  ID_LPMK: string;
  NAMA: string;
  JABATAN: string;
  BIDANG?: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgRw {
  ID_RW: string;
  NOMOR_RW: string;
  NAMA_KETUA: string;
  JABATAN: string;
  WILAYAH_TUGAS: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgRt {
  ID_RT: string;
  ID_RW: string;
  NOMOR_RT: string;
  NAMA_KETUA: string;
  JABATAN: string;
  WILAYAH_TUGAS: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgKader {
  ID_KADER: string;
  ID_RT: string;
  NAMA: string;
  JABATAN: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export type SchoolJenjang =
  | 'PAUD / TK'
  | 'SD / MI'
  | 'SMP / MTs'
  | 'SMA / SMK'
  | 'TPQ / Madrasah';

export interface SheetOrgSekolah {
  ID_SEKOLAH: string;
  NAMA_SEKOLAH: string;
  JENJANG: SchoolJenjang;
  KEPALA_SEKOLAH?: string;
  ALAMAT: string;
  MAPS_URL?: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgGuru {
  ID_GURU: string;
  ID_SEKOLAH: string;
  NAMA: string;
  JABATAN: string; // Mata pelajaran / jabatan mengajar
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export interface SheetOrgBalaiRw {
  ID_BALAI: string;
  ID_RW: string;
  NAMA_BALAI: string;
  ALAMAT: string;
  JAM_LAYANAN?: string;
  MAPS_URL?: string;
  FOTO_URL?: string;
  NO_HP?: string;
  TAMPILKAN_HP: boolean;
  TAMPILKAN_PUBLIK: boolean;
  AKTIF: boolean;
  URUTAN: number;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export type OrgSectionKey =
  | 'KELURAHAN'
  | 'TP_PKK'
  | 'LPMK_RW_RT'
  | 'KADER'
  | 'SEKOLAH_GURU'
  | 'BALAI_RW';

export interface OrgPublicProfile {
  id: string;
  kategori:
    | 'KELURAHAN'
    | 'TP_PKK'
    | 'LPMK'
    | 'RW'
    | 'RT'
    | 'KADER'
    | 'SEKOLAH'
    | 'GURU'
    | 'BALAI_RW';
  nama: string;
  jabatan: string;
  tingkat?: OrgKelurahanLevel;
  pokja?: string;
  bidang?: string;
  wilayahTugas?: string;
  nomorRw?: string;
  nomorRt?: string;
  idRw?: string;
  idRt?: string;
  idSekolah?: string;
  namaSekolah?: string;
  jenjang?: SchoolJenjang;
  kepalaSekolah?: string;
  alamat?: string;
  jamLayanan?: string;
  mapsUrl?: string;
  fotoUrl?: string;
  noHp?: string;
  waUrl?: string | null;
  tampilkanHp: boolean;
  urutan: number;
}

export interface PublicOrgStructureResponse {
  kelurahan: OrgPublicProfile[];
  tpPkk: OrgPublicProfile[];
  lpmk: OrgPublicProfile[];
  rw: OrgPublicProfile[];
  rt: OrgPublicProfile[];
  kader: OrgPublicProfile[];
  sekolah: OrgPublicProfile[];
  guru: OrgPublicProfile[];
  balaiRw: OrgPublicProfile[];
  displaySettings: {
    pengumumanBeranda: string;
    urutanBagian: OrgSectionKey[];
    tampilkanBagian: {
      kelurahan: boolean;
      tpPkk: boolean;
      lpmk: boolean;
      rwRt: boolean;
      kader: boolean;
      sekolahGuru: boolean;
      balaiRw: boolean;
    };
  };
}

export interface AdminOrgStructureResponse {
  kelurahan: SheetOrgKelurahan[];
  tpPkk: SheetOrgTpPkk[];
  lpmk: SheetOrgLpmk[];
  rw: SheetOrgRw[];
  rt: SheetOrgRt[];
  kader: SheetOrgKader[];
  sekolah: SheetOrgSekolah[];
  guru: SheetOrgGuru[];
  balaiRw: SheetOrgBalaiRw[];
  displaySettings: PublicOrgStructureResponse['displaySettings'];
  summary: {
    totalLurah: number;
    totalKasi: number;
    totalStaf: number;
    totalTpPkk: number;
    totalLpmk: number;
    totalRw: number;
    totalRt: number;
    totalKader: number;
    totalSekolah: number;
    totalGuru: number;
    totalBalaiRw: number;
  };
}

export interface SiwargaDatabase {
  USERS: SheetUser[];
  WARGA: SheetWarga[];
  PETUGAS: SheetPetugas[];
  LAPORAN: SheetLaporan[];
  KATEGORI_LAYANAN: SheetKategoriLayanan[];
  KONFIGURASI_FORM: SheetKonfigurasiForm[];
  TINDAK_LANJUT: SheetTindakLanjut[];
  BUKTI_DOKUMEN: SheetBuktiDokumen[];
  NOTIFIKASI: SheetNotifikasi[];
  PENGUMUMAN: SheetPengumuman[];
  PENGATURAN: SheetPengaturan[];
  LOG_AKTIVITAS: SheetLogAktivitas[];
  ORG_KELURAHAN: SheetOrgKelurahan[];
  ORG_TP_PKK: SheetOrgTpPkk[];
  ORG_LPMK: SheetOrgLpmk[];
  ORG_RW: SheetOrgRw[];
  ORG_RT: SheetOrgRt[];
  ORG_KADER: SheetOrgKader[];
  ORG_SEKOLAH: SheetOrgSekolah[];
  ORG_GURU: SheetOrgGuru[];
  ORG_BALAI_RW: SheetOrgBalaiRw[];
  BANNER?: SheetBanner[];
  PROGRAM?: SheetProgram[];
  GALERI?: SheetGaleri[];
  CONTOH_FILE?: SheetContohFile[];
}

export interface PublicUserSession {
  idUser: string;
  username: string;
  namaLengkap: string;
  role: UserRole;
  noHp: string;
  statusAkun: string;
  idWarga?: string;
  nikMasked?: string;
  tanggalLahir?: string;
  rtRw?: string;
  alamat?: string;
}

export interface ServiceWithForm extends SheetKategoriLayanan {
  fields: SheetKonfigurasiForm[];
}

export interface CitizenTrackingResponse {
  idLaporan: string;
  judulLaporan: string;
  namaLayanan: string;
  kodeGrup: string;
  statusTerbaru: ReportStatus;
  pesanKhususDinas: string | null;
  alasanPenolakan: string | null;
  tanggalLaporan: string;
  lokasiRingkas: string;
  petugasPenanggungJawab: string;
  riwayatTindakLanjut: Array<{
    idUpdate: string;
    tanggalUpdate: string;
    status: ReportStatus;
    keterangan: string;
    dinasTujuan: string;
    nomorSurat: string;
    petugas: string;
  }>;
  buktiPublik: Array<{
    idBukti: string;
    idUpdate: string;
    namaFile: string;
    mimeType: string;
    jenisBukti: EvidenceType;
    tanggalUpload: string;
    previewUrl: string;
  }>;
}

export interface AdminDashboardStats {
  totalLaporan: number;
  laporanBaru: number;
  menungguPenanganan: number;
  sedangDiproses: number;
  diusulkanKeDinas: number;
  selesai: number;
  tidakDapatDitindaklanjuti: number;
  totalWarga: number;
  totalPetugas: number;
  monthlyIncoming: Array<{ label: string; count: number }>;
  topCategories: Array<{ label: string; count: number }>;
  statusDistribution: Array<{ label: string; count: number }>;
  completedVsUnfinished: { selesai: number; belumSelesai: number };
}

export interface SheetContohFile {
  ID_FILE: string;
  ID_LAYANAN: string; // 'UMUM' or specific ID_LAYANAN
  NAMA_LAYANAN: string;
  JUDUL_FILE: string;
  KETERANGAN: string;
  NAMA_FILE_ASLI: string;
  MIME_TYPE: string;
  UKURAN_BYTES: number;
  FILE_URL: string;
  PREVIEW_URL?: string;
  DRIVE_FILE_ID?: string;
  URUTAN: number;
  AKTIF: boolean;
  CREATED_AT: string;
  UPDATED_AT?: string;
  UPLOADED_BY?: string;
}
