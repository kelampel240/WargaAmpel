import * as XLSX from 'xlsx';
import {
  AdminDashboardStats,
  AdminOrgStructureResponse,
  SheetLaporan,
  SheetPetugas,
  SheetWarga,
} from '../shared/types';
import { OrgEntityType } from '../shared/orgLogic';

export interface ExcelSheetSpec {
  name: string;
  rows: Array<Record<string, unknown>>;
}

export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

function formatDateIsoShort(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function computeColumnWidths(rows: Array<Record<string, unknown>>): XLSX.ColInfo[] {
  if (rows.length === 0) return [{ wch: 28 }];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const row of rows) {
      const val = row[key];
      const str = val === null || val === undefined ? '' : String(val);
      if (str.length > maxLen) maxLen = str.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
}

export function createWorkbook(sheets: ExcelSheetSpec[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    let sheetName = sanitizeSheetName(sheet.name);
    let suffix = 1;
    while (usedNames.has(sheetName)) {
      const tag = `_${suffix++}`;
      sheetName = `${sheetName.slice(0, Math.max(1, 31 - tag.length))}${tag}`;
    }
    usedNames.add(sheetName);

    const safeRows =
      sheet.rows.length > 0 ? sheet.rows : [{ Keterangan: 'Belum ada data tersedia.' }];
    const ws = XLSX.utils.json_to_sheet(safeRows);
    ws['!cols'] = computeColumnWidths(safeRows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return wb;
}

export function createWorkbookBuffer(sheets: ExcelSheetSpec[]): Uint8Array {
  const wb = createWorkbook(sheets);
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer | Uint8Array;
  return out instanceof Uint8Array ? out : new Uint8Array(out);
}

export function downloadExcelFile(sheets: ExcelSheetSpec[], filename: string): void {
  const bytes = createWorkbookBuffer(sheets);
  const safeName = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayFileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildReportRows(reports: SheetLaporan[]): Array<Record<string, unknown>> {
  return reports.map((r, index) => ({
    No: index + 1,
    'Nomor Tiket': r.ID_LAPORAN,
    'Tanggal Masuk': formatDateIsoShort(r.CREATED_AT),
    'Kategori Grup': r.KODE_GRUP,
    Layanan: r.NAMA_LAYANAN,
    'Judul Laporan': r.JUDUL_LAPORAN,
    'Masalah Utama': r.MASALAH_UTAMA || '-',
    Pelapor: r.NAMA_PELAPOR,
    'No. HP': r.NO_HP_PELAPOR || '-',
    Lokasi: r.LOKASI_ALAMAT || '-',
    'RT/RW': r.RT_RW || '-',
    'Status Terbaru': r.STATUS_TERBARU,
    'Petugas PJ': r.NAMA_PETUGAS_TUGAS || '-',
    'Alasan Penolakan': r.ALASAN_TIDAK_DITINDAKLANJUTI || '-',
    'Folder Drive': r.DRIVE_FOLDER_NAME || '-',
    'Tautan Folder Drive': r.DRIVE_FOLDER_URL || '-',
    'Terakhir Diperbarui': formatDateIsoShort(r.UPDATED_AT),
  }));
}

export function exportReportsToExcel(
  reports: SheetLaporan[],
  filename = `LAPORAN_WARGA_AMPEL_${todayFileStamp()}.xlsx`
): void {
  downloadExcelFile(
    [
      {
        name: 'Data Laporan',
        rows: buildReportRows(reports),
      },
    ],
    filename
  );
}

export function exportReportStatsWorkbookToExcel(
  reports: SheetLaporan[],
  stats: AdminDashboardStats | null,
  filename = `STATISTIK_LAPORAN_WARGA_AMPEL_${todayFileStamp()}.xlsx`
): void {
  const summaryRows: Array<Record<string, unknown>> = stats
    ? [
        { Indikator: 'Total Laporan', Jumlah: stats.totalLaporan },
        { Indikator: 'Laporan Baru', Jumlah: stats.laporanBaru },
        { Indikator: 'Menunggu Penanganan', Jumlah: stats.menungguPenanganan },
        { Indikator: 'Sedang Diproses', Jumlah: stats.sedangDiproses },
        { Indikator: 'Diusulkan ke Dinas', Jumlah: stats.diusulkanKeDinas },
        { Indikator: 'Selesai', Jumlah: stats.selesai },
        { Indikator: 'Tidak Dapat Ditindaklanjuti', Jumlah: stats.tidakDapatDitindaklanjuti },
        { Indikator: 'Total Warga Terdaftar', Jumlah: stats.totalWarga },
        { Indikator: 'Total Petugas', Jumlah: stats.totalPetugas },
      ]
    : [];

  const statusRows =
    stats?.statusDistribution.map((s, idx) => ({
      No: idx + 1,
      'Status Penanganan': s.label,
      'Jumlah Laporan': s.count,
    })) || [];

  const categoryRows =
    stats?.topCategories.map((c, idx) => ({
      No: idx + 1,
      'Jenis Layanan / Kategori': c.label,
      'Jumlah Laporan': c.count,
    })) || [];

  downloadExcelFile(
    [
      { name: 'Ringkasan Statistik', rows: summaryRows },
      { name: 'Distribusi Status', rows: statusRows },
      { name: 'Kategori Teratas', rows: categoryRows },
      { name: 'Data Laporan', rows: buildReportRows(reports) },
    ],
    filename
  );
}

export function buildOrgStructureSheets(data: AdminOrgStructureResponse): ExcelSheetSpec[] {
  const rwMap = new Map(data.rw.map((r) => [r.ID_RW, r]));
  const rtMap = new Map(data.rt.map((t) => [t.ID_RT, t]));

  const kelurahanRows = data.kelurahan.map((k, idx) => ({
    No: idx + 1,
    Urutan: k.URUTAN,
    Tingkat: k.TINGKAT,
    Nama: k.NAMA,
    Jabatan: k.JABATAN,
    'Wilayah Tugas': k.WILAYAH_TUGAS || '-',
    'No. HP': k.NO_HP || '-',
    'Tampilkan HP Publik': k.TAMPILKAN_HP ? 'Ya' : 'Tidak',
    'Tampil Publik': k.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
    Status: k.AKTIF ? 'Aktif' : 'Nonaktif',
  }));

  const lpmkRows = data.lpmk.map((l, idx) => ({
    No: idx + 1,
    Urutan: l.URUTAN,
    Nama: l.NAMA,
    Jabatan: l.JABATAN,
    Bidang: l.BIDANG || '-',
    'No. HP': l.NO_HP || '-',
    'Tampilkan HP Publik': l.TAMPILKAN_HP ? 'Ya' : 'Tidak',
    'Tampil Publik': l.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
    Status: l.AKTIF ? 'Aktif' : 'Nonaktif',
  }));

  const rwRows = data.rw.map((r, idx) => ({
    No: idx + 1,
    Urutan: r.URUTAN,
    'Nomor RW': r.NOMOR_RW,
    'Nama Ketua': r.NAMA_KETUA,
    Jabatan: r.JABATAN,
    'Wilayah Tugas': r.WILAYAH_TUGAS || '-',
    'No. HP': r.NO_HP || '-',
    'Tampilkan HP Publik': r.TAMPILKAN_HP ? 'Ya' : 'Tidak',
    'Tampil Publik': r.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
    Status: r.AKTIF ? 'Aktif' : 'Nonaktif',
  }));

  const rtRows = data.rt.map((t, idx) => ({
    No: idx + 1,
    Urutan: t.URUTAN,
    'Nomor RW': rwMap.get(t.ID_RW)?.NOMOR_RW || t.ID_RW,
    'Nomor RT': t.NOMOR_RT,
    'Nama Ketua': t.NAMA_KETUA,
    Jabatan: t.JABATAN,
    'Wilayah Tugas': t.WILAYAH_TUGAS || '-',
    'No. HP': t.NO_HP || '-',
    'Tampilkan HP Publik': t.TAMPILKAN_HP ? 'Ya' : 'Tidak',
    'Tampil Publik': t.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
    Status: t.AKTIF ? 'Aktif' : 'Nonaktif',
  }));

  const sekolahMap = new Map((data.sekolah || []).map((s) => [s.ID_SEKOLAH, s]));

  const kaderRows = data.kader.map((k, idx) => {
    const rt = rtMap.get(k.ID_RT);
    const rw = rt ? rwMap.get(rt.ID_RW) : undefined;
    return {
      No: idx + 1,
      Urutan: k.URUTAN,
      RW: rw?.NOMOR_RW || '-',
      RT: rt?.NOMOR_RT || k.ID_RT,
      'Nama Kader': k.NAMA,
      'Jabatan / Peran': k.JABATAN,
      'No. HP': k.NO_HP || '-',
      'Tampilkan HP Publik': k.TAMPILKAN_HP ? 'Ya' : 'Tidak',
      'Tampil Publik': k.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
      Status: k.AKTIF ? 'Aktif' : 'Nonaktif',
    };
  });

  const sekolahRows = (data.sekolah || []).map((s, idx) => ({
    No: idx + 1,
    Urutan: s.URUTAN,
    'Nama Sekolah': s.NAMA_SEKOLAH,
    Jenjang: s.JENJANG,
    'Kepala Sekolah': s.KEPALA_SEKOLAH || '-',
    'Alamat Lokasi': s.ALAMAT,
    'Tautan Google Maps': s.MAPS_URL || '-',
    'No. HP': s.NO_HP || '-',
    'Tampilkan HP Publik': s.TAMPILKAN_HP ? 'Ya' : 'Tidak',
    'Tampil Publik': s.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
    Status: s.AKTIF ? 'Aktif' : 'Nonaktif',
  }));

  const guruRows = (data.guru || []).map((g, idx) => {
    const school = sekolahMap.get(g.ID_SEKOLAH);
    return {
      No: idx + 1,
      Urutan: g.URUTAN,
      'Nama Sekolah': school?.NAMA_SEKOLAH || g.ID_SEKOLAH,
      'Nama Guru': g.NAMA,
      'Mata Pelajaran / Jabatan': g.JABATAN,
      'No. HP': g.NO_HP || '-',
      'Tampilkan HP Publik': g.TAMPILKAN_HP ? 'Ya' : 'Tidak',
      'Tampil Publik': g.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
      Status: g.AKTIF ? 'Aktif' : 'Nonaktif',
    };
  });

  const balaiRwRows = (data.balaiRw || []).map((b, idx) => {
    const rw = rwMap.get(b.ID_RW);
    return {
      No: idx + 1,
      Urutan: b.URUTAN,
      RW: rw?.NOMOR_RW || b.ID_RW,
      'Nama Balai RW': b.NAMA_BALAI,
      'Alamat Balai RW': b.ALAMAT,
      'Jam Layanan / Fasilitas': b.JAM_LAYANAN || '-',
      'Tautan Google Maps': b.MAPS_URL || '-',
      'No. HP': b.NO_HP || '-',
      'Tampilkan HP Publik': b.TAMPILKAN_HP ? 'Ya' : 'Tidak',
      'Tampil Publik': b.TAMPILKAN_PUBLIK ? 'Ya' : 'Tidak',
      Status: b.AKTIF ? 'Aktif' : 'Nonaktif',
    };
  });

  return [
    { name: 'Kelurahan', rows: kelurahanRows },
    { name: 'LPMK', rows: lpmkRows },
    { name: 'Daftar RW', rows: rwRows },
    { name: 'Daftar RT', rows: rtRows },
    { name: 'Data Kader', rows: kaderRows },
    { name: 'Sekolah', rows: sekolahRows },
    { name: 'Data Guru', rows: guruRows },
    { name: 'Balai RW', rows: balaiRwRows },
  ];
}

export function exportOrgStructureToExcel(
  data: AdminOrgStructureResponse,
  filename = `STRUKTUR_ORGANISASI_WARGA_AMPEL_${todayFileStamp()}.xlsx`
): void {
  downloadExcelFile(buildOrgStructureSheets(data), filename);
}

const ENTITY_SHEET_INDEX: Record<OrgEntityType, number> = {
  kelurahan: 0,
  lpmk: 1,
  rw: 2,
  rt: 3,
  kader: 4,
  sekolah: 5,
  guru: 6,
  balai_rw: 7,
};

export function exportOrgEntityToExcel(
  entity: OrgEntityType,
  data: AdminOrgStructureResponse
): void {
  const sheets = buildOrgStructureSheets(data);
  const target = sheets[ENTITY_SHEET_INDEX[entity]];
  downloadExcelFile(
    [target],
    `DATA_${entity.toUpperCase()}_WARGA_AMPEL_${todayFileStamp()}.xlsx`
  );
}

export function downloadOrgEntityTemplate(entity: OrgEntityType): void {
  const templates: Record<OrgEntityType, { name: string; rows: Array<Record<string, unknown>> }> = {
    kelurahan: {
      name: 'Kelurahan',
      rows: [
        {
          Urutan: 1,
          Tingkat: 'STAF',
          Nama: 'Contoh Nama Staf',
          Jabatan: 'Staf Pelayanan Umum',
          'Wilayah Tugas': 'Kelurahan Ampel',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    lpmk: {
      name: 'LPMK',
      rows: [
        {
          Urutan: 1,
          Nama: 'Contoh Pengurus LPMK',
          Jabatan: 'Sekretaris LPMK',
          Bidang: 'Pemberdayaan Masyarakat',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    rw: {
      name: 'Daftar RW',
      rows: [
        {
          Urutan: 1,
          'Nomor RW': 'RW 03',
          'Nama Ketua': 'Contoh Ketua RW',
          Jabatan: 'Ketua RW 03',
          'Wilayah Tugas': 'Dusun Selatan',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    rt: {
      name: 'Daftar RT',
      rows: [
        {
          Urutan: 1,
          'Nomor RW': 'RW 01',
          'Nomor RT': 'RT 05',
          'Nama Ketua': 'Contoh Ketua RT',
          Jabatan: 'Ketua RT 05',
          'Wilayah Tugas': 'Blok Melati',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    kader: {
      name: 'Data Kader',
      rows: [
        {
          Urutan: 1,
          RW: 'RW 01',
          RT: 'RT 01',
          'Nama Kader': 'Contoh Nama Kader',
          'Jabatan / Peran': 'Kader Posyandu',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    sekolah: {
      name: 'Sekolah',
      rows: [
        {
          Urutan: 1,
          'Nama Sekolah': 'SD Negeri Ampel 03',
          Jenjang: 'SD / MI',
          'Kepala Sekolah': 'Contoh Nama Kepala Sekolah',
          'Alamat Lokasi': 'Jl. Pendidikan No. 12, RW 01, Kelurahan Ampel',
          'Tautan Google Maps': '',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    guru: {
      name: 'Data Guru',
      rows: [
        {
          Urutan: 1,
          'Nama Sekolah': 'SD Negeri Ampel 01',
          'Nama Guru': 'Contoh Nama Guru, S.Pd.',
          'Mata Pelajaran / Jabatan': 'Guru Kelas V',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
    balai_rw: {
      name: 'Balai RW',
      rows: [
        {
          Urutan: 1,
          RW: 'RW 01',
          'Nama Balai RW': 'Balai RW 01 Krajan Utara',
          'Alamat Balai RW': 'Jl. Melati No. 14, RT 01 / RW 01, Kelurahan Ampel',
          'Jam Layanan / Fasilitas': 'Senin–Sabtu, 08.00–16.00 WIB',
          'Tautan Google Maps': '',
          'No. HP': '081234567890',
          'Tampilkan HP Publik': 'Tidak',
          'Tampil Publik': 'Ya',
          Status: 'Aktif',
        },
      ],
    },
  };
  downloadExcelFile([templates[entity]], `TEMPLATE_${entity.toUpperCase()}_WARGA_AMPEL.xlsx`);
}

export function buildWargaRows(warga: SheetWarga[]): Array<Record<string, unknown>> {
  return warga.map((w, idx) => ({
    No: idx + 1,
    'ID Warga': w.ID_WARGA,
    'Nama Lengkap': w.NAMA_LENGKAP,
    'NIK (Ter-mask)': w.NIK_MASKED,
    'KK (Ter-mask)': w.KK_MASKED,
    'Tanggal Lahir': w.TANGGAL_LAHIR || '-',
    Alamat: w.ALAMAT || '-',
    'RT/RW': w.RT_RW || '-',
    'No. HP': w.NO_HP || '-',
    'Status Verifikasi': w.STATUS_VERIFIKASI,
    Terdaftar: formatDateIsoShort(w.CREATED_AT),
  }));
}

export function exportWargaToExcel(
  warga: SheetWarga[],
  filename = `DATA_WARGA_AMPEL_${todayFileStamp()}.xlsx`
): void {
  downloadExcelFile([{ name: 'Data Warga', rows: buildWargaRows(warga) }], filename);
}

export function buildPetugasRows(petugas: SheetPetugas[]): Array<Record<string, unknown>> {
  return petugas.map((p, idx) => ({
    No: idx + 1,
    'ID Petugas': p.ID_PETUGAS,
    'Nama Petugas': p.NAMA_PETUGAS,
    Jabatan: p.JABATAN,
    'Bidang Tugas': p.BIDANG_TUGAS || '-',
    'No. HP': p.NO_HP || '-',
    Status: p.STATUS,
    Terdaftar: formatDateIsoShort(p.CREATED_AT),
  }));
}

export function exportPetugasToExcel(
  petugas: SheetPetugas[],
  filename = `DATA_PETUGAS_WARGA_AMPEL_${todayFileStamp()}.xlsx`
): void {
  downloadExcelFile([{ name: 'Data Petugas', rows: buildPetugasRows(petugas) }], filename);
}

export function downloadPetugasTemplate(): void {
  downloadExcelFile(
    [
      {
        name: 'Data Petugas',
        rows: [
          {
            'Nama Petugas': 'Contoh Nama Petugas',
            Jabatan: 'Kasi Pelayanan',
            'Bidang Tugas': 'Administrasi & Pengaduan',
            'No. HP': '081234567890',
          },
        ],
      },
    ],
    'TEMPLATE_PETUGAS_WARGA_AMPEL.xlsx'
  );
}
