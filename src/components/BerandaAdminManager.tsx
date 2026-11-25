import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  Image as ImageIcon,
  Layers,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BerandaFooterInfo,
  PROGRAM_STATUS_OPTIONS,
  ProgramStatus,
  SheetBanner,
  SheetGaleri,
  SheetProgram,
  UserRole,
} from '../shared/types';
import {
  apiFetch,
  BERANDA_DRIVE_FOLDER_ID,
  BERANDA_DRIVE_FOLDER_URL,
  formatTanggalIndo,
  getGasWebAppUrl,
  setGasWebAppUrl,
} from '../lib/api';
import { compressImageFile, formatFileSize } from '../lib/imageCompression';
import { AnnouncementsManager } from './AdminModules';

interface BerandaAdminManagerProps {
  userRole: UserRole;
  onBerandaChanged: () => void;
}

type BerandaSubTab = 'banner' | 'program' | 'galeri' | 'pengumuman' | 'footer';

export const BerandaAdminManager: React.FC<BerandaAdminManagerProps> = ({
  userRole,
  onBerandaChanged,
}) => {
  if (userRole !== 'SUPER_ADMIN') {
    return (
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 text-amber-950 space-y-2">
        <h2 className="font-display text-lg font-bold">Akses Terbatas Khusus Super Admin</h2>
        <p className="text-sm">
          Pengelolaan konten Beranda (Hero Banner, Program Kelurahan, Galeri Kegiatan, dan Kontak Footer) hanya dapat dilakukan oleh akun <strong>SUPER_ADMIN</strong>.
        </p>
      </div>
    );
  }

  const [subTab, setSubTab] = useState<BerandaSubTab>('banner');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [driveFolderId, setDriveFolderId] = useState(BERANDA_DRIVE_FOLDER_ID);
  const [gasOutdated, setGasOutdated] = useState(false);
  const [customGasUrl, setCustomGasUrl] = useState(() => getGasWebAppUrl());

  // Banner state
  const [bannerJudul, setBannerJudul] = useState('WARGA AMPEL');
  const [bannerSambutan, setBannerSambutan] = useState('');
  const [bannerGambarUrl, setBannerGambarUrl] = useState('');
  const [bannerFileId, setBannerFileId] = useState('');
  const [bannerCompressedInfo, setBannerCompressedInfo] = useState('');
  const [savingBanner, setSavingBanner] = useState(false);

  // Program state
  const [programs, setPrograms] = useState<SheetProgram[]>([]);
  const [editProgId, setEditProgId] = useState<string | null>(null);
  const [progJudul, setProgJudul] = useState('');
  const [progTanggal, setProgTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [progRingkasan, setProgRingkasan] = useState('');
  const [progStatus, setProgStatus] = useState<ProgramStatus>('Akan Datang');
  const [progFotoUrl, setProgFotoUrl] = useState('');
  const [progFileId, setProgFileId] = useState('');
  const [progCompressedInfo, setProgCompressedInfo] = useState('');
  const [savingProg, setSavingProg] = useState(false);

  // Galeri state
  const [galeri, setGaleri] = useState<SheetGaleri[]>([]);
  const [editGalId, setEditGalId] = useState<string | null>(null);
  const [galJudul, setGalJudul] = useState('');
  const [galKeterangan, setGalKeterangan] = useState('');
  const [galTanggal, setGalTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [galFotoUrl, setGalFotoUrl] = useState('');
  const [galFileId, setGalFileId] = useState('');
  const [galCompressedInfo, setGalCompressedInfo] = useState('');
  const [savingGal, setSavingGal] = useState(false);

  // Footer state
  const [footerForm, setFooterForm] = useState<BerandaFooterInfo>({
    namaKantor: 'Balai Kelurahan Ampel',
    alamat: 'Jl. Raya Kelurahan Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember',
    telepon: '(0336) 621-104 / 0811-0000-0003',
    email: 'pelayanan@ampel.kelurahan.id',
    jamLayanan: 'Senin–Jumat, 08.00–14.30 WIB (Portal online aktif 24 jam)',
  });
  const [savingFooter, setSavingFooter] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch<{
        banner: SheetBanner | null;
        program: SheetProgram[];
        galeri: SheetGaleri[];
        footer: BerandaFooterInfo;
        driveFolderId?: string;
        gasOutdated?: boolean;
      }>('/api/admin/beranda');
      setGasOutdated(Boolean(res.gasOutdated));
      if (res.banner) {
        setBannerJudul(res.banner.JUDUL || 'WARGA AMPEL');
        setBannerSambutan(res.banner.KALIMAT_SAMBUTAN || '');
        setBannerGambarUrl(res.banner.GAMBAR_URL || '');
        setBannerFileId(res.banner.DRIVE_FILE_ID || '');
      }
      setPrograms(Array.isArray(res.program) ? res.program : []);
      setGaleri(Array.isArray(res.galeri) ? res.galeri : []);
      if (res.footer) setFooterForm(res.footer);
      if (res.driveFolderId) setDriveFolderId(res.driveFolderId);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal memuat data Beranda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg('');
  };

  const handleCompressAndUpload = async (
    file: File,
    category: 'hero' | 'program' | 'galeri',
    onDone: (res: { fotoUrl: string; driveFileId: string; summary: string }) => void
  ) => {
    setErrorMsg('');
    setSuccessMsg('');
    const compressed = await compressImageFile(file, {
      maxWidth: category === 'hero' ? 1600 : 1200,
      maxHeight: category === 'hero' ? 900 : 900,
      quality: 0.82,
    });
    const uploaded = await apiFetch<{ ok: boolean; fotoUrl: string; driveFileId: string }>(
      '/api/admin/beranda/upload',
      {
        method: 'POST',
        body: JSON.stringify({
          base64: compressed.dataUrl,
          fileName: compressed.fileName,
          category,
        }),
      }
    );
    onDone({
      fotoUrl: uploaded.fotoUrl,
      driveFileId: uploaded.driveFileId || '',
      summary: `Terkompresi & tersimpan ke Drive (${formatFileSize(compressed.originalBytes)} → ${formatFileSize(compressed.compressedBytes)}, ${compressed.width}×${compressed.height}px)`,
    });
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiFetch('/api/admin/beranda/banner', {
        method: 'PUT',
        body: JSON.stringify({
          judul: bannerJudul.trim() || 'WARGA AMPEL',
          kalimatSambutan: bannerSambutan.trim(),
          gambarUrl: bannerGambarUrl.trim(),
          driveFileId: bannerFileId.trim(),
        }),
      });
      await loadData();
      onBerandaChanged();
      flashSuccess('Hero Banner Beranda berhasil diperbarui dan tersimpan.');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan Hero Banner.');
    } finally {
      setSavingBanner(false);
    }
  };

  const resetProgramForm = () => {
    setEditProgId(null);
    setProgJudul('');
    setProgTanggal(new Date().toISOString().slice(0, 10));
    setProgRingkasan('');
    setProgStatus('Akan Datang');
    setProgFotoUrl('');
    setProgFileId('');
    setProgCompressedInfo('');
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProg(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        judul: progJudul.trim(),
        tanggal: progTanggal,
        ringkasan: progRingkasan.trim(),
        status: progStatus,
        fotoUrl: progFotoUrl.trim(),
        driveFileId: progFileId.trim(),
        aktif: true,
      };
      if (editProgId) {
        await apiFetch(`/api/admin/beranda/program/${encodeURIComponent(editProgId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        flashSuccess('Program kelurahan berhasil diperbarui.');
      } else {
        await apiFetch('/api/admin/beranda/program', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        flashSuccess('Program kelurahan baru berhasil ditambahkan.');
      }
      resetProgramForm();
      await loadData();
      onBerandaChanged();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan program kelurahan.');
    } finally {
      setSavingProg(false);
    }
  };

  const handleDeleteProgram = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiFetch(`/api/admin/beranda/program/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (editProgId === id) resetProgramForm();
      await loadData();
      onBerandaChanged();
      flashSuccess('Program kelurahan berhasil dihapus.');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menghapus program.');
    }
  };

  const resetGaleriForm = () => {
    setEditGalId(null);
    setGalJudul('');
    setGalKeterangan('');
    setGalTanggal(new Date().toISOString().slice(0, 10));
    setGalFotoUrl('');
    setGalFileId('');
    setGalCompressedInfo('');
  };

  const handleSaveGaleri = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGal(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        judul: galJudul.trim(),
        keterangan: galKeterangan.trim(),
        tanggal: galTanggal,
        fotoUrl: galFotoUrl.trim(),
        driveFileId: galFileId.trim(),
        aktif: true,
      };
      if (editGalId) {
        await apiFetch(`/api/admin/beranda/galeri/${encodeURIComponent(editGalId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        flashSuccess('Foto galeri kegiatan berhasil diperbarui.');
      } else {
        await apiFetch('/api/admin/beranda/galeri', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        flashSuccess('Foto baru berhasil ditambahkan ke Galeri Kegiatan.');
      }
      resetGaleriForm();
      await loadData();
      onBerandaChanged();
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan foto galeri.');
    } finally {
      setSavingGal(false);
    }
  };

  const handleDeleteGaleri = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiFetch(`/api/admin/beranda/galeri/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (editGalId === id) resetGaleriForm();
      await loadData();
      onBerandaChanged();
      flashSuccess('Foto galeri berhasil dihapus.');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menghapus foto galeri.');
    }
  };

  const handleSaveFooter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFooter(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiFetch('/api/admin/beranda/footer', {
        method: 'PUT',
        body: JSON.stringify(footerForm),
      });
      await loadData();
      onBerandaChanged();
      flashSuccess('Informasi kontak & jam layanan footer berhasil diperbarui.');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Gagal menyimpan informasi footer.');
    } finally {
      setSavingFooter(false);
    }
  };

  const folderHref = driveFolderId
    ? `https://drive.google.com/drive/folders/${driveFolderId}`
    : BERANDA_DRIVE_FOLDER_URL;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0B6E4F]">Khusus Super Admin · Google Drive &amp; Sheets Sync</p>
          <h2 className="font-display text-2xl font-bold text-[#0F2942] mt-0.5">
            Kelola Konten Beranda WARGA AMPEL
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Unggahan foto otomatis dikompres di browser sebelum disimpan ke Google Drive (akses baca publik) dan dicatat ke Google Sheets.
          </p>
        </div>
        <a
          href={folderHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0F2942] text-white text-sm font-semibold rounded-xl hover:bg-[#173b5e] whitespace-nowrap shrink-0"
        >
          <FolderOpen className="w-4 h-4" aria-hidden="true" />
          <span>Buka Folder Drive Foto Beranda</span>
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
        </a>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl p-2">
        {(
          [
            { id: 'banner', label: 'Hero Banner', icon: ImageIcon },
            { id: 'program', label: `Program Kelurahan (${programs.length})`, icon: Layers },
            { id: 'galeri', label: `Galeri Kegiatan (${galeri.length})`, icon: Upload },
            { id: 'pengumuman', label: 'Pengumuman', icon: Megaphone },
            { id: 'footer', label: 'Kontak & Jam Footer', icon: MapPin },
          ] as Array<{ id: BerandaSubTab; label: string; icon: React.ComponentType<{ className?: string }> }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubTab(tab.id);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#0B6E4F] text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {gasOutdated && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-3 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 text-sm">
              <p className="font-bold">Web App Google Apps Script (`Code.gs`) Masih Versi Lama</p>
              <p className="text-amber-900">
                Simpan Info Footer sudah otomatis tersambung ke sheet <code className="font-mono font-semibold">PENGATURAN</code>, namun tab Hero Banner, Program Kelurahan, Galeri Kegiatan, dan unggah foto Drive memerlukan pembaruan skrip Apps Script:
              </p>
              <ol className="list-decimal list-inside text-xs sm:text-sm space-y-0.5 text-amber-900">
                <li>Salin isi terbaru <code className="font-mono">gas/Code.gs</code> &amp; <code className="font-mono">gas/SetupDatabase.gs</code> ke editor Google Apps Script Anda.</li>
                <li>Jalankan fungsi <code className="font-mono">setupDatabase()</code> satu kali di editor Apps Script.</li>
                <li>Pilih <strong>Deploy → Kelola deployment → Edit (ikon pensil) → Versi baru → Deploy</strong> agar URL Web App tetap sama.</li>
              </ol>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="url"
              value={customGasUrl}
              onChange={(e) => setCustomGasUrl(e.target.value)}
              placeholder="Atau tempel URL Web App GAS baru (https://script.google.com/.../exec)"
              className="flex-1 min-w-[260px] px-3 py-1.5 text-xs font-mono bg-white border border-amber-300 rounded-lg"
            />
            <button
              type="button"
              onClick={async () => {
                setErrorMsg('');
                setSuccessMsg('');
                try {
                  if (customGasUrl.trim()) {
                    setGasWebAppUrl(customGasUrl.trim());
                  }
                  await loadData();
                  onBerandaChanged();
                  flashSuccess('Koneksi Web App Google Apps Script diperbarui.');
                } catch (err) {
                  setErrorMsg((err as Error).message || 'URL Web App GAS tidak valid.');
                }
              }}
              className="px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Terapkan &amp; Muat Ulang
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-sm font-semibold text-rose-900">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          Memuat konfigurasi Beranda dari database...
        </div>
      ) : subTab === 'banner' ? (
        <form onSubmit={handleSaveBanner} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">Judul Hero Beranda</label>
                <input
                  type="text"
                  required
                  value={bannerJudul}
                  onChange={(e) => setBannerJudul(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Kalimat Sambutan (1 kalimat singkat &amp; hangat)
                </label>
                <textarea
                  rows={2}
                  required
                  value={bannerSambutan}
                  onChange={(e) => setBannerSambutan(e.target.value)}
                  placeholder="Ikuti program kegiatan kelurahan, cek kabar terbaru kelurahan, atau sampaikan kebutuhan layanan Anda secara mudah."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                  Unggah Foto Banner Baru (Otomatis Kompres ke Drive)
                </label>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Pilih Gambar Hero (JPG/PNG/WebP)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setSavingBanner(true);
                        await handleCompressAndUpload(file, 'hero', (out) => {
                          setBannerGambarUrl(out.fotoUrl);
                          setBannerFileId(out.driveFileId);
                          setBannerCompressedInfo(out.summary);
                        });
                      } catch (err) {
                        setErrorMsg((err as Error).message || 'Gagal mengunggah gambar hero.');
                      } finally {
                        setSavingBanner(false);
                      }
                    }}
                  />
                </label>
                {bannerCompressedInfo && (
                  <p className="mt-1.5 text-xs font-medium text-[#0B6E4F]">{bannerCompressedInfo}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Atau URL Gambar Banner (Drive / HTTPS)
                </label>
                <input
                  type="text"
                  value={bannerGambarUrl}
                  onChange={(e) => setBannerGambarUrl(e.target.value)}
                  placeholder="https://drive.google.com/thumbnail?id=...&sz=w1600"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="lg:col-span-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">Pratinjau Banner Aktif</p>
              <div className="aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                {bannerGambarUrl ? (
                  <img
                    src={bannerGambarUrl}
                    alt="Pratinjau Hero Banner"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-500">Belum ada URL gambar custom (memakai foto default kelurahan)</span>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={savingBanner}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-bold rounded-lg disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{savingBanner ? 'Menyimpan...' : 'Simpan Hero Banner'}</span>
            </button>
          </div>
        </form>
      ) : subTab === 'program' ? (
        <div className="space-y-6">
          <form onSubmit={handleSaveProgram} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-[#0F2942]">
                {editProgId ? 'Ubah Program Kelurahan' : 'Tambah Program Kelurahan'}
              </h3>
              {editProgId && (
                <button
                  type="button"
                  onClick={resetProgramForm}
                  className="text-xs font-semibold text-slate-600 hover:underline cursor-pointer"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Program</label>
                <input
                  type="text"
                  required
                  value={progJudul}
                  onChange={(e) => setProgJudul(e.target.value)}
                  placeholder="Contoh: Posyandu Balita & Lansia Terpadu"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kegiatan</label>
                <input
                  type="date"
                  required
                  value={progTanggal}
                  onChange={(e) => setProgTanggal(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status Program</label>
                <select
                  value={progStatus}
                  onChange={(e) => setProgStatus(e.target.value as ProgramStatus)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {PROGRAM_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ringkasan Singkat (maksimal 2 baris di kartu Beranda)
              </label>
              <textarea
                rows={2}
                required
                maxLength={200}
                value={progRingkasan}
                onChange={(e) => setProgRingkasan(e.target.value)}
                placeholder="Ringkasan ajakan dan lokasi singkat untuk warga..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Unggah Foto Program (Kompres Otomatis)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setSavingProg(true);
                        await handleCompressAndUpload(file, 'program', (out) => {
                          setProgFotoUrl(out.fotoUrl);
                          setProgFileId(out.driveFileId);
                          setProgCompressedInfo(out.summary);
                        });
                      } catch (err) {
                        setErrorMsg((err as Error).message || 'Gagal mengunggah foto program.');
                      } finally {
                        setSavingProg(false);
                      }
                    }}
                  />
                </label>
                {progCompressedInfo && (
                  <p className="mt-1 text-xs text-[#0B6E4F] font-medium">{progCompressedInfo}</p>
                )}
              </div>
              <div className="md:col-span-7">
                <input
                  type="text"
                  value={progFotoUrl}
                  onChange={(e) => setProgFotoUrl(e.target.value)}
                  placeholder="URL Foto (terisi otomatis setelah unggah ke Drive)"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProg}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-bold rounded-lg disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{savingProg ? 'Menyimpan...' : editProgId ? 'Simpan Perubahan Program' : 'Tambah Program'}</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((p) => (
              <div key={p.ID_PROGRAM} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    {p.FOTO_URL ? (
                      <img src={p.FOTO_URL} alt={p.JUDUL} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Tanpa Foto</div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-medium text-slate-500">
                      {p.STATUS} · {formatTanggalIndo(p.TANGGAL)}
                    </p>
                    <h4 className="font-display font-bold text-base text-[#0F2942] mt-1">{p.JUDUL}</h4>
                    <p className="text-sm text-slate-600 mt-1 line-clamp-2">{p.RINGKASAN}</p>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditProgId(p.ID_PROGRAM);
                      setProgJudul(p.JUDUL);
                      setProgTanggal(p.TANGGAL);
                      setProgRingkasan(p.RINGKASAN);
                      setProgStatus(p.STATUS);
                      setProgFotoUrl(p.FOTO_URL || '');
                      setProgFileId(p.DRIVE_FILE_ID || '');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteProgram(p.ID_PROGRAM)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : subTab === 'galeri' ? (
        <div className="space-y-6">
          <form onSubmit={handleSaveGaleri} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-[#0F2942]">
                {editGalId ? 'Ubah Foto Galeri Kegiatan' : 'Tambah Foto ke Galeri Kegiatan'}
              </h3>
              {editGalId && (
                <button
                  type="button"
                  onClick={resetGaleriForm}
                  className="text-xs font-semibold text-slate-600 hover:underline cursor-pointer"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-8">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Judul Foto / Kegiatan</label>
                <input
                  type="text"
                  required
                  value={galJudul}
                  onChange={(e) => setGalJudul(e.target.value)}
                  placeholder="Contoh: Kerja Bakti Saluran RW 02"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal Kegiatan</label>
                <input
                  type="date"
                  required
                  value={galTanggal}
                  onChange={(e) => setGalTanggal(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan Foto (tampil saat diperbesar)</label>
              <input
                type="text"
                value={galKeterangan}
                onChange={(e) => setGalKeterangan(e.target.value)}
                placeholder="Deskripsi singkat suasana kegiatan warga..."
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5">
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 cursor-pointer">
                  <Upload className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
                  <span>Pilih Foto Kegiatan (Kompres Otomatis)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        setSavingGal(true);
                        await handleCompressAndUpload(file, 'galeri', (out) => {
                          setGalFotoUrl(out.fotoUrl);
                          setGalFileId(out.driveFileId);
                          setGalCompressedInfo(out.summary);
                        });
                      } catch (err) {
                        setErrorMsg((err as Error).message || 'Gagal mengunggah foto galeri.');
                      } finally {
                        setSavingGal(false);
                      }
                    }}
                  />
                </label>
                {galCompressedInfo && (
                  <p className="mt-1 text-xs text-[#0B6E4F] font-medium">{galCompressedInfo}</p>
                )}
              </div>
              <div className="md:col-span-7">
                <input
                  type="text"
                  required
                  value={galFotoUrl}
                  onChange={(e) => setGalFotoUrl(e.target.value)}
                  placeholder="URL Foto (terisi otomatis setelah unggah ke Drive)"
                  className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingGal}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-bold rounded-lg disabled:opacity-60 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{savingGal ? 'Menyimpan...' : editGalId ? 'Simpan Foto Galeri' : 'Tambahkan ke Galeri'}</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galeri.map((g) => (
              <div key={g.ID_GALERI} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                    <img src={g.FOTO_URL} alt={g.JUDUL} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-slate-500">{formatTanggalIndo(g.TANGGAL)}</p>
                    <p className="font-semibold text-sm text-[#0F2942] mt-0.5 line-clamp-2">{g.JUDUL}</p>
                  </div>
                </div>
                <div className="px-3 py-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditGalId(g.ID_GALERI);
                      setGalJudul(g.JUDUL);
                      setGalKeterangan(g.KETERANGAN || '');
                      setGalTanggal(g.TANGGAL);
                      setGalFotoUrl(g.FOTO_URL);
                      setGalFileId(g.DRIVE_FILE_ID || '');
                    }}
                    className="px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                  >
                    Ubah
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGaleri(g.ID_GALERI)}
                    className="px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : subTab === 'pengumuman' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <AnnouncementsManager />
        </div>
      ) : (
        <form onSubmit={handleSaveFooter} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <h3 className="font-display text-lg font-bold text-[#0F2942]">
            Kontak Kantor Kelurahan &amp; Jam Layanan (Footer Beranda)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kantor / Balai Kelurahan</label>
              <input
                type="text"
                required
                value={footerForm.namaKantor}
                onChange={(e) => setFooterForm((f) => ({ ...f, namaKantor: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Layanan Resmi</label>
              <input
                type="text"
                required
                value={footerForm.jamLayanan}
                onChange={(e) => setFooterForm((f) => ({ ...f, jamLayanan: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Kantor Kelurahan</label>
              <input
                type="text"
                required
                value={footerForm.alamat}
                onChange={(e) => setFooterForm((f) => ({ ...f, alamat: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon / WhatsApp Layanan</label>
              <input
                type="text"
                value={footerForm.telepon}
                onChange={(e) => setFooterForm((f) => ({ ...f, telepon: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Resmi</label>
              <input
                type="email"
                value={footerForm.email}
                onChange={(e) => setFooterForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingFooter}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-bold rounded-lg disabled:opacity-60 cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>{savingFooter ? 'Menyimpan...' : 'Simpan Info Footer'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
