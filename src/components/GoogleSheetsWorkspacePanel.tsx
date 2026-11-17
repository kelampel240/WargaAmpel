import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ExternalLink,
  FileSpreadsheet,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Table2,
  UploadCloud,
} from 'lucide-react';
import {
  googleSignIn,
  initGoogleDriveAuth,
  logoutGoogleDrive,
} from '../lib/googleDriveAuth';
import {
  appendSheetRow,
  createSiwargaSpreadsheet,
  extractSpreadsheetId,
  getSpreadsheetMetadata,
  readSheetValues,
  SpreadsheetMetadata,
  syncFullDatabaseToSpreadsheet,
} from '../lib/googleSheetsClient';
import { apiFetch } from '../lib/api';
import { SheetPengaturan } from '../shared/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { DriveConfirmDialog } from './DriveConfirmDialog';

interface GoogleSheetsWorkspacePanelProps {
  compact?: boolean;
  onDataSynced?: () => void;
}

export const GoogleSheetsWorkspacePanel: React.FC<GoogleSheetsWorkspacePanelProps> = ({
  compact = false,
  onDataSynced,
}) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [spreadsheetInput, setSpreadsheetInput] = useState('');
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState('');
  const [meta, setMeta] = useState<SpreadsheetMetadata | null>(null);
  const [activeSheetTitle, setActiveSheetTitle] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowValues, setNewRowValues] = useState<string[]>([]);

  const [loadingSheet, setLoadingSheet] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    affectedItems?: string[];
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (authedUser) => {
        setGoogleUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setGoogleUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings')
      .then((res) => {
        const sid = res.settings.find((s) => s.KUNCI === 'SPREADSHEET_ID')?.NILAI || '';
        if (sid && !sid.includes('CONTOH') && !sid.includes('ISI_')) {
          setSpreadsheetInput(sid);
          setActiveSpreadsheetId(sid);
        }
      })
      .catch(() => {
        // ignore if settings unavailable
      });
  }, []);

  const loadSheetTab = async (spreadsheetId: string, sheetTitle: string) => {
    setLoadingSheet(true);
    setErrorMsg('');
    try {
      const values = await readSheetValues(spreadsheetId, sheetTitle);
      setRows(values);
      const headers = values[0] || [];
      setNewRowValues(headers.map(() => ''));
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'AUTH_REQUIRED') setNeedsAuth(true);
      else setErrorMsg(msg);
    } finally {
      setLoadingSheet(false);
    }
  };

  const openSpreadsheet = async (idOrUrl: string) => {
    const cleanId = extractSpreadsheetId(idOrUrl);
    if (!cleanId) return;
    setLoadingSheet(true);
    setErrorMsg('');
    setNotice('');
    try {
      const info = await getSpreadsheetMetadata(cleanId);
      setMeta(info);
      setActiveSpreadsheetId(info.spreadsheetId);
      const firstTitle = info.sheets[0]?.title || '';
      setActiveSheetTitle(firstTitle);
      if (firstTitle) {
        const values = await readSheetValues(info.spreadsheetId, firstTitle);
        setRows(values);
        const headers = values[0] || [];
        setNewRowValues(headers.map(() => ''));
      } else {
        setRows([]);
      }
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'AUTH_REQUIRED') setNeedsAuth(true);
      else setErrorMsg(msg);
    } finally {
      setLoadingSheet(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && activeSpreadsheetId && !meta && !compact) {
      void openSpreadsheet(activeSpreadsheetId);
    }
  }, [needsAuth, activeSpreadsheetId, compact]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setErrorMsg('');
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setNeedsAuth(false);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal masuk dengan akun Google.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogleDrive();
    setGoogleUser(null);
    setNeedsAuth(true);
    setMeta(null);
    setRows([]);
    setNotice('');
  };

  const saveSpreadsheetIdToSettings = async (spreadsheetId: string) => {
    const current = await apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings');
    const updated = current.settings.map((s) =>
      s.KUNCI === 'SPREADSHEET_ID' ? { ...s, NILAI: spreadsheetId } : s
    );
    await apiFetch('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: updated }),
    });
  };

  const handleCreateNewSpreadsheet = () => {
    setConfirmState({
      open: true,
      title: 'Buat Spreadsheet DATABASE_SIWARGA Baru?',
      description:
        'Sistem akan membuat Google Spreadsheet baru bernama "DATABASE_SIWARGA — WARGA AMPEL" lengkap dengan 9 tab data desa, lalu menyimpan ID Spreadsheet ke pengaturan aplikasi.',
      confirmLabel: 'Buat & Hubungkan',
      onConfirm: async () => {
        const created = await createSiwargaSpreadsheet();
        await saveSpreadsheetIdToSettings(created.spreadsheetId);
        setSpreadsheetInput(created.spreadsheetId);
        setActiveSpreadsheetId(created.spreadsheetId);
        setMeta(created);
        setActiveSheetTitle(created.sheets[0]?.title || 'LAPORAN');
        setRows([]);
        setNotice(
          `Spreadsheet "${created.title}" berhasil dibuat (${created.spreadsheetId}) dan disimpan ke pengaturan.`
        );
      },
    });
  };

  const handleSyncAllToSheets = () => {
    if (!activeSpreadsheetId) {
      setErrorMsg('Hubungkan atau buat Google Spreadsheet terlebih dahulu sebelum menyinkronkan data.');
      return;
    }
    setConfirmState({
      open: true,
      title: 'Sinkronkan Semua Data Desa ke Google Sheets?',
      description:
        'Tindakan ini akan memperbarui dan menimpa isi tab LAPORAN, TINDAK_LANJUT, KATEGORI_LAYANAN, WARGA, PETUGAS, BUKTI_DOKUMEN, PENGUMUMAN, PENGATURAN, dan LOG_AKTIVITAS di Google Spreadsheet yang terhubung.',
      affectedItems: [meta?.title ? `${meta.title} (${activeSpreadsheetId})` : activeSpreadsheetId],
      confirmLabel: 'Sinkronkan Sekarang',
      onConfirm: async () => {
        const db = await apiFetch<Record<string, unknown>>('/api/admin/backup-json');
        const result = await syncFullDatabaseToSpreadsheet(activeSpreadsheetId, db);
        await saveSpreadsheetIdToSettings(activeSpreadsheetId);
        setNotice(
          `Berhasil menyinkronkan ${result.syncedTabs.length} tab data WARGA AMPEL ke Google Sheets.`
        );
        const refreshed = await getSpreadsheetMetadata(activeSpreadsheetId);
        setMeta(refreshed);
        const tabToRead = activeSheetTitle || refreshed.sheets[0]?.title || 'LAPORAN';
        setActiveSheetTitle(tabToRead);
        await loadSheetTab(activeSpreadsheetId, tabToRead);
      },
    });
  };

  const handleAppendRowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSpreadsheetId || !activeSheetTitle) return;
    setConfirmState({
      open: true,
      title: `Tambahkan Baris Baru ke Tab "${activeSheetTitle}"?`,
      description: `Baris data baru akan ditambahkan ke bagian akhir tab "${activeSheetTitle}" pada Google Spreadsheet yang terhubung.`,
      affectedItems: [newRowValues.join(' | ')],
      confirmLabel: 'Tambahkan Baris',
      onConfirm: async () => {
        await appendSheetRow(activeSpreadsheetId, activeSheetTitle, newRowValues);
        setShowAddRow(false);
        setNotice(`1 baris baru berhasil ditambahkan ke tab "${activeSheetTitle}".`);
        await loadSheetTab(activeSpreadsheetId, activeSheetTitle);
      },
    });
  };

  const handleImportAnnouncementsFromSheet = () => {
    if (!activeSpreadsheetId || !activeSheetTitle || rows.length < 2) {
      setErrorMsg('Pilih tab yang memiliki baris header dan minimal 1 baris data.');
      return;
    }
    const headers = rows[0].map((h) => h.trim().toUpperCase());
    const judulIdx = headers.indexOf('JUDUL');
    const isiIdx = headers.indexOf('ISI');
    const katIdx = headers.indexOf('KATEGORI');
    if (judulIdx < 0 || isiIdx < 0) {
      setErrorMsg('Tab aktif harus memiliki kolom header JUDUL dan ISI untuk diimpor sebagai pengumuman.');
      return;
    }
    const candidates = rows.slice(1).filter((r) => (r[judulIdx] || '').trim().length >= 5 && (r[isiIdx] || '').trim().length >= 10);
    if (candidates.length === 0) {
      setErrorMsg('Tidak ada baris pengumuman valid (JUDUL min. 5 karakter, ISI min. 10 karakter).');
      return;
    }

    setConfirmState({
      open: true,
      title: `Terapkan ${candidates.length} Pengumuman dari Google Sheets?`,
      description: `Sebanyak ${candidates.length} pengumuman dari tab "${activeSheetTitle}" akan diterbitkan ke portal warga WARGA AMPEL.`,
      affectedItems: candidates.slice(0, 5).map((r) => r[judulIdx]),
      confirmLabel: 'Terapkan ke Portal',
      onConfirm: async () => {
        let imported = 0;
        for (const r of candidates) {
          await apiFetch('/api/admin/announcements', {
            method: 'POST',
            body: JSON.stringify({
              judul: r[judulIdx],
              isi: r[isiIdx],
              kategori: katIdx >= 0 && r[katIdx] ? r[katIdx] : 'Pelayanan',
            }),
          });
          imported += 1;
        }
        setNotice(`${imported} pengumuman dari Google Sheets berhasil diterapkan ke website.`);
        if (onDataSynced) onDataSynced();
      },
    });
  };

  const runConfirmedAction = async () => {
    if (!confirmState) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      await confirmState.onConfirm();
      setConfirmState(null);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setConfirmState(null);
    } finally {
      setBusyAction(false);
    }
  };

  const headers = rows[0] || [];
  const dataRows = rows.slice(1).filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return r.some((cell) => cell.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0F2942] flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
            <span>Integrasi Langsung Google Sheets</span>
          </h3>
          {needsAuth ? (
            <p className="text-sm text-slate-600 mt-0.5">
              Masuk dengan akun Google untuk membaca, membuat, dan menyinkronkan database desa langsung ke Google Sheets.
            </p>
          ) : (
            <p className="text-sm text-slate-700 mt-0.5">
              Terhubung sebagai{' '}
              <span className="font-semibold text-[#0F2942]">
                {googleUser?.displayName || googleUser?.email || 'Akun Google'}
              </span>
              {googleUser?.email && <span className="text-slate-500"> · {googleUser.email}</span>}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {needsAuth ? (
            <GoogleSignInButton
              onClick={handleGoogleLogin}
              disabled={signingIn}
              label={signingIn ? 'Menghubungkan...' : 'Sign in with Google'}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={handleCreateNewSpreadsheet}
                disabled={busyAction}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                Buat Spreadsheet Baru
              </button>
              <button
                type="button"
                onClick={handleSyncAllToSheets}
                disabled={busyAction || !activeSpreadsheetId}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#0F2942] text-white rounded-lg hover:bg-[#173b5e] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" aria-hidden="true" />
                <span>Sinkronkan Semua Data</span>
              </button>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Putuskan</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-sm font-medium text-rose-900">
          {errorMsg}
        </div>
      )}

      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-medium text-emerald-950">
          {notice}
        </div>
      )}

      {!needsAuth && !compact && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void openSpreadsheet(spreadsheetInput);
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="text"
              value={spreadsheetInput}
              onChange={(e) => setSpreadsheetInput(e.target.value)}
              placeholder="Tempel ID atau URL Google Spreadsheet (https://docs.google.com/spreadsheets/d/...)"
              aria-label="ID atau URL Google Spreadsheet"
              className="flex-1 min-w-[260px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              disabled={loadingSheet || !spreadsheetInput.trim()}
              className="px-4 py-2 text-sm font-bold bg-[#0F2942] text-white rounded-lg hover:bg-[#173b5e] disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              Muat Spreadsheet
            </button>
            {meta?.spreadsheetUrl && (
              <a
                href={meta.spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                <span>Buka Sheets</span>
              </a>
            )}
          </form>

          {meta && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Spreadsheet Aktif</p>
                  <p className="font-display font-bold text-base text-[#0F2942]">
                    {meta.title} <span className="font-mono text-xs text-slate-500">({meta.spreadsheetId})</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRow((v) => !v)}
                    disabled={!activeSheetTitle || headers.length === 0}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tambah Baris</span>
                  </button>
                  {activeSheetTitle.toUpperCase().includes('PENGUMUMAN') && (
                    <button
                      type="button"
                      onClick={handleImportAnnouncementsFromSheet}
                      disabled={busyAction || rows.length < 2}
                      className="px-3 py-1.5 text-xs font-bold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] disabled:opacity-50 cursor-pointer"
                    >
                      Terapkan ke Pengumuman Website
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => activeSheetTitle && loadSheetTab(meta.spreadsheetId, activeSheetTitle)}
                    disabled={loadingSheet || !activeSheetTitle}
                    aria-label="Muat ulang tab spreadsheet"
                    className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingSheet ? 'animate-spin' : ''}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Dynamic Sheet Tabs */}
              <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
                {meta.sheets.map((tab) => (
                  <button
                    key={tab.sheetId}
                    type="button"
                    onClick={() => {
                      setActiveSheetTitle(tab.title);
                      setShowAddRow(false);
                      void loadSheetTab(meta.spreadsheetId, tab.title);
                    }}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer ${
                      activeSheetTitle === tab.title
                        ? 'bg-[#0F2942] text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Table2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{tab.title}</span>
                  </button>
                ))}
              </div>

              {showAddRow && headers.length > 0 && (
                <form onSubmit={handleAppendRowSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-[#0F2942]">
                    Tambah Baris Baru ke Tab "{activeSheetTitle}"
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {headers.map((col, idx) => (
                      <div key={`${col}-${idx}`}>
                        <label className="block text-xs font-mono font-semibold text-slate-600 mb-1 truncate">
                          {col}
                        </label>
                        <input
                          type="text"
                          value={newRowValues[idx] || ''}
                          onChange={(e) => {
                            const next = [...newRowValues];
                            next[idx] = e.target.value;
                            setNewRowValues(next);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRow(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={busyAction}
                      className="px-4 py-1.5 text-xs font-bold bg-[#0B6E4F] text-white rounded-lg cursor-pointer"
                    >
                      Simpan Baris ke Google Sheets
                    </button>
                  </div>
                </form>
              )}

              {/* Search Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter baris di sheet ini..."
                    aria-label="Filter baris sheet"
                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <span className="text-xs text-slate-500 tabular-nums">
                  {dataRows.length} baris ditampilkan
                </span>
              </div>

              {/* Sheet Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[420px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold sticky top-0">
                      {headers.length > 0 ? (
                        headers.map((col, idx) => (
                          <th key={`${col}-${idx}`} className="py-2.5 px-3 font-mono whitespace-nowrap">
                            {col}
                          </th>
                        ))
                      ) : (
                        <th className="py-2.5 px-3">Data Sheet</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingSheet ? (
                      <tr>
                        <td colSpan={Math.max(1, headers.length)} className="py-8 text-center text-slate-500">
                          Membaca data dari Google Sheets...
                        </td>
                      </tr>
                    ) : dataRows.length === 0 ? (
                      <tr>
                        <td colSpan={Math.max(1, headers.length)} className="py-8 text-center text-slate-500">
                          {headers.length === 0
                            ? 'Tab ini masih kosong. Klik "Sinkronkan Semua Data" untuk mengisi tabel dari WARGA AMPEL.'
                            : 'Tidak ada baris data yang cocok.'}
                        </td>
                      </tr>
                    ) : (
                      dataRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                          {headers.map((_, cIdx) => (
                            <td key={cIdx} className="py-2 px-3 text-slate-800 max-w-xs truncate tabular-nums">
                              {row[cIdx] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {confirmState && (
        <DriveConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          description={confirmState.description}
          affectedItems={confirmState.affectedItems}
          confirmLabel={confirmState.confirmLabel}
          danger={confirmState.danger}
          busy={busyAction}
          onConfirm={runConfirmedAction}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </div>
  );
};
