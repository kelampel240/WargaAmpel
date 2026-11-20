import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  CheckSquare,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HandHeart,
  History,
  Home,
  LayoutDashboard,
  Menu,
  Megaphone,
  Network,
  Settings,
  ShieldAlert,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  AdminDashboardStats,
  PublicUserSession,
  REPORT_STATUSES,
  SERVICE_GROUPS,
  ServiceWithForm,
  SheetLaporan,
  SheetPetugas,
} from '../shared/types';
import { apiFetch, formatTanggalIndo, getStatusVisual } from '../lib/api';
import { exportReportsToExcel } from '../lib/excelExport';
import { AdminCharts } from './AdminCharts';
import { ReportDetailModal } from './ReportDetailModal';
import { ServiceBuilder } from './ServiceBuilder';
import { OrgAdminManager } from './OrgAdminManager';
import {
  ActivityLogViewer,
  AnnouncementsManager,
  BuktiDriveExplorer,
  PetugasManager,
  SettingsAndGasGuide,
  StatistikExporter,
  WargaManager,
} from './AdminModules';
import { GoogleSheetsWorkspacePanel } from './GoogleSheetsWorkspacePanel';
import { BerandaAdminManager } from './BerandaAdminManager';

export type SidebarModule =
  | 'dashboard'
  | 'kelola-beranda'
  | 'laporan-masuk'
  | 'permohonan-bantuan'
  | 'layanan-administrasi'
  | 'pengaduan'
  | 'kelola-layanan'
  | 'struktur-organisasi'
  | 'data-warga'
  | 'data-petugas'
  | 'bukti-penanganan'
  | 'google-sheets'
  | 'laporan-statistik'
  | 'pengumuman'
  | 'pengaturan'
  | 'log-aktivitas';

interface AdminDashboardProps {
  user: PublicUserSession;
  onServicesChanged: () => void;
  initialTab?: SidebarModule;
}

const SIDEBAR_ITEMS: Array<{
  id: SidebarModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'kelola-beranda', label: 'Kelola Beranda', icon: Home, superAdminOnly: true },
  { id: 'laporan-masuk', label: 'Laporan Masuk', icon: ClipboardList },
  { id: 'permohonan-bantuan', label: 'Permohonan Bantuan', icon: HandHeart },
  { id: 'layanan-administrasi', label: 'Layanan Administrasi', icon: FileText },
  { id: 'pengaduan', label: 'Pengaduan', icon: ShieldAlert },
  { id: 'kelola-layanan', label: 'Kelola Jenis Layanan', icon: Wrench },
  { id: 'struktur-organisasi', label: 'Struktur Organisasi', icon: Network },
  { id: 'data-warga', label: 'Data Warga', icon: Users },
  { id: 'data-petugas', label: 'Data Petugas', icon: UserCheck },
  { id: 'bukti-penanganan', label: 'Bukti Penanganan', icon: FolderOpen },
  { id: 'google-sheets', label: 'Google Sheets', icon: FileSpreadsheet },
  { id: 'laporan-statistik', label: 'Laporan Statistik', icon: BarChart3 },
  { id: 'pengumuman', label: 'Pengumuman', icon: Megaphone },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
  { id: 'log-aktivitas', label: 'Log Aktivitas', icon: History },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onServicesChanged,
  initialTab = 'dashboard',
}) => {
  const [activeTab, setActiveTab] = useState<SidebarModule>(initialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [reports, setReports] = useState<SheetLaporan[]>([]);
  const [services, setServices] = useState<ServiceWithForm[]>([]);
  const [petugasList, setPetugasList] = useState<SheetPetugas[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [searchTicket, setSearchTicket] = useState('');

  // Modal state
  const [modalTicket, setModalTicket] = useState<{
    id: string;
    focus: 'detail' | 'followup' | 'evidence';
  } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dashRes, repRes, svcRes, ptgRes] = await Promise.all([
        apiFetch<{ stats: AdminDashboardStats }>('/api/admin/dashboard'),
        apiFetch<{ reports: SheetLaporan[] }>('/api/admin/reports'),
        apiFetch<{ services: ServiceWithForm[] }>('/api/admin/services'),
        apiFetch<{ petugas: SheetPetugas[] }>('/api/admin/petugas'),
      ]);
      setStats(dashRes?.stats || null);
      setReports(Array.isArray(repRes?.reports) ? repRes.reports : []);
      setServices(Array.isArray(svcRes?.services) ? svcRes.services : []);
      setPetugasList(Array.isArray(ptgRes?.petugas) ? ptgRes.petugas : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const getFilteredReports = (): SheetLaporan[] => {
    let list = [...reports];
    if (activeTab === 'permohonan-bantuan') list = list.filter((r) => r.KODE_GRUP === 'B. Bantuan');
    if (activeTab === 'layanan-administrasi') list = list.filter((r) => r.KODE_GRUP === 'C. Administrasi');
    if (activeTab === 'pengaduan') list = list.filter((r) => r.KODE_GRUP === 'A. Pengaduan');

    if (filterStatus) list = list.filter((r) => r.STATUS_TERBARU === filterStatus);
    if (filterService) list = list.filter((r) => r.ID_LAYANAN === filterService);
    if (filterDateFrom) {
      list = list.filter((r) => String(r.CREATED_AT || '').slice(0, 10) >= filterDateFrom);
    }
    if (searchTicket.trim()) {
      const q = searchTicket.trim().toLowerCase();
      list = list.filter(
        (r) =>
          String(r.ID_LAPORAN || '').toLowerCase().includes(q) ||
          String(r.JUDUL_LAPORAN || '').toLowerCase().includes(q) ||
          String(r.NAMA_PELAPOR || '').toLowerCase().includes(q)
      );
    }
    return list;
  };

  const isReportView = [
    'dashboard',
    'laporan-masuk',
    'permohonan-bantuan',
    'layanan-administrasi',
    'pengaduan',
  ].includes(activeTab);

  const visibleReports = getFilteredReports();

  const kpiCards = stats
    ? [
        { label: 'Total Laporan', value: stats.totalLaporan },
        { label: 'Laporan Baru', value: stats.laporanBaru },
        { label: 'Menunggu Penanganan', value: stats.menungguPenanganan },
        { label: 'Sedang Diproses', value: stats.sedangDiproses },
        { label: 'Diusulkan ke Dinas', value: stats.diusulkanKeDinas },
        { label: 'Selesai', value: stats.selesai },
        { label: 'Total Warga', value: stats.totalWarga },
        { label: 'Total Petugas', value: stats.totalPetugas },
      ]
    : [];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex bg-slate-50">
      {/* Desktop Sidebar (15 Modules) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="p-5 border-b border-slate-200">
          <p className="text-xs font-semibold text-[#0B6E4F]">{String(user.role || '').replace('_', ' ')}</p>
          <p className="font-display font-bold text-base text-[#0F2942] truncate">{user.namaLengkap}</p>
        </div>
        <nav aria-label="Menu Dashboard Admin" className="p-3 space-y-1 flex-1 overflow-y-auto">
          {SIDEBAR_ITEMS.filter((item) => !item.superAdminOnly || user.role === 'SUPER_ADMIN').map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors text-left cursor-pointer ${
                  active
                    ? 'bg-[#0F2942] text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-50 w-72 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-display font-bold text-[#0F2942]">Menu Admin WARGA AMPEL</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-3 space-y-1 overflow-y-auto flex-1">
              {SIDEBAR_ITEMS.filter((item) => !item.superAdminOnly || user.role === 'SUPER_ADMIN').map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-left ${
                      activeTab === item.id ? 'bg-[#0F2942] text-white' : 'text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Context Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu sidebar"
              className="lg:hidden p-2 bg-white border border-slate-300 rounded-lg"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-500">
                Panel Pengelola Desa Ampel · Google Sheets &amp; Drive Sync
              </p>
              <h1 className="font-display text-2xl font-extrabold text-[#0F2942]">
                {SIDEBAR_ITEMS.find((i) => i.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('google-sheets')}
              className="px-3.5 py-2 text-sm font-semibold bg-[#0F2942] text-white rounded-lg hover:bg-[#173b5e] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
              <span>Google Sheets</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bukti-penanganan')}
              className="px-3.5 py-2 text-sm font-semibold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderOpen className="w-4 h-4" aria-hidden="true" />
              <span>Google Drive</span>
            </button>
            <button
              type="button"
              onClick={loadAll}
              className="px-4 py-2 text-sm font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Muat Ulang Data
            </button>
          </div>
        </div>

        {/* Overview KPIs + 4 Charts */}
        {activeTab === 'dashboard' && stats && (
          <>
            <section aria-label="Ringkasan Statistik">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                  <div
                    key={card.label}
                    className="bg-white border border-slate-200 rounded-xl p-4"
                  >
                    <p className="text-xs font-medium text-slate-600">{card.label}</p>
                    <p className="mt-1 font-display text-2xl font-extrabold text-[#0F2942] tabular-nums">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-label="Grafik Statistik">
              <AdminCharts stats={stats} />
            </section>
          </>
        )}

        {/* Filterable Reports Table (Dashboard + Inbox + Category Tabs) */}
        {isReportView && (
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#0F2942]">
                Daftar Laporan ({visibleReports.length})
              </h2>
              <button
                type="button"
                onClick={() => exportReportsToExcel(visibleReports)}
                disabled={loading || visibleReports.length === 0}
                className="px-3.5 py-2 bg-[#0B6E4F] text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-[#08553d] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>Export Excel (.xlsx)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="search"
                value={searchTicket}
                onChange={(e) => setSearchTicket(e.target.value)}
                placeholder="Cari nomor tiket / judul / pelapor..."
                aria-label="Cari nomor tiket"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filter status penanganan"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Semua Status Penanganan</option>
                {REPORT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                aria-label="Filter layanan"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Semua Jenis Layanan</option>
                {services.map((s) => (
                  <option key={s.ID_LAYANAN} value={s.ID_LAYANAN}>
                    {s.NAMA_LAYANAN}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                aria-label="Filter mulai tanggal"
                className="px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-3 px-3">Tiket</th>
                    <th className="py-3 px-3">Judul &amp; Layanan</th>
                    <th className="py-3 px-3">Pelapor</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Memuat data laporan dari DATABASE_SIWARGA...
                      </td>
                    </tr>
                  ) : visibleReports.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Tidak ada laporan yang cocok dengan filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    visibleReports.map((rep) => {
                      const vis = getStatusVisual(rep.STATUS_TERBARU);
                      return (
                        <tr key={rep.ID_LAPORAN} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold text-[#0F2942] whitespace-nowrap">
                            {rep.ID_LAPORAN}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-semibold text-slate-900">{rep.JUDUL_LAPORAN}</p>
                            <p className="text-xs text-slate-500">
                              {rep.NAMA_LAYANAN} · {rep.RT_RW}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                            {rep.NAMA_PELAPOR}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2.5 py-1 rounded border text-xs font-semibold whitespace-nowrap ${vis.bgClass} ${vis.borderClass} ${vis.textClass}`}
                            >
                              {rep.STATUS_TERBARU}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {formatTanggalIndo(rep.CREATED_AT)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setModalTicket({ id: rep.ID_LAPORAN, focus: 'detail' })}
                                className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                              >
                                Lihat detail
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalTicket({ id: rep.ID_LAPORAN, focus: 'followup' })}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#0F2942] text-white rounded hover:bg-[#173b5e] whitespace-nowrap cursor-pointer"
                              >
                                Proses laporan
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalTicket({ id: rep.ID_LAPORAN, focus: 'evidence' })}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#0B6E4F] text-white rounded hover:bg-[#08553d] whitespace-nowrap cursor-pointer"
                              >
                                Tambah bukti
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalTicket({ id: rep.ID_LAPORAN, focus: 'followup' })}
                                className="px-2.5 py-1 text-xs font-semibold border border-emerald-300 text-emerald-900 rounded hover:bg-emerald-50 whitespace-nowrap cursor-pointer"
                              >
                                Perbarui status
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Service Builder */}
        {activeTab === 'kelola-layanan' && (
          <ServiceBuilder
            services={services}
            petugasList={petugasList}
            onRefresh={() => {
              loadAll();
              onServicesChanged();
            }}
          />
        )}

        {activeTab === 'kelola-beranda' && (
          <BerandaAdminManager userRole={user.role} onBerandaChanged={onServicesChanged} />
        )}
        {activeTab === 'struktur-organisasi' && <OrgAdminManager userRole={user.role} />}
        {activeTab === 'data-warga' && <WargaManager />}
        {activeTab === 'data-petugas' && <PetugasManager userRole={user.role} onUpdated={loadAll} />}
        {activeTab === 'bukti-penanganan' && <BuktiDriveExplorer />}
        {activeTab === 'google-sheets' && (
          <GoogleSheetsWorkspacePanel
            onDataSynced={() => {
              loadAll();
              onServicesChanged();
            }}
          />
        )}
        {activeTab === 'laporan-statistik' && <StatistikExporter stats={stats} />}
        {activeTab === 'pengumuman' && <AnnouncementsManager />}
        {activeTab === 'pengaturan' && <SettingsAndGasGuide />}
        {activeTab === 'log-aktivitas' && <ActivityLogViewer />}
      </main>

      {modalTicket && (
        <ReportDetailModal
          ticketId={modalTicket.id}
          initialFocus={modalTicket.focus}
          services={services}
          petugasList={petugasList}
          onClose={() => setModalTicket(null)}
          onUpdated={loadAll}
        />
      )}
    </div>
  );
};
