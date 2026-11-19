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
    ORG_TP_PKK: [
      'ID_PKK', 'NAMA', 'JABATAN', 'POKJA', 'BIDANG',
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
    ],
    BANNER: [
      'ID_BANNER', 'JUDUL', 'KALIMAT_SAMBUTAN', 'GAMBAR_URL',
      'DRIVE_FILE_ID', 'AKTIF', 'UPDATED_AT', 'UPDATED_BY'
    ],
    PROGRAM: [
      'ID_PROGRAM', 'JUDUL', 'TANGGAL', 'RINGKASAN', 'STATUS',
      'FOTO_URL', 'DRIVE_FILE_ID', 'URUTAN', 'AKTIF', 'CREATED_AT', 'UPDATED_AT'
    ],
    GALERI: [
      'ID_GALERI', 'JUDUL', 'KETERANGAN', 'TANGGAL',
      'FOTO_URL', 'DRIVE_FILE_ID', 'URUTAN', 'AKTIF', 'CREATED_AT'
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
    shPengaturan.appendRow(['BERANDA_DRIVE_FOLDER_ID', CONFIG.BERANDA_DRIVE_FOLDER_ID || '1wR1Kt5shcFFll0OiM3-Jxtv8MauBOkFv', 'ID Folder Google Drive Foto Beranda']);
    shPengaturan.appendRow(['FOOTER_NAMA_KANTOR', 'Balai Desa Ampel', 'Nama kantor pelayanan pada Footer Beranda']);
    shPengaturan.appendRow(['FOOTER_ALAMAT', 'Jl. Raya Desa Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember', 'Alamat kantor desa pada Footer Beranda']);
    shPengaturan.appendRow(['FOOTER_TELEPON', '(0336) 621-104 / 0811-0000-0003', 'Nomor telepon/WhatsApp layanan pada Footer Beranda']);
    shPengaturan.appendRow(['FOOTER_EMAIL', 'pelayanan@ampel.desa.id', 'Email resmi pelayanan pada Footer Beranda']);
    shPengaturan.appendRow(['FOOTER_JAM_LAYANAN', 'Senin–Jumat, 08.00–14.30 WIB (Portal online aktif 24 jam)', 'Jam layanan kantor desa pada Footer Beranda']);
  }

  // Seed Semua Akun Bawaan (Super Admin, Kades, Operator, Petugas, dan Contoh Warga)
  var shUsers = ss.getSheetByName('USERS');
  var existingUserRows = shUsers.getDataRange().getValues();
  var existingUsernames = {};
  for (var uIdx = 1; uIdx < existingUserRows.length; uIdx++) {
    existingUsernames[String(existingUserRows[uIdx][1] || '').trim().toLowerCase()] = true;
  }
  var salt = 'siwarga2026';
  var nowIso = new Date().toISOString();
  var defaultUsers = [
    ['USR-ADMIN-01', 'admin', 'Super Admin Desa Ampel', 'admin@ampel.desa.id', "'081100000001", 'AdminAmpel2026!', 'SUPER_ADMIN', ''],
    ['USR-KADES-01', 'kades', 'H. Sutrisno (Kepala Desa)', 'kades@ampel.desa.id', "'081100000002", 'KadesAmpel2026!', 'KEPALA_DESA', ''],
    ['USR-OP-01', 'operator', 'Rina Kusuma (Operator)', 'operator@ampel.desa.id', "'081100000003", 'OperatorAmpel2026!', 'OPERATOR', ''],
    ['USR-PTG-01', 'petugas', 'Hendra Wijaya (Petugas Lapangan)', 'hendra@ampel.desa.id', "'081100000004", 'PetugasAmpel2026!', 'PETUGAS', ''],
    ['USR-WRG-01', 'sriwahyuni', 'Ibu Sri Wahyuni', 'sri.wahyuni@warga.ampel.id', "'081234567801", 'WargaAmpel2026!', 'WARGA', 'AMP-4821'],
    ['USR-WRG-02', 'pakslamet', 'Bapak Slamet Riyadi', 'slamet@warga.ampel.id', "'081398765402", 'WargaAmpel2026!', 'WARGA', 'AMP-7712']
  ];
  defaultUsers.forEach(function(u) {
    if (!existingUsernames[u[1]]) {
      var passHash = salt + ':' + hashSha256_(u[5], salt);
      shUsers.appendRow([
        u[0], u[1], u[2], u[3], u[4], passHash, u[6], 'AKTIF', u[7], nowIso
      ]);
    }
  });

  // Seed Contoh Warga (Ibu Sri Wahyuni & Bapak Slamet Riyadi)
  var shWarga = ss.getSheetByName('WARGA');
  if (shWarga && shWarga.getLastRow() <= 1) {
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

  // Seed Petugas default
  var shPetugas = ss.getSheetByName('PETUGAS');
  if (shPetugas.getLastRow() <= 1) {
    shPetugas.appendRow([
      'PTG-001', 'USR-PTG-01', 'Hendra Wijaya', 'Petugas Lapangan',
      'Infrastruktur, Jalan & Penerangan', "'081100000004", 'AKTIF', nowIso
    ]);
    shPetugas.appendRow([
      'PTG-002', 'USR-OP-01', 'Rina Kusuma', 'Operator Pelayanan & Persuratan',
      'Administrasi Surat & Bantuan Sosial', "'081100000003", 'AKTIF', nowIso
    ]);
    shPetugas.appendRow([
      'PTG-003', 'USR-ADMIN-01', 'Super Admin Desa Ampel', 'Koordinator Layanan Desa',
      'Pengawasan Layanan & Eskalasi Dinas', "'081100000001", 'AKTIF', nowIso
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
  var shPkk = ss.getSheetByName('ORG_TP_PKK');
  if (shPkk && shPkk.getLastRow() <= 1) {
    shPkk.appendRow(['PKK-001', 'Pembina TP PKK Kelurahan Ampel', 'Pembina PKK', 'Pembina', 'Pembinaan & Pendampingan Program TP PKK Kelurahan Ampel', '', "'081234500801", false, true, true, 1, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-002', 'Ketua TP PKK Kelurahan Ampel', 'Ketua PKK', 'Pengurus Inti', 'Koordinator Utama Gerakan Pemberdayaan & Kesejahteraan Keluarga', '', "'081234500802", false, true, true, 2, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-003', 'Wakil Ketua TP PKK', 'Wakil PKK', 'Pengurus Inti', 'Pendampingan Program & Koordinasi Lintas Pokja', '', "'081234500803", false, true, true, 3, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-004', 'Sekretaris TP PKK', 'Sekretaris PKK', 'Pengurus Inti', 'Administrasi Surat, Notulensi & Dokumentasi Kegiatan PKK', '', "'081234500804", false, true, true, 4, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-005', 'Bendahara TP PKK', 'Bendahara PKK', 'Pengurus Inti', 'Pengelolaan Administrasi Keuangan & Inventaris PKK', '', "'081234500805", false, true, true, 5, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-006', 'Koordinator POKJA I PKK', 'Ketua POKJA I', 'POKJA I', 'Penghayatan & Pengamalan Pancasila serta Gotong Royong', '', "'081234500806", false, true, true, 6, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-007', 'Koordinator POKJA II PKK', 'Ketua POKJA II', 'POKJA II', 'Pendidikan, Keterampilan & Pengembangan Kehidupan Berkoperasi', '', "'081234500807", false, true, true, 7, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-008', 'Koordinator POKJA III PKK', 'Ketua POKJA III', 'POKJA III', 'Pangan, Sandang, Perumahan & Tata Laksana Rumah Tangga', '', "'081234500808", false, true, true, 8, nowOrg, nowOrg]);
    shPkk.appendRow(['PKK-009', 'Koordinator POKJA IV PKK', 'Ketua POKJA IV', 'POKJA IV', 'Kesehatan, Kelestarian Lingkungan Hidup & Perencanaan Sehat', '', "'081234500809", false, true, true, 9, nowOrg, nowOrg]);
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

  // Seed Konten Beranda Awal (BANNER, PROGRAM, GALERI) jika masih kosong
  var shBanner = ss.getSheetByName('BANNER');
  if (shBanner && shBanner.getLastRow() <= 1) {
    shBanner.appendRow([
      'BNR-001',
      'WARGA AMPEL',
      'Ikuti program kegiatan kelurahan, cek kabar terbaru desa, atau sampaikan kebutuhan layanan Anda secara mudah.',
      '',
      '',
      true,
      nowOrg,
      'Super Admin Desa Ampel'
    ]);
  }
  var shProgram = ss.getSheetByName('PROGRAM');
  if (shProgram && shProgram.getLastRow() <= 1) {
    shProgram.appendRow([
      'PRG-001',
      'Posyandu Balita & Lansia Terpadu',
      '2026-11-24',
      'Pemeriksaan kesehatan rutin, imunisasi balita, dan senam kebugaran lansia bersama kader PKK di Pendopo Balai Desa.',
      'Akan Datang',
      '',
      '',
      1,
      true,
      nowOrg,
      nowOrg
    ]);
    shProgram.appendRow([
      'PRG-002',
      'Kerja Bakti Bersih Saluran & Penghijauan',
      '2026-11-16',
      'Gotong royong pembersihan drainase lingkungan dan penanaman tanaman pelindung jalan bersama pengurus RW/RT.',
      'Berjalan',
      '',
      '',
      2,
      true,
      nowOrg,
      nowOrg
    ]);
    shProgram.appendRow([
      'PRG-003',
      'Pelatihan Kemasan & Pemasaran UMKM Desa',
      '2026-10-28',
      'Pendampingan pelaku usaha warga dan TP PKK dalam pengemasan produk pangan lokal dan pemasaran digital.',
      'Selesai',
      '',
      '',
      3,
      true,
      nowOrg,
      nowOrg
    ]);
  }

  Logger.log('DATABASE_SIWARGA berhasil diinisialisasi beserta tab Struktur Organisasi, Sekolah, Guru, Balai RW, dan Beranda (BANNER, PROGRAM, GALERI).');
}
