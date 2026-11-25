import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { ServiceWithForm, SheetContohFile, UserRole } from '../shared/types';
import { apiFetch, formatTanggalIndo, readFileAsBase64 } from '../lib/api';

interface TemplateFilesAdminManagerProps {
  userRole: UserRole;
  services: ServiceWithForm[];
  onFilesChanged?: () => void;
}

function formatBytesReadable(bytes?: number): string {
  const n = Number(bytes) || 0;
  if (n <= 0) return 'Tautan';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export const TemplateFilesAdminManager: React.FC<TemplateFilesAdminManagerProps> = ({
  userRole,
  services,
  onFilesChanged,
}) => {
  const [files, setFiles] = useState<SheetContohFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [gasOutdated, setGasOutdated] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [idLayanan, setIdLayanan] = useState<string>('UMUM');
  const [judulFile, setJudulFile] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [urutan, setUrutan] = useState('1');
  const [aktif, setAktif] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    base64: string;
  } | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ files?: SheetContohFile[]; gasOutdated?: boolean }>(
        '/api/admin/template-files'
      );
      setFiles(Array.isArray(res?.files) ? res.files : []);
      setGasOutdated(Boolean(res?.gasOutdated));
    } catch (err) {
      setError((err as Error).message || 'Gagal memuat daftar contoh file.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  if (userRole !== 'SUPER_ADMIN') {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-700">
        Hanya <strong>Super Admin</strong> yang dapat mengunggah atau menghapus contoh file untuk warga &amp; publik.
      </div>
    );
  }

  const resetForm = () => {
    setEditingId(null);
    setIdLayanan('UMUM');
    setJudulFile('');
    setKeterangan('');
    setFileUrl('');
    setUrutan(String(files.length + 1));
    setAktif(true);
    setSelectedFile(null);
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setError('Ukuran file maksimal 4,5 MB agar unggahan ke Google Drive stabil.');
      return;
    }
    try {
      const parsed = await readFileAsBase64(file);
      setSelectedFile(parsed);
      if (!judulFile.trim()) {
        const cleanedTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
        setJudulFile(cleanedTitle);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (judulFile.trim().length < 2) {
      setError('Judul contoh file wajib diisi (minimal 2 karakter).');
      return;
    }
    if (!editingId && !selectedFile && !fileUrl.trim()) {
      setError('Pilih berkas dari perangkat Anda atau masukkan tautan Google Drive / URL file.');
      return;
    }

    const matchedSvc = services.find((s) => s.ID_LAYANAN === idLayanan);
    const namaLayanan =
      idLayanan === 'UMUM' ? 'Semua Layanan / Umum' : matchedSvc?.NAMA_LAYANAN || idLayanan;

    setSaving(true);
    try {
      const payload = {
        idLayanan,
        namaLayanan,
        judulFile: judulFile.trim(),
        keterangan: keterangan.trim(),
        fileUrl: fileUrl.trim(),
        urutan: Number(urutan) || 1,
        aktif,
        fileBase64: selectedFile?.base64 || '',
        fileName: selectedFile?.fileName || '',
        mimeType: selectedFile?.mimeType || '',
        sizeBytes: selectedFile?.sizeBytes || 0,
      };

      if (editingId) {
        await apiFetch(`/api/admin/template-files/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setMessage('Contoh file berhasil diperbarui dan langsung tersedia bagi warga & publik.');
      } else {
        await apiFetch('/api/admin/template-files', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Contoh file berhasil diunggah dan dapat langsung diunduh oleh warga & publik.');
      }
      resetForm();
      await loadFiles();
      onFilesChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Gagal menyimpan contoh file.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: SheetContohFile) => {
    setEditingId(item.ID_FILE);
    setIdLayanan(item.ID_LAYANAN || 'UMUM');
    setJudulFile(item.JUDUL_FILE || '');
    setKeterangan(item.KETERANGAN || '');
    setFileUrl(item.FILE_URL || '');
    setUrutan(String(item.URUTAN || 1));
    setAktif(item.AKTIF !== false);
    setSelectedFile(null);
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item: SheetContohFile) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/template-files/${encodeURIComponent(item.ID_FILE)}`, {
        method: 'DELETE',
      });
      if (editingId === item.ID_FILE) resetForm();
      setMessage(`Contoh file "${item.JUDUL_FILE}" telah dihapus.`);
      await loadFiles();
      onFilesChanged?.();
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus contoh file.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0B6E4F]">
            Khusus Super Admin · Akses Unduhan Publik (Akun Warga &amp; Orang Awam)
          </p>
          <h2 className="mt-1 font-display text-xl sm:text-2xl font-extrabold text-[#0F2942]">
            Unggah Contoh File &amp; Blangko Layanan Kelurahan
          </h2>
          <p className="mt-1 text-sm text-slate-600 max-w-3xl">
            Unggah contoh pengisian formulir, blangko PDF, Word (.doc/.docx), Excel, atau gambar panduan.
            File tersimpan dengan akses unduh terbuka untuk seluruh akun warga maupun pengunjung umum tanpa login.
          </p>
        </div>
      </div>

      {gasOutdated && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-950">
          Backend Google Apps Script yang terhubung perlu diperbarui dengan versi terbaru{' '}
          <span className="font-mono font-semibold">gas/Code.gs</span> &amp;{' '}
          <span className="font-mono font-semibold">gas/SetupDatabase.gs</span> (Deploy → Kelola
          deployment → Edit → Versi baru) agar unggahan file langsung tersimpan ke Google Drive dan sheet{' '}
          <span className="font-mono font-semibold">CONTOH_FILE</span>.
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-sm font-medium text-rose-900">
          {error}
        </div>
      )}

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-medium text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#0B6E4F] shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </div>
      )}

      {/* Upload / Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#0F2942] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
            <span>{editingId ? 'Edit Contoh File' : 'Tambah / Unggah Contoh File Baru'}</span>
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-semibold text-slate-600 hover:underline cursor-pointer"
            >
              Batal Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="cf-layanan" className="block text-sm font-semibold text-slate-900 mb-1">
              Kaitkan dengan Layanan
            </label>
            <select
              id="cf-layanan"
              value={idLayanan}
              onChange={(e) => setIdLayanan(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl bg-white"
            >
              <option value="UMUM">Semua Layanan / Umum</option>
              {services.map((svc) => (
                <option key={svc.ID_LAYANAN} value={svc.ID_LAYANAN}>
                  {svc.NAMA_LAYANAN} ({svc.KATEGORI_GRUP})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="cf-judul" className="block text-sm font-semibold text-slate-900 mb-1">
              Judul Contoh File <span className="text-rose-700">*</span>
            </label>
            <input
              id="cf-judul"
              type="text"
              value={judulFile}
              onChange={(e) => setJudulFile(e.target.value)}
              placeholder="Misal: Contoh Pengisian F-1.02 Pindah Datang"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
            />
          </div>

          <div>
            <label htmlFor="cf-urutan" className="block text-sm font-semibold text-slate-900 mb-1">
              Urutan Tampil
            </label>
            <input
              id="cf-urutan"
              type="number"
              min={1}
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <label htmlFor="cf-ket" className="block text-sm font-semibold text-slate-900 mb-1">
            Keterangan / Petunjuk untuk Warga
          </label>
          <textarea
            id="cf-ket"
            rows={2}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Misal: Unduh contoh ini sebagai panduan pengisian formulir sebelum diserahkan ke loket Kelurahan Ampel."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-2">
            <label htmlFor="cf-file-input" className="block text-sm font-semibold text-[#0F2942]">
              Unggah File dari Komputer / HP (Maks. 4,5 MB)
            </label>
            <input
              id="cf-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
              onChange={handleFilePick}
              className="w-full text-sm text-slate-700"
            />
            <p className="text-xs text-slate-500">
              Format didukung: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), JPG, PNG.
            </p>
            {selectedFile && (
              <p className="text-xs font-semibold text-[#0B6E4F]">
                File siap diunggah: {selectedFile.fileName} ({formatBytesReadable(selectedFile.sizeBytes)})
              </p>
            )}
          </div>

          <div className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
            <label htmlFor="cf-url" className="block text-sm font-semibold text-[#0F2942]">
              Atau Tempel Tautan Google Drive / URL File (Opsional)
            </label>
            <input
              id="cf-url"
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
            />
            <p className="text-xs text-slate-500">
              Jika mengunggah file langsung di sebelah kiri, tautan unduhan akan dibuat otomatis.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={aktif}
              onChange={(e) => setAktif(e.target.checked)}
              className="w-4 h-4 accent-[#0B6E4F]"
            />
            <span>Tampilkan untuk diunduh akun warga &amp; pengunjung umum</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] disabled:opacity-60 text-white text-sm font-bold rounded-xl inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Unggah & Terbitkan File'}</span>
          </button>
        </div>
      </form>

      {/* Uploaded Template Files List */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-[#0F2942] flex items-center gap-2">
            <FileDown className="w-5 h-5 text-[#0B6E4F]" aria-hidden="true" />
            <span>Daftar Contoh File Terunggah ({files.length})</span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Memuat daftar contoh file...</div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-600">
            Belum ada contoh file yang diunggah. Gunakan formulir di atas untuk mengunggah contoh file pertama bagi warga.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Judul &amp; Nama File</th>
                  <th className="py-3 px-4">Layanan Terkait</th>
                  <th className="py-3 px-4">Ukuran</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Diperbarui</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {files.map((item) => (
                  <tr key={item.ID_FILE} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-start gap-2.5">
                        <FileText className="w-4 h-4 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-slate-900">{item.JUDUL_FILE}</p>
                          <p className="text-xs text-slate-500 font-mono">{item.NAMA_FILE_ASLI}</p>
                          {item.KETERANGAN && (
                            <p className="text-xs text-slate-600 mt-0.5">{item.KETERANGAN}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{item.NAMA_LAYANAN}</td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatBytesReadable(item.UKURAN_BYTES)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-semibold ${
                          item.AKTIF !== false ? 'text-[#0B6E4F]' : 'text-slate-500'
                        }`}
                      >
                        {item.AKTIF !== false ? 'Publik (Aktif)' : 'Disembunyikan'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatTanggalIndo(item.UPDATED_AT || item.CREATED_AT)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={item.FILE_URL}
                          download={item.NAMA_FILE_ASLI || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 text-xs font-semibold border border-emerald-300 text-[#0B6E4F] rounded-lg hover:bg-emerald-50 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Unduh</span>
                        </a>
                        {item.PREVIEW_URL && item.PREVIEW_URL !== item.FILE_URL && (
                          <a
                            href={item.PREVIEW_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                            aria-label={`Lihat ${item.JUDUL_FILE}`}
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                          aria-label={`Edit ${item.JUDUL_FILE}`}
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                          aria-label={`Hapus ${item.JUDUL_FILE}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
