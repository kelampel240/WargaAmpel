import {
  AdminDashboardStats,
  CitizenTrackingResponse,
  EvidenceType,
  REPORT_STATUSES,
  ReportStatus,
  SheetBuktiDokumen,
  SheetKonfigurasiForm,
  SheetLaporan,
  SheetPetugas,
  SheetTindakLanjut,
  SheetWarga,
} from './types';

export const DINAS_PROPOSAL_MESSAGE =
  'Usulan telah disampaikan kepada dinas terkait. Saat ini pemerintah desa sedang menunggu tindak lanjut.';

export const ALLOWED_EVIDENCE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
] as const;

export function maskNik(nik: string): string {
  const digits = nik.replace(/\D/g, '');
  if (digits.length < 10) return '******';
  return `${digits.slice(0, 6)}******${digits.slice(-4)}`;
}

export function maskKk(kk: string): string {
  const digits = kk.replace(/\D/g, '');
  if (digits.length < 10) return '******';
  return `${digits.slice(0, 6)}******${digits.slice(-4)}`;
}

export function formatTicketNumber(year: number, sequence: number): string {
  const padded = String(sequence).padStart(6, '0');
  return `SW-${year}-${padded}`;
}

export function isValidReportStatus(status: string): status is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(status);
}

export function validateEvidenceFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
  maxSizeMb = 5
): { valid: boolean; error?: string } {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: 'Nama file wajib diisi.' };
  }
  const normalizedMime = mimeType.toLowerCase().trim();
  const isAllowedMime = (ALLOWED_EVIDENCE_MIMES as readonly string[]).includes(normalizedMime);
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'pdf'].includes(ext);

  if (!isAllowedMime || !isAllowedExt) {
    return {
      valid: false,
      error: 'Format file tidak didukung. Gunakan file JPG, PNG, atau PDF.',
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { valid: false, error: 'File kosong atau rusak.' };
  }
  const maxBytes = maxSizeMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      valid: false,
      error: `Ukuran file melebihi batas maksimal ${maxSizeMb} MB.`,
    };
  }
  return { valid: true };
}

export function validateFollowUpUpdate(input: {
  status: string;
  keterangan: string;
  dinasTujuan?: string;
  nomorSurat?: string;
  hasCompletedEvidence?: boolean;
}): { valid: boolean; error?: string } {
  if (!isValidReportStatus(input.status)) {
    return { valid: false, error: 'Status penanganan tidak valid.' };
  }
  if (!input.keterangan || input.keterangan.trim().length < 5) {
    return {
      valid: false,
      error: 'Keterangan tindakan wajib diisi minimal 5 karakter.',
    };
  }
  if (
    input.status === 'Tidak dapat ditindaklanjuti' &&
    input.keterangan.trim().length < 15
  ) {
    return {
      valid: false,
      error:
        'Status "Tidak dapat ditindaklanjuti" wajib disertai alasan tertulis yang jelas (minimal 15 karakter).',
    };
  }
  if (
    input.status === 'Sudah diusulkan ke dinas terkait' &&
    (!input.dinasTujuan || input.dinasTujuan.trim().length < 3)
  ) {
    return {
      valid: false,
      error: 'Nama dinas tujuan wajib diisi saat mengusulkan laporan ke dinas.',
    };
  }
  return { valid: true };
}

export function validateDynamicFormFields(
  fields: SheetKonfigurasiForm[],
  values: Record<string, string | string[]>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.WAJIB) continue;
    if (field.TIPE_ISIAN === 'photo' || field.TIPE_ISIAN === 'pdf') {
      // File attachments may be submitted separately or via base64 indicator
      const val = values[field.ID_FIELD];
      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === '')) {
        errors[field.ID_FIELD] = `${field.LABEL_PERTANYAAN} wajib dilengkapi.`;
      }
      continue;
    }
    const raw = values[field.ID_FIELD];
    if (Array.isArray(raw)) {
      if (raw.length === 0) {
        errors[field.ID_FIELD] = `${field.LABEL_PERTANYAAN} wajib dipilih minimal satu.`;
      }
    } else if (!raw || String(raw).trim() === '') {
      errors[field.ID_FIELD] = `${field.LABEL_PERTANYAAN} wajib diisi.`;
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function verifyCitizenTrackingAccess(
  report: SheetLaporan,
  verificationInput: {
    tanggalLahir?: string;
    last4Hp?: string;
    kodeVerifikasi?: string;
  }
): boolean {
  const dob = (verificationInput.tanggalLahir || '').trim();
  const last4 = (verificationInput.last4Hp || '').replace(/\D/g, '').slice(-4);
  const reportPhoneDigits = report.NO_HP_PELAPOR.replace(/\D/g, '');
  const reportLast4 = reportPhoneDigits.slice(-4);

  if (dob && report.TANGGAL_LAHIR_VERIFIKASI && dob === report.TANGGAL_LAHIR_VERIFIKASI) {
    return true;
  }
  if (last4.length === 4 && reportLast4.length === 4 && last4 === reportLast4) {
    return true;
  }
  return false;
}

export function sanitizeReportForCitizenTracking(
  report: SheetLaporan,
  followUps: SheetTindakLanjut[],
  evidenceList: SheetBuktiDokumen[]
): CitizenTrackingResponse {
  const reportFollowUps = followUps
    .filter((f) => f.ID_LAPORAN === report.ID_LAPORAN)
    .sort((a, b) => a.CREATED_AT.localeCompare(b.CREATED_AT));

  const publicEvidence = evidenceList
    .filter(
      (b) =>
        b.ID_LAPORAN === report.ID_LAPORAN &&
        b.VISIBILITAS === 'PUBLIK_WARGA'
    )
    .sort((a, b) => a.TANGGAL_UPLOAD.localeCompare(b.TANGGAL_UPLOAD));

  const showDinasMessage =
    report.STATUS_TERBARU === 'Sudah diusulkan ke dinas terkait' ||
    report.STATUS_TERBARU === 'Menunggu tindak lanjut dinas';

  // Enforce: Never expose reporter's full name, phone, NIK, or exact home address in public tracking
  return {
    idLaporan: report.ID_LAPORAN,
    judulLaporan: report.JUDUL_LAPORAN,
    namaLayanan:
      report.KODE_GRUP === 'GENERAL_INQUIRY'
        ? 'Laporan Umum (Menunggu Klasifikasi Petugas)'
        : report.NAMA_LAYANAN,
    kodeGrup: report.KODE_GRUP,
    statusTerbaru: report.STATUS_TERBARU,
    pesanKhususDinas: showDinasMessage ? DINAS_PROPOSAL_MESSAGE : null,
    alasanPenolakan:
      report.STATUS_TERBARU === 'Tidak dapat ditindaklanjuti'
        ? report.ALASAN_TIDAK_DITINDAKLANJUTI ||
          reportFollowUps[reportFollowUps.length - 1]?.KETERANGAN ||
          null
        : null,
    tanggalLaporan: report.CREATED_AT,
    lokasiRingkas: report.RT_RW ? `Wilayah ${report.RT_RW}, Desa Ampel` : 'Desa Ampel',
    petugasPenanggungJawab: report.NAMA_PETUGAS_TUGAS || 'Tim Pelayanan Desa Ampel',
    riwayatTindakLanjut: reportFollowUps.map((f) => ({
      idUpdate: f.ID_UPDATE,
      tanggalUpdate: f.TANGGAL_UPDATE,
      status: f.STATUS,
      keterangan: f.KETERANGAN,
      dinasTujuan: f.DINAS_TUJUAN,
      nomorSurat: f.NOMOR_SURAT,
      petugas: f.PETUGAS,
    })),
    buktiPublik: publicEvidence.map((b) => ({
      idBukti: b.ID_BUKTI,
      idUpdate: b.ID_UPDATE,
      namaFile: b.NAMA_FILE,
      mimeType: b.MIME_TYPE,
      jenisBukti: b.JENIS_BUKTI as EvidenceType,
      tanggalUpload: b.TANGGAL_UPLOAD,
      previewUrl: `/api/evidence/${encodeURIComponent(b.ID_BUKTI)}?ticket=${encodeURIComponent(report.ID_LAPORAN)}`,
    })),
  };
}

export function computeDashboardStats(
  reports: SheetLaporan[],
  wargaList: SheetWarga[],
  petugasList: SheetPetugas[]
): AdminDashboardStats {
  const totalLaporan = reports.length;
  const laporanBaru = reports.filter((r) => r.STATUS_TERBARU === 'Laporan diterima').length;
  const menungguPenanganan = reports.filter(
    (r) =>
      r.STATUS_TERBARU === 'Laporan diterima' ||
      r.STATUS_TERBARU === 'Menunggu tindak lanjut dinas'
  ).length;
  const sedangDiproses = reports.filter(
    (r) =>
      r.STATUS_TERBARU === 'Sedang ditindaklanjuti' ||
      r.STATUS_TERBARU === 'Sedang dalam proses perbaikan'
  ).length;
  const diusulkanKeDinas = reports.filter(
    (r) =>
      r.STATUS_TERBARU === 'Sudah diusulkan ke dinas terkait' ||
      r.STATUS_TERBARU === 'Menunggu tindak lanjut dinas'
  ).length;
  const selesai = reports.filter(
    (r) => r.STATUS_TERBARU === 'Sudah diperbaiki atau ditangani'
  ).length;
  const tidakDapatDitindaklanjuti = reports.filter(
    (r) => r.STATUS_TERBARU === 'Tidak dapat ditindaklanjuti'
  ).length;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthBuckets = new Map<string, number>();
  for (const r of reports) {
    const dt = new Date(r.CREATED_AT);
    if (!Number.isNaN(dt.getTime())) {
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(key, (monthBuckets.get(key) || 0) + 1);
    }
  }
  const sortedMonths = Array.from(monthBuckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  const monthlyIncoming = sortedMonths.map(([ym, count]) => {
    const [yr, mo] = ym.split('-');
    const idx = Math.max(0, Math.min(11, Number(mo) - 1));
    return { label: `${monthNames[idx]} ${yr}`, count };
  });

  const catMap = new Map<string, number>();
  for (const r of reports) {
    const label = r.MASALAH_UTAMA || r.NAMA_LAYANAN || 'Lainnya';
    catMap.set(label, (catMap.get(label) || 0) + 1);
  }
  const topCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));

  const statusDistribution = REPORT_STATUSES.map((status) => ({
    label: status,
    count: reports.filter((r) => r.STATUS_TERBARU === status).length,
  }));

  const belumSelesai = Math.max(0, totalLaporan - selesai - tidakDapatDitindaklanjuti);

  return {
    totalLaporan,
    laporanBaru,
    menungguPenanganan,
    sedangDiproses,
    diusulkanKeDinas,
    selesai,
    tidakDapatDitindaklanjuti,
    totalWarga: wargaList.length,
    totalPetugas: petugasList.filter((p) => p.STATUS === 'AKTIF').length,
    monthlyIncoming,
    topCategories,
    statusDistribution,
    completedVsUnfinished: {
      selesai,
      belumSelesai,
    },
  };
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvExport(
  reports: SheetLaporan[],
  followUps: SheetTindakLanjut[]
): string {
  const headers = [
    'ID_LAPORAN',
    'TANGGAL_MASUK',
    'KATEGORI_GRUP',
    'LAYANAN',
    'JUDUL_LAPORAN',
    'RT_RW',
    'STATUS_TERBARU',
    'PETUGAS_TUGAS',
    'JUMLAH_TINDAK_LANJUT',
    'CATATAN_TERAKHIR',
  ];
  const rows = reports.map((r) => {
    const history = followUps.filter((f) => f.ID_LAPORAN === r.ID_LAPORAN);
    const latest = history[history.length - 1];
    return [
      r.ID_LAPORAN,
      r.CREATED_AT,
      r.KODE_GRUP,
      r.NAMA_LAYANAN,
      r.JUDUL_LAPORAN,
      r.RT_RW,
      r.STATUS_TERBARU,
      r.NAMA_PETUGAS_TUGAS || '-',
      history.length,
      latest ? latest.KETERANGAN : '-',
    ]
      .map(escapeCsvCell)
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
