/**
 * ============================================================================
 * SIWARGA DESA AMPEL - SKRIP PEMBUATAN DATABASE GOOGLE SHEETS (SetupDatabase.gs)
 * ============================================================================
 * Jalankan fungsi setupDatabase() satu kali pada Google Apps Script Editor
 * setelah mengisi SPREADSHEET_ID pada file Code.gs.
 */

function setupDatabase() {
  var ss = getSpreadsheet_();
  Logger.log('Menggunakan Spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ') -> ' + ss.getUrl());

  var schemas = {
    USERS: [
      'ID_USER', 'USERNAME', 'NAMA_LENGKAP', 'EMAIL', 'NO_HP',
      'PASSWORD_HASH', 'ROLE', 'STATUS_AKUN', 'KODE_VERIFIKASI', 'CREATED_AT'
    ],
    WARGA: [
      'ID_WARGA', 'ID_USER', 'NAMA_LENGKAP', 'NIK_MASKED', 'NIK_HASH',
      'KK_MASKED', 'TANGGAL_LAHIR', 'ALAMAT', 'RT_RW', 'NO_HP',
      'STATUS_VERIFIKASI', 'CREATED_AT'
    ],
    PETUGAS: [
      'ID_PETUGAS', 'ID_USER', 'NAMA_PETUGAS', 'JABATAN', 'BIDANG_TUGAS',
      'NO_HP', 'STATUS', 'CREATED_AT'
    ],
    LAPORAN: [
      'ID_LAPORAN', 'ID_WARGA', 'ID_USER_PELAPOR', 'NAMA_PELAPOR',
      'NO_HP_PELAPOR', 'TANGGAL_LAHIR_VERIFIKASI', 'NIK_MASKED_PELAPOR',
      'KODE_GRUP', 'ID_LAYANAN', 'NAMA_LAYANAN', 'JUDUL_LAPORAN',
      'MASALAH_UTAMA', 'URAIAN_MASALAH', 'LOKASI_ALAMAT', 'RT_RW',
      'DATA_FORM_DINAMIS', 'STATUS_TERBARU', 'ID_PETUGAS_TUGAS',
      'NAMA_PETUGAS_TUGAS', 'DRIVE_FOLDER_NAME', 'DRIVE_FOLDER_URL',
      'CREATED_AT', 'UPDATED_AT'
    ],
    KATEGORI_LAYANAN: [
      'ID_LAYANAN', 'KODE_LAYANAN', 'NAMA_LAYANAN', 'KATEGORI_GRUP',
      'DESKRIPSI', 'IKON', 'PERSYARATAN_DOKUMEN', 'ID_PETUGAS_PJ',
      'NAMA_PETUGAS_PJ', 'ALUR_STATUS', 'STATUS_AKTIF', 'URUTAN', 'CREATED_AT'
    ],
    KONFIGURASI_FORM: [
      'ID_FIELD', 'ID_LAYANAN', 'LABEL_PERTANYAAN', 'TIPE_ISIAN',
      'OPSI_PILIHAN', 'WAJIB', 'PLACEHOLDER', 'URUTAN'
    ],
    TINDAK_LANJUT: [
      'ID_UPDATE', 'ID_LAPORAN', 'TANGGAL_UPDATE', 'STATUS', 'KETERANGAN',
      'DINAS_TUJUAN', 'NOMOR_SURAT', 'PETUGAS', 'CREATED_AT'
    ],
    BUKTI_DOKUMEN: [
      'ID_BUKTI', 'ID_LAPORAN', 'ID_UPDATE', 'NAMA_FILE', 'JENIS_BUKTI',
      'DRIVE_FILE_ID', 'DRIVE_URL', 'TANGGAL_UPLOAD', 'DIUNGGAH_OLEH', 'VISIBILITAS'
    ],
    NOTIFIKASI: [
      'ID_NOTIFIKASI', 'TARGET_USER_ID', 'TARGET_ROLE', 'ID_LAPORAN',
      'JUDUL', 'PESAN', 'DIBACA', 'CREATED_AT'
    ],
    PENGUMUMAN: [
      'ID_PENGUMUMAN', 'JUDUL', 'RINGKASAN', 'ISI', 'KATEGORI',
      'TANGGAL_TERBIT', 'PENULIS', 'AKTIF'
    ],
    PENGATURAN: ['KUNCI', 'NILAI', 'KETERANGAN'],
    LOG_AKTIVITAS: [
      'ID_LOG', 'WAKTU', 'ID_USER', 'NAMA_PENGGUNA', 'ROLE',
      'AKSI', 'ID_TERKAIT', 'DETAIL'
    ],
    ORG_KELURAHAN: [
      'ID_KELURAHAN', 'NAMA', 'JABATAN', 'TINGKAT', 'WILAYAH_TUGAS',
      'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF',
      'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_LPMK: [
      'ID_LPMK', 'NAMA', 'JABATAN', 'BIDANG', 'FOTO_URL', 'NO_HP',
      'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_RW: [
      'ID_RW', 'NOMOR_RW', 'NAMA_KETUA', 'JABATAN', 'WILAYAH_TUGAS',
      'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF',
      'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_RT: [
      'ID_RT', 'ID_RW', 'NOMOR_RT', 'NAMA_KETUA', 'JABATAN', 'WILAYAH_TUGAS',
      'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF',
      'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_KADER: [
      'ID_KADER', 'ID_RT', 'NAMA', 'JABATAN', 'FOTO_URL', 'NO_HP',
      'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_SEKOLAH: [
      'ID_SEKOLAH', 'NAMA_SEKOLAH', 'JENJANG', 'KEPALA_SEKOLAH', 'ALAMAT',
      'MAPS_URL', 'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK',
      'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_GURU: [
      'ID_GURU', 'ID_SEKOLAH', 'NAMA', 'JABATAN', 'FOTO_URL', 'NO_HP',
      'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK', 'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ],
    ORG_BALAI_RW: [
      'ID_BALAI', 'ID_RW', 'NAMA_BALAI', 'ALAMAT', 'JAM_LAYANAN',
      'MAPS_URL', 'FOTO_URL', 'NO_HP', 'TAMPILKAN_HP', 'TAMPILKAN_PUBLIK',
      'AKTIF', 'URUTAN', 'CREATED_AT', 'UPDATED_AT'
    ]
  };

  Object.keys(schemas).forEach(function(tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) {
      sh = ss.insertSheet(tabName);
    }
    if (sh.getLastRow() === 0) {
      sh.appendRow(schemas[tabName]);
      sh.getRange(1, 1, 1, schemas[tabName].length)
        .setFontWeight('bold')
        .setBackground('#0F2942')
        .setFontColor('#FFFFFF');
      sh.setFrozenRows(1);
    }
  });

  // Seed pengaturan dasar
  var shPengaturan = ss.getSheetByName('PENGATURAN');
  if (shPengaturan.getLastRow() <= 1) {
    shPengaturan.appendRow(['NAMA_DESA', CONFIG.NAMA_DESA, 'Nama desa']);
    shPengaturan.appendRow(['TAHUN_TIKET', String(new Date().getFullYear()), 'Tahun penomoran tiket']);
    shPengaturan.appendRow(['TICKET_COUNTER', '0', 'Counter nomor tiket berurutan']);
    shPengaturan.appendRow(['MAX_FILE_MB', '5', 'Batas ukuran file unggahan']);
    shPengaturan.appendRow(['DRIVE_ROOT_FOLDER_ID', CONFIG.ROOT_FOLDER_ID, 'ID Folder Google Drive SIWARGA_DESA']);
  }

  // Seed Super Admin default (Password: AdminAmpel2026!)
  var shUsers = ss.getSheetByName('USERS');
  if (shUsers.getLastRow() <= 1) {
    var salt = 'siwarga2026';
    var passHash = salt + ':' + hashSha256_('AdminAmpel2026!', salt);
    shUsers.appendRow([
      'USR-ADMIN-01', 'admin', 'Super Admin Desa Ampel', 'admin@ampel.desa.id',
      '081100000001', passHash, 'SUPER_ADMIN', 'AKTIF', '', new Date().toISOString()
    ]);
  }

  // Seed Petugas default
  var shPetugas = ss.getSheetByName('PETUGAS');
  if (shPetugas.getLastRow() <= 1) {
    shPetugas.appendRow([
      'PTG-001', 'USR-ADMIN-01', 'Petugas Layanan Desa Ampel', 'Petugas Lapangan & Pelayanan',
      'Pengaduan, Bantuan & Administrasi', '081100000001', 'AKTIF', new Date().toISOString()
    ]);
  }

  // Seed Pengumuman awal
  var shPengumuman = ss.getSheetByName('PENGUMUMAN');
  if (shPengumuman.getLastRow() <= 1) {
    var todayStr = new Date().toISOString().slice(0, 10);
    shPengumuman.appendRow([
      'PGM-001',
      'Portal Resmi Pelayanan WARGA AMPEL Aktif 24 Jam',
      'Warga Desa Ampel dapat menyampaikan pengaduan, permohonan bantuan, dan pengajuan surat secara online.',
      'Pemerintah Desa Ampel menyediakan layanan online WARGA AMPEL 24 jam penuh. Warga cukup mengisi formulir bertahap dan mencatat nomor tiket untuk memantau perkembangan penanganan.',
      'Pelayanan',
      todayStr,
      'Pemerintah Desa Ampel',
      true
    ]);
  }

  // Seed Kategori Layanan Awal (Grup A - E)
  var shLay = ss.getSheetByName('KATEGORI_LAYANAN');
  if (shLay.getLastRow() <= 1) {
    var initialServices = [
      ['LAY-A01', 'PGD-JALAN', 'Jalan rusak', 'A. Pengaduan', 'Pengaduan jalan berlubang atau jembatan rusak', 'road', 'Foto kondisi jalan (opsional)'],
      ['LAY-A02', 'PGD-SAMPAH', 'Sampah menumpuk', 'A. Pengaduan', 'Pengaduan penumpukan sampah lingkungan', 'trash', 'Foto lokasi (opsional)'],
      ['LAY-A03', 'PGD-LAMPU', 'Lampu jalan mati', 'A. Pengaduan', 'Penerangan jalan umum padam', 'lamp', 'Foto tiang lampu (opsional)'],
      ['LAY-A04', 'PGD-DRAINASE', 'Saluran air tersumbat', 'A. Pengaduan', 'Drainase tersumbat atau genangan', 'droplets', 'Foto saluran (opsional)'],
      ['LAY-B01', 'BNT-SOSIAL', 'Bantuan sosial', 'B. Bantuan', 'Permohonan bantuan sosial warga', 'heart', 'Foto KK (opsional)'],
      ['LAY-C01', 'ADM-DOMISILI', 'Surat domisili', 'C. Administrasi', 'Pengurusan surat keterangan domisili', 'file-text', 'Foto KTP/KK'],
      ['LAY-C02', 'ADM-USAHA', 'Surat keterangan usaha', 'C. Administrasi', 'Pengurusan SKU usaha mikro', 'store', 'Foto usaha (opsional)'],
      ['LAY-D01', 'ASP-PEMBANGUNAN', 'Usulan pembangunan', 'D. Aspirasi', 'Usulan pembangunan fasilitas desa', 'building', 'Tidak ada'],
      ['LAY-E01', 'KNS-UMUM', 'Pertanyaan & konsultasi desa', 'E. Konsultasi', 'Konsultasi pelayanan dan bantuan', 'message-circle', 'Tidak ada']
    ];
    var now = new Date().toISOString();
    initialServices.forEach(function(item, idx) {
      shLay.appendRow([
        item[0], item[1], item[2], item[3], item[4], item[5], item[6],
        'PTG-001', 'Petugas Layanan Desa Ampel', '[]', true, idx + 1, now
      ]);
    });
  }

  // Seed Struktur Organisasi Awal (jika masih kosong)
  var nowOrg = new Date().toISOString();
  var shKel = ss.getSheetByName('ORG_KELURAHAN');
  if (shKel && shKel.getLastRow() <= 1) {
    shKel.appendRow(['KEL-001', 'H. Ahmad Fauzi, S.Sos.', 'Lurah / Kepala Desa Ampel', 'LURAH', 'Wilayah Desa Ampel', '', '081234500101', false, true, true, 1, nowOrg, nowOrg]);
    shKel.appendRow(['KEL-002', 'Siti Nurhayati, S.AP.', 'Kasi Pemerintahan & Pelayanan Umum', 'KASI', 'Pelayanan Administrasi', '', '081234500102', true, true, true, 2, nowOrg, nowOrg]);
    shKel.appendRow(['KEL-003', 'Dewi Kartika Sari', 'Staf Administrasi & Pelayanan Warga', 'STAF', 'Loket Surat & Pengaduan', '', '081234500104', false, true, true, 3, nowOrg, nowOrg]);
  }
  var shLpmk = ss.getSheetByName('ORG_LPMK');
  if (shLpmk && shLpmk.getLastRow() <= 1) {
    shLpmk.appendRow(['LPMK-001', 'Drs. H. Mulyono', 'Ketua LPMK', 'Pemberdayaan Masyarakat', '', '081234500201', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shRw = ss.getSheetByName('ORG_RW');
  if (shRw && shRw.getLastRow() <= 1) {
    shRw.appendRow(['RW-01', 'RW 01', 'H. Sudirman', 'Ketua RW 01', 'Dusun Krajan Utara (RW 01)', '', '081234500301', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shRt = ss.getSheetByName('ORG_RT');
  if (shRt && shRt.getLastRow() <= 1) {
    shRt.appendRow(['RT-01-01', 'RW-01', 'RT 01', 'Slamet Riyadi', 'Ketua RT 01 / RW 01', 'Blok Masjid & Jalan Melati', '', '081234500401', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shKader = ss.getSheetByName('ORG_KADER');
  if (shKader && shKader.getLastRow() <= 1) {
    shKader.appendRow(['KDR-001', 'RT-01-01', 'Nurul Hidayah', 'Kader Posyandu Balita', '', '081234500501', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shSekolah = ss.getSheetByName('ORG_SEKOLAH');
  if (shSekolah && shSekolah.getLastRow() <= 1) {
    shSekolah.appendRow(['SKL-002', 'SD Negeri Ampel 01', 'SD / MI', 'Sutrisno, S.Pd., M.Pd.', 'Jl. Raya Ampel No. 18, Dusun Krajan Utara, RW 01', '', '', '081234500602', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shGuru = ss.getSheetByName('ORG_GURU');
  if (shGuru && shGuru.getLastRow() <= 1) {
    shGuru.appendRow(['GRU-004', 'SKL-002', 'Sri Wahyuni, S.Pd.SD.', 'Wali Kelas I & Literasi Dasar', '', '081234500704', true, true, true, 1, nowOrg, nowOrg]);
  }
  var shBalai = ss.getSheetByName('ORG_BALAI_RW');
  if (shBalai && shBalai.getLastRow() <= 1) {
    shBalai.appendRow(['BLI-001', 'RW-01', 'Balai RW 01 Dusun Krajan Utara', 'Jl. Melati No. 14, RT 01 / RW 01, Kelurahan Ampel', 'Senin-Sabtu, 08.00-16.00 WIB', '', '', '081234500301', true, true, true, 1, nowOrg, nowOrg]);
  }

  Logger.log('DATABASE_SIWARGA berhasil diinisialisasi beserta tab Struktur Organisasi, Sekolah, Guru, dan Balai RW.');
}
