import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ChevronRight,
  CloudUpload,
  DatabaseBackup,
  Download,
  ExternalLink,
  FileText,
  Folder,
  FolderPlus,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  getGoogleDriveAccessToken,
  googleSignIn,
  initGoogleDriveAuth,
  isFirebaseOAuthSupportedOrigin,
  logoutGoogleDrive,
} from '../lib/googleDriveAuth';
import {
  createDriveFolder,
  deleteDriveFile,
  downloadDriveFile,
  DRIVE_FOLDER_MIME,
  ensureSiwargaDriveStructure,
  extractDriveFolderId,
  findDriveFolderByName,
  getDriveFileMetadata,
  GoogleDriveFileItem,
  listDriveFiles,
  renameDriveFile,
  updateFileContentInDrive,
  uploadFileToDrive,
} from '../lib/googleDriveClient';
import {
  apiFetch,
  DEFAULT_DRIVE_FOLDER_ID,
  DEFAULT_SPREADSHEET_ID,
  fetchGasConnectionStatus,
  formatTanggalIndo,
  getStoredToken,
  isGasMode,
} from '../lib/api';
import { SheetBuktiDokumen, SheetPengaturan } from '../shared/types';
import { GoogleSignInButton } from './GoogleSignInButton';
import { DriveConfirmDialog } from './DriveConfirmDialog';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDriveWorkspacePanelProps {
  localEvidence?: SheetBuktiDokumen[];
  onEvidenceSynced?: () => void;
  compact?: boolean;
}

function formatBytes(raw?: string): string {
  const n = Number(raw || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export const GoogleDriveWorkspacePanel: React.FC<GoogleDriveWorkspacePanelProps> = ({
  localEvidence = [],
  onEvidenceSynced,
  compact = false,
}) => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'Google Drive Saya' },
  ]);
  const [files, setFiles] = useState<GoogleDriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [configuredRootId, setConfiguredRootId] = useState(DEFAULT_DRIVE_FOLDER_ID);
  const [linkedSheetId, setLinkedSheetId] = useState(DEFAULT_SPREADSHEET_ID);
  const [gasConnected, setGasConnected] = useState(false);
  const canUseFirebaseOAuth = isFirebaseOAuthSupportedOrigin();
  const gasMode = isGasMode();

  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renamingFile, setRenamingFile] = useState<{ id: string; name: string } | null>(null);

  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busyAction, setBusyAction] = useState(false);

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    affectedItems?: string[];
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  useEffect(() => {
    const unsubscribe = initGoogleDriveAuth(
      (authedUser) => {
        setDriveUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setDriveUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    fetchGasConnectionStatus().then((status) => {
      if (!active) return;
      setGasConnected(status.connected);
      if (status.rootFolderId) setConfiguredRootId(status.rootFolderId);
      if (status.spreadsheetId) setLinkedSheetId(status.spreadsheetId);
    });

    apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings')
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.settings) ? res.settings : [];
        const rootSetting = String(list.find((s) => s.KUNCI === 'DRIVE_ROOT_FOLDER_ID')?.NILAI || '');
        if (rootSetting && !rootSetting.includes('ISI_') && !rootSetting.includes('GANTI_')) {
          setConfiguredRootId(rootSetting);
        }
        const sheetSetting = String(list.find((s) => s.KUNCI === 'SPREADSHEET_ID')?.NILAI || '');
        if (
          sheetSetting &&
          !sheetSetting.includes('CONTOH') &&
          !sheetSetting.includes('ISI_') &&
          !sheetSetting.includes('GANTI_')
        ) {
          setLinkedSheetId(sheetSetting);
        }
      })
      .catch(() => {
        // ignore if settings unavailable
      });
    return () => {
      active = false;
    };
  }, []);

  const loadFolder = async (folderId: string, search = searchQuery) => {
    const token = await getGoogleDriveAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setLoadingFiles(true);
    setErrorMsg('');
    try {
      const list = await listDriveFiles({
        folderId: search.trim() ? undefined : folderId,
        search: search.trim() || undefined,
      });
      setFiles(list);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (!needsAuth) {
      void loadFolder(currentFolder.id, '');
    }
  }, [needsAuth, currentFolder.id]);

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setErrorMsg('');
    try {
      const result = await googleSignIn();
      setDriveUser(result.user);
      setNeedsAuth(false);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal masuk dengan Google.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logoutGoogleDrive();
    setDriveUser(null);
    setNeedsAuth(true);
    setFiles([]);
    setBreadcrumbs([{ id: 'root', name: 'Google Drive Saya' }]);
    setNotice('');
  };

  const handleOpenFolderByIdOrUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = folderInput.trim();
    if (!raw) return;
    setErrorMsg('');
    setNotice('');
    setBusyAction(true);
    try {
      const id = extractDriveFolderId(raw);
      const meta = await getDriveFileMetadata(id);
      if (meta.mimeType !== DRIVE_FOLDER_MIME) {
        setErrorMsg(`"${meta.name}" bukan sebuah folder Google Drive.`);
        return;
      }
      setSearchQuery('');
      setBreadcrumbs([
        { id: 'root', name: 'Google Drive Saya' },
        { id: meta.id, name: meta.name },
      ]);
      setFolderInput('');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'AUTH_REQUIRED') setNeedsAuth(true);
      else setErrorMsg(msg);
    } finally {
      setBusyAction(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadFolder(currentFolder.id, searchQuery);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setBusyAction(true);
    setErrorMsg('');
    try {
      const created = await createDriveFolder(newFolderName.trim(), currentFolder.id);
      setNotice(`Folder "${created.name}" berhasil dibuat di Google Drive.`);
      setNewFolderName('');
      setShowNewFolder(false);
      await loadFolder(currentFolder.id);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusyAction(true);
    setErrorMsg('');
    setNotice('');
    try {
      const uploaded = await uploadFileToDrive({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        blob: file,
        parentId: currentFolder.id,
      });
      setNotice(`File "${uploaded.name}" berhasil diunggah ke Google Drive.`);
      await loadFolder(currentFolder.id);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleInitSiwargaFolders = async () => {
    setBusyAction(true);
    setErrorMsg('');
    setNotice('');
    try {
      const { rootFolder } = await ensureSiwargaDriveStructure(configuredRootId);
      setConfiguredRootId(rootFolder.id);
      setBreadcrumbs([
        { id: 'root', name: 'Google Drive Saya' },
        { id: rootFolder.id, name: rootFolder.name },
      ]);
      setNotice(
        `Struktur folder "${rootFolder.name}" (beserta subfolder arsip kelurahan) siap di Google Drive.`
      );

      // Ask confirmation before saving DRIVE_ROOT_FOLDER_ID to system settings
      setConfirmState({
        open: true,
        title: 'Simpan ID Folder Root ke Pengaturan Kelurahan?',
        description: `Folder "${rootFolder.name}" telah dibuat/ditemukan di Google Drive. Apakah Anda ingin menyimpan ID folder ini (${rootFolder.id}) ke pengaturan DRIVE_ROOT_FOLDER_ID sistem WARGA AMPEL?`,
        confirmLabel: 'Simpan ke Pengaturan',
        onConfirm: async () => {
          const currentSettings = await apiFetch<{ settings: SheetPengaturan[] }>('/api/admin/settings');
          const list = Array.isArray(currentSettings?.settings) ? currentSettings.settings : [];
          const nextSettings = list.map((s) =>
            s.KUNCI === 'DRIVE_ROOT_FOLDER_ID' ? { ...s, NILAI: rootFolder.id } : s
          );
          await apiFetch('/api/admin/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings: nextSettings }),
          });
          setNotice(
            `ID folder "${rootFolder.name}" (${rootFolder.id}) disimpan ke pengaturan DRIVE_ROOT_FOLDER_ID.`
          );
        },
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleBackupDatabaseToDrive = async () => {
    setBusyAction(true);
    setErrorMsg('');
    setNotice('');
    try {
      const backupData = await apiFetch<Record<string, unknown>>('/api/admin/backup-json');
      const { subfolders } = await ensureSiwargaDriveStructure(configuredRootId);
      const targetFolder = subfolders['05_DOKUMEN_PENDUKUNG'];
      const fileName = 'siwarga_db_backup.json';
      const existing = await listDriveFiles({ folderId: targetFolder.id, search: fileName });
      const exactMatch = existing.find((f) => f.name === fileName);
      const jsonBlob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });

      if (exactMatch) {
        setConfirmState({
          open: true,
          title: 'Timpa File Cadangan di Google Drive?',
          description: `File "${fileName}" sudah ada di folder 05_DOKUMEN_PENDUKUNG Google Drive. Menimpanya akan mengganti isi cadangan sebelumnya.`,
          affectedItems: [`${targetFolder.name}/${fileName} (${exactMatch.id})`],
          confirmLabel: 'Timpa Cadangan',
          onConfirm: async () => {
            await updateFileContentInDrive({
              fileId: exactMatch.id,
              mimeType: 'application/json',
              blob: jsonBlob,
            });
            setNotice(
              `Cadangan database berhasil diperbarui di ${targetFolder.name}/${fileName}.`
            );
            await loadFolder(currentFolder.id);
          },
        });
      } else {
        const uploaded = await uploadFileToDrive({
          fileName,
          mimeType: 'application/json',
          blob: jsonBlob,
          parentId: targetFolder.id,
        });
        setNotice(
          `Cadangan database berhasil diunggah ke Google Drive (${targetFolder.name}/${uploaded.name}).`
        );
        await loadFolder(currentFolder.id);
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleSyncSingleEvidence = (doc: SheetBuktiDokumen) => {
    setConfirmState({
      open: true,
      title: 'Unggah Bukti Penanganan ke Google Drive?',
      description: `Berkas "${doc.NAMA_FILE}" untuk tiket ${doc.ID_LAPORAN} akan diunggah ke folder arsip Google Drive (${doc.DRIVE_FOLDER_SUB}) dan tautan Drive-nya akan diperbarui.`,
      affectedItems: [`${doc.ID_LAPORAN} · ${doc.NAMA_FILE}`],
      confirmLabel: 'Unggah ke Drive',
      onConfirm: async () => {
        const { subfolders, rootFolder } = await ensureSiwargaDriveStructure(configuredRootId);
        let targetParentId = rootFolder.id;

        if (doc.DRIVE_FOLDER_SUB.startsWith('01_LAPORAN_WARGA')) {
          const parentLaporan = subfolders['01_LAPORAN_WARGA'];
          let ticketFolder = await findDriveFolderByName(doc.ID_LAPORAN, parentLaporan.id);
          if (!ticketFolder) {
            ticketFolder = await createDriveFolder(doc.ID_LAPORAN, parentLaporan.id);
          }
          targetParentId = ticketFolder.id;
        } else if (subfolders[doc.DRIVE_FOLDER_SUB]) {
          targetParentId = subfolders[doc.DRIVE_FOLDER_SUB].id;
        }

        const token = getStoredToken();
        const fileRes = await fetch(`/api/evidence/${encodeURIComponent(doc.ID_BUKTI)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!fileRes.ok) {
          throw new Error('Gagal membaca berkas bukti lokal untuk disinkronkan.');
        }
        const blob = await fileRes.blob();
        const uploaded = await uploadFileToDrive({
          fileName: doc.NAMA_FILE,
          mimeType: doc.MIME_TYPE || blob.type || 'application/octet-stream',
          blob,
          parentId: targetParentId,
        });

        await apiFetch(`/api/admin/evidence/${encodeURIComponent(doc.ID_BUKTI)}/drive-link`, {
          method: 'PATCH',
          body: JSON.stringify({
            driveFileId: uploaded.id,
            driveWebViewLink: uploaded.webViewLink || '',
          }),
        });

        setNotice(`Bukti "${doc.NAMA_FILE}" tersinkron ke Google Drive (ID: ${uploaded.id}).`);
        if (onEvidenceSynced) onEvidenceSynced();
        await loadFolder(currentFolder.id);
      },
    });
  };

  const requestRename = (file: GoogleDriveFileItem) => {
    setRenamingFile({ id: file.id, name: file.name });
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !renamingFile.name.trim()) return;
    const target = renamingFile;
    setConfirmState({
      open: true,
      title: 'Ubah Nama File di Google Drive?',
      description: `Apakah Anda yakin ingin mengubah nama file menjadi "${target.name.trim()}" di Google Drive?`,
      affectedItems: [target.name.trim()],
      confirmLabel: 'Ubah Nama',
      onConfirm: async () => {
        await renameDriveFile(target.id, target.name.trim());
        setRenamingFile(null);
        setNotice(`Nama item berhasil diperbarui menjadi "${target.name.trim()}".`);
        await loadFolder(currentFolder.id);
      },
    });
  };

  const requestDelete = (file: GoogleDriveFileItem) => {
    setConfirmState({
      open: true,
      title: 'Hapus File dari Google Drive?',
      description:
        'Tindakan ini akan menghapus file dari Google Drive Anda dan tidak dapat dibatalkan.',
      affectedItems: [`${file.name} (${file.id})`],
      confirmLabel: 'Hapus Permanen',
      danger: true,
      onConfirm: async () => {
        await deleteDriveFile(file.id);
        setNotice(`"${file.name}" berhasil dihapus dari Google Drive.`);
        await loadFolder(currentFolder.id);
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

  const effectiveDriveId = configuredRootId || DEFAULT_DRIVE_FOLDER_ID;
  const effectiveDriveUrl = `https://drive.google.com/drive/folders/${effectiveDriveId}`;
  const effectiveSheetUrl = `https://docs.google.com/spreadsheets/d/${linkedSheetId || DEFAULT_SPREADSHEET_ID}/edit`;

  return (
    <div className="space-y-5">
      {/* Google Drive Connection Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[#0F2942]">
            Integrasi Google Drive (Arsip Kelurahan)
          </h3>
          {needsAuth ? (
            <p className="text-sm text-slate-600 mt-0.5">
              {gasMode || !canUseFirebaseOAuth
                ? `Terhubung ${gasConnected ? 'aktif' : ''} melalui Google Apps Script · ID Folder Drive: ${effectiveDriveId}`
                : 'Masuk dengan akun Google untuk menjelajahi folder, mengunggah bukti laporan, dan mencadangkan database ke Google Drive Anda.'}
            </p>
          ) : (
            <p className="text-sm text-slate-700 mt-0.5">
              Terhubung sebagai{' '}
              <span className="font-semibold text-[#0F2942]">
                {driveUser?.displayName || driveUser?.email || 'Akun Google'}
              </span>
              {driveUser?.email && (
                <span className="text-slate-500"> · {driveUser.email}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href={effectiveDriveUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] flex items-center gap-1.5 whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span>Buka Folder Drive</span>
          </a>
          <a
            href={effectiveSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold border border-slate-300 text-slate-800 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap"
          >
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            <span>Buka Google Sheets</span>
          </a>
          {needsAuth ? (
            canUseFirebaseOAuth ? (
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={signingIn}
                label={signingIn ? 'Menghubungkan...' : 'Sign in with Google'}
              />
            ) : null
          ) : (
            <>
              <button
                type="button"
                onClick={handleInitSiwargaFolders}
                disabled={busyAction}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                Inisialisasi Folder Drive
              </button>
              <button
                type="button"
                onClick={handleBackupDatabaseToDrive}
                disabled={busyAction}
                className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-[#0F2942] text-white rounded-lg hover:bg-[#173b5e] disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <DatabaseBackup className="w-4 h-4" aria-hidden="true" />
                <span>Cadangkan DB</span>
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

      {/* Live Google Drive Browser */}
      {!needsAuth && !compact && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {/* Toolbar: Jump by Folder ID + Search + Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <form onSubmit={handleOpenFolderByIdOrUrl} className="lg:col-span-5 flex gap-2">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                placeholder="Tempel ID atau URL Folder Drive..."
                aria-label="ID atau URL Folder Google Drive"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <button
                type="submit"
                disabled={busyAction || !folderInput.trim()}
                className="px-3.5 py-2 text-sm font-semibold bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buka Folder
              </button>
            </form>

            <form onSubmit={handleSearchSubmit} className="lg:col-span-4 flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama file/folder di Drive..."
                  aria-label="Cari file Google Drive"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={loadingFiles}
                className="px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cari
              </button>
            </form>

            <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewFolder((v) => !v)}
                className="px-3 py-2 text-xs sm:text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" aria-hidden="true" />
                <span>Folder</span>
              </button>
              <label className="px-3 py-2 text-xs sm:text-sm font-bold bg-[#0B6E4F] text-white rounded-lg hover:bg-[#08553d] flex items-center gap-1.5 whitespace-nowrap cursor-pointer">
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>Unggah</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadFile}
                  disabled={busyAction}
                />
              </label>
              <button
                type="button"
                onClick={() => loadFolder(currentFolder.id)}
                disabled={loadingFiles}
                aria-label="Muat ulang daftar Google Drive"
                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Inline Create Folder Form */}
          {showNewFolder && (
            <form onSubmit={handleCreateFolder} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2">
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nama folder baru..."
                className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={busyAction}
                className="px-4 py-2 text-sm font-bold bg-[#0F2942] text-white rounded-lg cursor-pointer"
              >
                Buat Folder
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolder(false)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Batal
              </button>
            </form>
          )}

          {/* Inline Rename Form */}
          {renamingFile && (
            <form onSubmit={submitRename} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Nama baru:</span>
              <input
                type="text"
                required
                value={renamingFile.name}
                onChange={(e) => setRenamingFile({ ...renamingFile, name: e.target.value })}
                className="flex-1 min-w-[200px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={busyAction}
                className="px-4 py-2 text-sm font-bold bg-[#0B6E4F] text-white rounded-lg cursor-pointer"
              >
                Simpan Nama
              </button>
              <button
                type="button"
                onClick={() => setRenamingFile(null)}
                className="px-3 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Batal
              </button>
            </form>
          )}

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb Google Drive" className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={`${crumb.id}-${idx}`}>
                {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />}
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setBreadcrumbs((prev) => prev.slice(0, idx + 1));
                  }}
                  className={`px-2 py-1 rounded hover:bg-slate-100 cursor-pointer ${
                    idx === breadcrumbs.length - 1 ? 'font-bold text-[#0F2942]' : ''
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
            {configuredRootId && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const meta = await getDriveFileMetadata(configuredRootId);
                    setSearchQuery('');
                    setBreadcrumbs([
                      { id: 'root', name: 'Google Drive Saya' },
                      { id: meta.id, name: meta.name },
                    ]);
                  } catch (err) {
                    setErrorMsg((err as Error).message);
                  }
                }}
                className="ml-auto text-xs font-semibold text-[#0B6E4F] hover:underline cursor-pointer"
              >
                Lompat ke Folder Utama
              </button>
            )}
          </nav>

          {/* Drive File List Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                  <th className="py-2.5 px-4">Nama File / Folder</th>
                  <th className="py-2.5 px-4">Ukuran</th>
                  <th className="py-2.5 px-4">Diubah</th>
                  <th className="py-2.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loadingFiles ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Memuat daftar file dari Google Drive...
                    </td>
                  </tr>
                ) : files.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      Folder ini kosong atau tidak ada file yang cocok.
                    </td>
                  </tr>
                ) : (
                  files.map((file) => {
                    const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
                    return (
                      <tr key={file.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4">
                          {isFolder ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
                              }}
                              className="flex items-center gap-2 font-semibold text-[#0F2942] hover:text-[#0B6E4F] cursor-pointer text-left"
                            >
                              <Folder className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-xs sm:max-w-md">{file.name}</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-900">
                              <FileText className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                              <span className="truncate max-w-xs sm:max-w-md font-medium">{file.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {isFolder ? 'Folder' : formatBytes(file.size)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-600 whitespace-nowrap">
                          {file.modifiedTime ? formatTanggalIndo(file.modifiedTime) : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {!isFolder && (
                              <button
                                type="button"
                                onClick={() => downloadDriveFile(file).catch((err) => setErrorMsg(err.message))}
                                title="Unduh dari Google Drive"
                                aria-label={`Unduh ${file.name}`}
                                className="p-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                title="Lihat di Google Drive"
                                aria-label={`Buka ${file.name} di tab baru`}
                                className="p-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700"
                              >
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                              </a>
                            )}
                            {file.capabilities?.canRename !== false && (
                              <button
                                type="button"
                                onClick={() => requestRename(file)}
                                title="Ganti nama"
                                aria-label={`Ganti nama ${file.name}`}
                                className="p-1.5 border border-slate-300 rounded hover:bg-slate-100 text-slate-700 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                            {file.capabilities?.canDelete !== false && (
                              <button
                                type="button"
                                onClick={() => requestDelete(file)}
                                title="Hapus dari Drive"
                                aria-label={`Hapus ${file.name}`}
                                className="p-1.5 border border-rose-200 rounded hover:bg-rose-50 text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Local Evidence Sync Strip */}
          {localEvidence.length > 0 && (
            <div className="pt-2 border-t border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-display text-sm font-bold text-[#0F2942]">
                  Sinkronkan Bukti Penanganan Lokal ke Google Drive
                </h4>
                <span className="text-xs text-slate-500 tabular-nums">
                  {localEvidence.length} berkas lokal tercatat
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {localEvidence.slice(0, 6).map((doc) => {
                  const syncedToRealDrive =
                    doc.DRIVE_FILE_ID && !doc.DRIVE_FILE_ID.startsWith('DRV-');
                  return (
                    <div
                      key={doc.ID_BUKTI}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-[#0F2942]">
                          {doc.ID_LAPORAN} · {doc.JENIS_BUKTI}
                        </p>
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {doc.NAMA_FILE}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSyncSingleEvidence(doc)}
                        disabled={busyAction}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                          syncedToRealDrive
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                            : 'bg-[#0F2942] text-white hover:bg-[#173b5e]'
                        }`}
                      >
                        <CloudUpload className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{syncedToRealDrive ? 'Unggah Ulang' : 'Unggah ke Drive'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
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
