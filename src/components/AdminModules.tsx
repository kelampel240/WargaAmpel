import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Folder, FolderOpen, Plus, Trash2, Upload } from 'lucide-react';
import {
  AdminDashboardStats,
  SheetBuktiDokumen,
  SheetLaporan,
  SheetLogAktivitas,
  SheetPengaturan,
  SheetPengumuman,
  SheetPetugas,
  SheetWarga,
  UserRole,
} from '../shared/types';
import { apiFetch, downloadCsvExport, formatTanggalIndo } from '../lib/api';
import {
  downloadPetugasTemplate,
  exportPetugasToExcel,
  exportReportStatsWorkbookToExcel,
  exportWargaToExcel,
} from '../lib/excelExport';
import { ParsedImportRow, parsePetugasImportExcel } from '../lib/excelImport';
import { ExcelImportModal } from './ExcelImportModal';
import { GoogleDriveWorkspacePanel } from './GoogleDriveWorkspacePanel';
import { GoogleSheetsWorkspacePanel } from './GoogleSheetsWorkspacePanel';

/* ============================================================================
 * DATA WARGA (MASKED NIK & KK + OPERATOR VERIFICATION)
 * ========================================================================== */
export const WargaManager: React.FC = () => {
  const [warga, setWarga] = useState<SheetWarga[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<{ warga: SheetWarga[] }>('/api/admin/warga');
    setWarga(Array.isArray(res?.warga) ? res.warga : []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const verifyWarga = async (id: string, status: 'TERVERIFIKASI' | 'DITOLAK') => {
    await apiFetch(`/api/admin/warga/${encodeURIComponent(id)}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F2942]">Data Warga Kelurahan Ampel</h2>
          <p className="text-sm text-slate-600">
            NIK dan nomor KK tersimpan dan ditampilkan dalam bentuk ter-mask sesuai kebijakan privasi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportWargaToExcel(warga)}
          disabled={loading || warga.length === 0}
          className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg hover:bg-[#08553d] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          <span>Export Excel (.xlsx)</span>
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Nama Lengkap</th>
              <th className="py-3 px-4">NIK (Ter-mask)</th>
              <th className="py-3 px-4">KK (Ter-mask)</th>
              <th className="py-3 px-4">Alamat / RT-RW</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Verifikasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">Memuat data warga...</td></tr>
            ) : (
              warga.map((w) => (
                <tr key={w.ID_WARGA} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{w.NAMA_LENGKAP}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{w.NIK_MASKED}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-slate-700">{w.KK_MASKED}</td>
                  <td className="py-3 px-4 text-slate-700">{w.ALAMAT} ({w.RT_RW})</td>
                  <td className="py-3 px-4 font-semibold">{w.STATUS_VERIFIKASI}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {w.STATUS_VERIFIKASI !== 'TERVERIFIKASI' && (
                      <button
                        type="button"
                        onClick={() => verifyWarga(w.ID_WARGA, 'TERVERIFIKASI')}
                        className="px-3 py-1 text-xs font-bold bg-[#0B6E4F] text-white rounded-lg cursor-pointer"
                      >
                        Verifikasi
                      </button>
                    )}
                    {w.STATUS_VERIFIKASI !== 'DITOLAK' && (
                      <button
                        type="button"
                        onClick={() => verifyWarga(w.ID_WARGA, 'DITOLAK')}
                        className="px-3 py-1 text-xs font-semibold border border-slate-300 rounded-lg cursor-pointer"
                      >
                        Tolak
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * DATA PETUGAS
 * ========================================================================== */
export const PetugasManager: React.FC<{ userRole?: UserRole; onUpdated: () => void }> = ({
  userRole,
  onUpdated,
}) => {
  const [petugas, setPetugas] = useState<SheetPetugas[]>([]);
  const [nama, setNama] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [bidang, setBidang] = useState('');
  const [noHp, setNoHp] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  const [roleError, setRoleError] = useState('');
  const canEdit = !userRole || userRole === 'SUPER_ADMIN';

  const load = async () => {
    const res = await apiFetch<{ petugas: SheetPetugas[] }>('/api/admin/petugas');
    setPetugas(Array.isArray(res?.petugas) ? res.petugas : []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/petugas', {
      method: 'POST',
      body: JSON.stringify({ namaPetugas: nama, jabatan, bidangTugas: bidang, noHp }),
    });
    setNama('');
    setJabatan('');
    setBidang('');
    setNoHp('');
    setShowAdd(false);
    await load();
    onUpdated();
  };

  const handleConfirmImport = async (validRows: ParsedImportRow[]) => {
    const res = await apiFetch<{ ok: boolean; count: number }>('/api/admin/petugas/import', {
      method: 'POST',
      body: JSON.stringify({ items: validRows.map((row) => row.payload) }),
    });
    setShowImport(false);
    setImportNotice(`${res.count || validRows.length} data petugas berhasil diimpor dari Excel.`);
    await load();
    onUpdated();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F2942]">Data Petugas Kelurahan</h2>
          <p className="text-sm text-slate-600">Daftar perangkat kelurahan dan petugas penanggung jawab layanan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportPetugasToExcel(petugas)}
            disabled={petugas.length === 0}
            title="Export Excel (Petugas)"
            aria-label="Export Excel Petugas"
            className="p-2 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (!canEdit) {
                setRoleError(`Akun Anda (${userRole}) hanya dapat melihat data. Import & tambah petugas memerlukan akun Super Admin.`);
                return;
              }
              setRoleError('');
              setShowImport(true);
            }}
            title="Import Excel (Petugas)"
            aria-label="Import Excel Petugas"
            className="p-2 border border-sky-300 bg-sky-50 text-sky-900 rounded-lg hover:bg-sky-100 cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Tambah Petugas</span>
          </button>
        </div>
      </div>

      {roleError && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-sm font-semibold text-amber-950">
          {roleError}
        </div>
      )}

      {importNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-950">
          {importNotice}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            type="text"
            required
            placeholder="Nama Petugas"
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            required
            placeholder="Jabatan"
            value={jabatan}
            onChange={(e) => setJabatan(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="Bidang Tugas"
            value={bidang}
            onChange={(e) => setBidang(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <input
            type="tel"
            placeholder="No. HP"
            value={noHp}
            onChange={(e) => setNoHp(e.target.value)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="submit" className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
              Simpan Petugas
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Nama Petugas</th>
              <th className="py-3 px-4">Jabatan</th>
              <th className="py-3 px-4">Bidang Tugas</th>
              <th className="py-3 px-4">No. HP</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {petugas.map((p) => (
              <tr key={p.ID_PETUGAS} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">{p.NAMA_PETUGAS}</td>
                <td className="py-3 px-4 text-slate-700">{p.JABATAN}</td>
                <td className="py-3 px-4 text-slate-700">{p.BIDANG_TUGAS}</td>
                <td className="py-3 px-4 font-mono text-slate-700">{p.NO_HP}</td>
                <td className="py-3 px-4 font-semibold text-emerald-800">{p.STATUS}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImport && (
        <ExcelImportModal
          title="Import Excel — Data Petugas"
          subtitle="Unggah file Excel (.xlsx/.xls) atau CSV berisi daftar petugas kelurahan untuk ditambahkan sekaligus."
          onClose={() => setShowImport(false)}
          onDownloadTemplate={downloadPetugasTemplate}
          onParseFile={(buf) => parsePetugasImportExcel(buf)}
          onConfirmImport={handleConfirmImport}
        />
      )}
    </div>
  );
};

/* ============================================================================
 * BUKTI PENANGANAN (GOOGLE DRIVE SIWARGA_DESA EXPLORER)
 * ========================================================================== */
export const BuktiDriveExplorer: React.FC = () => {
  const [tree, setTree] = useState<{
    rootFolder: string;
    subfolders: string[];
    ticketFolders: string[];
    evidence: SheetBuktiDokumen[];
  } | null>(null);

  const loadTree = () => {
    apiFetch<{
      rootFolder: string;
      subfolders: string[];
      ticketFolders: string[];
      evidence: SheetBuktiDokumen[];
    }>('/api/admin/drive-tree').then(setTree);
  };

  useEffect(() => {
    loadTree();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">
          Bukti Penanganan &amp; Struktur Google Drive
        </h2>
        <p className="text-sm text-slate-600">
          Seluruh folder bersifat privat dan terorganisasi otomatis berdasarkan nomor tiket dan jenis dokumen.
        </p>
      </div>

      <GoogleDriveWorkspacePanel
        localEvidence={tree?.evidence || []}
        onEvidenceSynced={loadTree}
      />

      {tree && (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-display font-bold text-base text-[#0F2942] flex items-center gap-2 mb-3">
              <FolderOpen className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
              <span>Struktur Folder Induk: {tree.rootFolder}/</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {(Array.isArray(tree.subfolders) ? tree.subfolders : []).map((rawSub) => {
                const subName =
                  typeof rawSub === 'string'
                    ? rawSub
                    : String((rawSub as { name?: string })?.name || '');
                const ticketCount = Array.isArray(tree.ticketFolders)
                  ? tree.ticketFolders.length
                  : typeof rawSub === 'object' && rawSub !== null && 'fileCount' in rawSub
                  ? Number((rawSub as { fileCount?: number }).fileCount || 0)
                  : 0;
                return (
                  <div key={subName} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                    <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                      <Folder className="w-4 h-4 text-[#0F2942]" aria-hidden="true" />
                      <span className="truncate">{subName}</span>
                    </div>
                    {subName === '01_LAPORAN_WARGA' && (
                      <p className="mt-1.5 text-slate-600">{ticketCount} folder tiket</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-3 px-4">ID Laporan</th>
                  <th className="py-3 px-4">Jenis Bukti</th>
                  <th className="py-3 px-4">Nama File</th>
                  <th className="py-3 px-4">Folder Drive</th>
                  <th className="py-3 px-4">Visibilitas</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(Array.isArray(tree.evidence) ? tree.evidence : []).map((doc) => {
                  const rawUrl = String(doc.DRIVE_URL || '');
                  const isExternalUrl = rawUrl.startsWith('http');
                  const viewHref = isExternalUrl
                    ? rawUrl
                    : `${rawUrl}?ticket=${encodeURIComponent(doc.ID_LAPORAN)}`;
                  return (
                    <tr key={doc.ID_BUKTI} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-[#0F2942]">{doc.ID_LAPORAN}</td>
                      <td className="py-3 px-4 text-slate-800">{doc.JENIS_BUKTI}</td>
                      <td className="py-3 px-4 text-slate-700">{doc.NAMA_FILE}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">{doc.DRIVE_FOLDER_SUB}</td>
                      <td className="py-3 px-4 text-xs font-semibold">{doc.VISIBILITAS}</td>
                      <td className="py-3 px-4 text-right">
                        <a
                          href={viewHref}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100"
                        >
                          {isExternalUrl ? 'Buka di Drive' : 'Lihat'}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================================================
 * LAPORAN STATISTIK + EXPORT CSV
 * ========================================================================== */
export const StatistikExporter: React.FC<{ stats: AdminDashboardStats | null }> = ({ stats }) => {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportError, setExportError] = useState('');

  const handleExport = () => {
    void downloadCsvExport();
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    setExportError('');
    try {
      const res = await apiFetch<{ reports: SheetLaporan[] }>('/api/admin/reports');
      exportReportStatsWorkbookToExcel(res.reports || [], stats);
    } catch (err) {
      setExportError((err as Error).message || 'Gagal menyiapkan file Excel.');
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F2942]">Laporan Statistik &amp; Ekspor</h2>
          <p className="text-sm text-slate-600">Rekapitulasi kinerja penyelesaian laporan dan ekspor ke Excel (.xlsx) atau CSV.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exportingExcel}
            className="px-4 py-2.5 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg hover:bg-[#08553d] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>{exportingExcel ? 'Menyiapkan Excel...' : 'Unduh Excel (.xlsx)'}</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2.5 bg-[#0F2942] text-white text-sm font-bold rounded-lg hover:bg-[#173b5e] flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Unduh Laporan (CSV)</span>
          </button>
        </div>
      </div>

      {exportError && (
        <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-sm font-medium text-rose-900">
          {exportError}
        </div>
      )}

      {stats && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Status Penanganan</th>
                <th className="py-3 px-4 text-right">Jumlah Laporan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(Array.isArray(stats?.statusDistribution) ? stats.statusDistribution : []).map((s) => (
                <tr key={s.label}>
                  <td className="py-3 px-4 font-medium text-slate-900">{s.label}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * PENGUMUMAN MANAGER
 * ========================================================================== */
export const AnnouncementsManager: React.FC = () => {
  const [items, setItems] = useState<SheetPengumuman[]>([]);
  const [judul, setJudul] = useState('');
  const [kategori, setKategori] = useState<'Pelayanan' | 'Pembangunan' | 'Bantuan' | 'Jadwal Kelurahan'>('Pelayanan');
  const [isi, setIsi] = useState('');

  const load = async () => {
    const res = await apiFetch<{ announcements: SheetPengumuman[] }>('/api/admin/announcements');
    setItems(Array.isArray(res?.announcements) ? res.announcements : []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify({ judul, kategori, isi }),
    });
    setJudul('');
    setIsi('');
    load();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold text-[#0F2942]">Kelola Pengumuman Kelurahan</h2>

      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <input
            type="text"
            required
            placeholder="Judul Pengumuman"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="sm:col-span-2 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
          />
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value as typeof kategori)}
            className="px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
          >
            <option value="Pelayanan">Pelayanan</option>
            <option value="Bantuan">Bantuan</option>
            <option value="Pembangunan">Pembangunan</option>
            <option value="Jadwal Kelurahan">Jadwal Kelurahan</option>
          </select>
        </div>
        <textarea
          rows={3}
          required
          placeholder="Isi pengumuman untuk warga Kelurahan Ampel..."
          value={isi}
          onChange={(e) => setIsi(e.target.value)}
          className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
        />
        <button type="submit" className="px-4 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
          Terbitkan Pengumuman
        </button>
      </form>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.ID_PENGUMUMAN} className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#0B6E4F]">
                {item.KATEGORI} · {formatTanggalIndo(item.TANGGAL_TERBIT)}
              </p>
              <h3 className="font-display text-lg font-bold text-slate-900 mt-1">{item.JUDUL}</h3>
              <p className="text-sm text-slate-700 mt-1">{item.ISI}</p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(item.ID_PENGUMUMAN)}
              aria-label={`Hapus pengumuman ${item.JUDUL}`}
              className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
 * PENGATURAN & PANDUAN INTEGRASI GAS / GOOGLE SHEETS / GOOGLE DRIVE
 * ========================================================================== */
export const SettingsAndGasGuide: React.FC = () => {
  const [settings, setSettings] = useState<SheetPengaturan[]>([]);
  const [bundle, setBundle] = useState<Record<string, string>>({});
  const [activeDocTab, setActiveDocTab] = useState<string>('DEPLOYMENT_GUIDE.md');
  const [savedMsg, setSavedMsg] = useState('');
  const [pingResult, setPingResult] = useState('');

  useEffect(() => {
    apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings').then((r) =>
      setSettings(Array.isArray(r?.settings) ? r.settings : [])
    );
    apiFetch<{ bundle: Record<string, string> }>('/api/gas-bundle').then((r) =>
      setBundle(r?.bundle && typeof r.bundle === 'object' ? r.bundle : {})
    );
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg('');
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    });
    setSavedMsg('Pengaturan berhasil disimpan.');
  };

  const handleTestGas = async () => {
    setPingResult('Menguji koneksi...');
    const url = settings.find((s) => s.KUNCI === 'GAS_WEB_APP_URL')?.NILAI || '';
    try {
      const res = await apiFetch<{ ok: boolean; status: number; preview: string }>('/api/admin/test-gas', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setPingResult(`Terhubung (HTTP ${res.status}): ${res.preview}`);
    } catch (err) {
      setPingResult((err as Error).message);
    }
  };

  const downloadFile = (fname: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">
          Pengaturan &amp; Integrasi Google Sheets / Drive / Apps Script
        </h2>
        <p className="text-sm text-slate-600">
          Konfigurasi ID Spreadsheet, ID Folder Drive, URL Web App Google Apps Script, serta unduh kode skrip siap pasang.
        </p>
      </div>

      <GoogleDriveWorkspacePanel compact />
      <GoogleSheetsWorkspacePanel compact />

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        {savedMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-sm font-medium text-emerald-950">
            {savedMsg}
          </div>
        )}
        <div className="space-y-3">
          {settings.map((item) => (
            <div key={item.KUNCI} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-4">
                <label className="font-mono text-xs font-bold text-[#0F2942] block">{item.KUNCI}</label>
                <span className="text-xs text-slate-500">{item.KETERANGAN}</span>
              </div>
              <div className="md:col-span-8">
                <input
                  type="text"
                  disabled={item.KUNCI === 'TICKET_COUNTER'}
                  value={item.NILAI}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev.map((s) => (s.KUNCI === item.KUNCI ? { ...s, NILAI: e.target.value } : s))
                    )
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg disabled:bg-slate-100"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" className="px-5 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg cursor-pointer">
            Simpan Pengaturan
          </button>
          <button
            type="button"
            onClick={handleTestGas}
            className="px-4 py-2 bg-[#0F2942] text-white text-sm font-bold rounded-lg cursor-pointer"
          >
            Uji Koneksi Web App GAS
          </button>
          {pingResult && <span className="text-xs text-slate-700 font-mono">{pingResult}</span>}
        </div>
      </form>

      {/* Embedded GAS Code & Deployment Documentation */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold text-[#0F2942]">
            Paket Kode Google Apps Script &amp; Panduan Deployment
          </h3>
          {bundle[activeDocTab] && (
            <button
              type="button"
              onClick={() => downloadFile(activeDocTab, bundle[activeDocTab])}
              className="px-3.5 py-1.5 bg-slate-100 border border-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Unduh {activeDocTab}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
          {Object.keys(bundle).map((fname) => (
            <button
              key={fname}
              type="button"
              onClick={() => setActiveDocTab(fname)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg cursor-pointer ${
                activeDocTab === fname
                  ? 'bg-[#0F2942] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {fname}
            </button>
          ))}
        </div>

        <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96 whitespace-pre-wrap">
          {bundle[activeDocTab] || 'Memuat berkas...'}
        </pre>
      </div>
    </div>
  );
};

/* ============================================================================
 * LOG AKTIVITAS (AUDIT TRAIL)
 * ========================================================================== */
export const ActivityLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<SheetLogAktivitas[]>([]);

  useEffect(() => {
    apiFetch<{ logs: SheetLogAktivitas[] }>('/api/admin/logs').then((r) =>
      setLogs(Array.isArray(r?.logs) ? r.logs : [])
    );
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0F2942]">Log Aktivitas Sistem (LOG_AKTIVITAS)</h2>
        <p className="text-sm text-slate-600">Catatan audit trail seluruh aktivitas login, laporan, tindak lanjut, dan perubahan layanan.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Waktu</th>
              <th className="py-3 px-4">Pengguna</th>
              <th className="py-3 px-4">Peran</th>
              <th className="py-3 px-4">Aksi</th>
              <th className="py-3 px-4">ID Terkait</th>
              <th className="py-3 px-4">Rincian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {logs.map((l) => (
              <tr key={l.ID_LOG} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                  {new Date(l.WAKTU).toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-900">{l.NAMA_PENGGUNA}</td>
                <td className="py-2.5 px-4 text-xs text-slate-600">{l.ROLE}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-[#0F2942]">{l.AKSI}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{l.ID_TERKAIT}</td>
                <td className="py-2.5 px-4 text-slate-700">{l.DETAIL}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
