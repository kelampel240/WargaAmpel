import React, { useState } from 'react';
import { Download, FileSpreadsheet, Plus, Trash2, Upload, X } from 'lucide-react';
import {
  FORM_FIELD_TYPES,
  FormFieldType,
  REPORT_STATUSES,
  SERVICE_GROUPS,
  ServiceGroup,
  ServiceWithForm,
  SheetKonfigurasiForm,
  SheetPetugas,
} from '../shared/types';
import { apiFetch } from '../lib/api';
import { downloadServicesTemplate, exportServicesToExcel } from '../lib/excelExport';
import { ParsedImportRow, parseServicesImportExcel } from '../lib/excelImport';
import { ExcelImportModal } from './ExcelImportModal';

interface ServiceBuilderProps {
  services: ServiceWithForm[];
  petugasList: SheetPetugas[];
  onRefresh: () => void;
}

const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: 'Teks singkat',
  textarea: 'Teks panjang (textarea)',
  dropdown: 'Dropdown (pilihan)',
  radio: 'Pilihan tunggal (radio)',
  checkbox: 'Pilihan ganda (checkbox)',
  date: 'Tanggal',
  photo: 'Unggah foto',
  pdf: 'Unggah PDF',
  location: 'Lokasi / alamat',
};

export const ServiceBuilder: React.FC<ServiceBuilderProps> = ({
  services,
  petugasList,
  onRefresh,
}) => {
  const [showCreator, setShowCreator] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmDeleteSvc, setConfirmDeleteSvc] = useState<ServiceWithForm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [namaLayanan, setNamaLayanan] = useState('');
  const [kategoriGrup, setKategoriGrup] = useState<ServiceGroup>('C. Administrasi');
  const [deskripsi, setDeskripsi] = useState('');
  const [ikon, setIkon] = useState('file-text');
  const [persyaratanDokumen, setPersyaratanDokumen] = useState('Foto KTP / KK (opsional)');
  const [idPetugasPj, setIdPetugasPj] = useState(petugasList[0]?.ID_PETUGAS || 'PTG-001');
  const [statusAktif, setStatusAktif] = useState(true);
  const [fields, setFields] = useState<
    Array<{
      LABEL_PERTANYAAN: string;
      TIPE_ISIAN: FormFieldType;
      OPSI_RAW: string;
      WAJIB: boolean;
      PLACEHOLDER: string;
    }>
  >([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const addDynamicField = () => {
    setFields((prev) => [
      ...prev,
      {
        LABEL_PERTANYAAN: '',
        TIPE_ISIAN: 'text',
        OPSI_RAW: '',
        WAJIB: true,
        PLACEHOLDER: '',
      },
    ]);
  };

  const removeField = (idx: number) => {
    setFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const formattedFields: Partial<SheetKonfigurasiForm>[] = fields.map((f, idx) => ({
        LABEL_PERTANYAAN: f.LABEL_PERTANYAAN,
        TIPE_ISIAN: f.TIPE_ISIAN,
        OPSI_PILIHAN: f.OPSI_RAW
          ? f.OPSI_RAW.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        WAJIB: f.WAJIB,
        PLACEHOLDER: f.PLACEHOLDER,
        URUTAN: idx + 1,
      }));
      await apiFetch('/api/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          namaLayanan,
          kategoriGrup,
          deskripsi,
          ikon,
          persyaratanDokumen,
          idPetugasPj,
          alurStatus: [...REPORT_STATUSES],
          statusAktif,
          fields: formattedFields,
        }),
      });
      setNamaLayanan('');
      setDeskripsi('');
      setFields([]);
      setShowCreator(false);
      setMessage('Jenis layanan baru berhasil disimpan ke KATEGORI_LAYANAN dan langsung tampil di portal warga.');
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (svc: ServiceWithForm) => {
    setError('');
    try {
      await apiFetch(`/api/admin/services/${encodeURIComponent(svc.ID_LAYANAN)}`, {
        method: 'PUT',
        body: JSON.stringify({ statusAktif: !svc.STATUS_AKTIF }),
      });
      onRefresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteSvc) return;
    setDeleting(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/admin/services/${encodeURIComponent(confirmDeleteSvc.ID_LAYANAN)}`, {
        method: 'DELETE',
      });
      const removedName = confirmDeleteSvc.NAMA_LAYANAN;
      setConfirmDeleteSvc(null);
      setMessage(`Layanan "${removedName}" telah dihapus dari daftar layanan Kelurahan Ampel.`);
      onRefresh();
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus layanan.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmExcelImport = async (validRows: ParsedImportRow[]) => {
    setError('');
    setMessage('');
    const res = await apiFetch<{ ok: boolean; count: number }>('/api/admin/services/import', {
      method: 'POST',
      body: JSON.stringify({
        items: validRows.map((row) => ({
          ...row.payload,
          alurStatus: [...REPORT_STATUSES],
        })),
      }),
    });
    setShowImportModal(false);
    setMessage(
      `${res.count || validRows.length} jenis layanan berhasil diimpor dari Excel dan langsung aktif di portal warga.`
    );
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 max-w-2xl">
          Tambah jenis layanan, impor massal via Excel, atau hapus layanan yang sudah tidak berlaku tanpa mengubah kode sumber. Layanan aktif langsung tampil di halaman warga.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadServicesTemplate}
            className="px-3.5 py-2.5 bg-white text-[#0F2942] border border-slate-300 text-xs sm:text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
            <span>Contoh Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2.5 bg-sky-50 text-[#0F2942] border border-sky-300 text-xs sm:text-sm font-semibold rounded-lg hover:bg-sky-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-sky-800" aria-hidden="true" />
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            onClick={() => exportServicesToExcel(services)}
            disabled={services.length === 0}
            className="px-3.5 py-2.5 bg-emerald-50 text-[#0B6E4F] border border-emerald-300 text-xs sm:text-sm font-semibold rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreator((v) => !v)}
            className="px-4 py-2.5 bg-[#0B6E4F] text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-[#08553d] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>TAMBAH LAYANAN BARU</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Contoh Format Excel Import */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
        <p className="leading-relaxed">
          <span className="font-semibold text-[#0F2942]">Format Import Excel (.xlsx/.csv):</span>{' '}
          Kolom wajib <span className="font-mono font-semibold">Nama Layanan</span> dan{' '}
          <span className="font-mono font-semibold">Kategori Grup</span>{' '}
          (isi: <span className="font-mono">A. Pengaduan</span>,{' '}
          <span className="font-mono">B. Bantuan</span>, atau{' '}
          <span className="font-mono">C. Administrasi</span>), dilengkapi kolom opsional{' '}
          <span className="font-mono">Deskripsi</span>,{' '}
          <span className="font-mono">Persyaratan Dokumen</span>,{' '}
          <span className="font-mono">Nama Petugas PJ</span>,{' '}
          <span className="font-mono">Status Aktif</span>, dan{' '}
          <span className="font-mono">Pertanyaan Dinamis</span>.
        </p>
        <button
          type="button"
          onClick={downloadServicesTemplate}
          className="font-semibold text-[#0B6E4F] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          Unduh Contoh Import (.xlsx)
        </button>
      </div>

      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-rose-900 text-sm font-medium">
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-950 text-sm font-medium">
          {message}
        </div>
      )}

      {showCreator && (
        <form onSubmit={handleCreate} className="bg-white border-2 border-[#0B6E4F] rounded-2xl p-6 space-y-5">
          <h3 className="font-display text-lg font-extrabold text-[#0F2942]">
            Buat Layanan &amp; Formulir Dinamis Baru
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sb-nama" className="block text-sm font-semibold text-slate-900 mb-1">
                Nama Layanan <span className="text-rose-700">*</span>
              </label>
              <input
                id="sb-nama"
                type="text"
                value={namaLayanan}
                onChange={(e) => setNamaLayanan(e.target.value)}
                placeholder="Contoh: Surat Keterangan Kelahiran"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="sb-grup" className="block text-sm font-semibold text-slate-900 mb-1">
                Kategori Layanan
              </label>
              <select
                id="sb-grup"
                value={kategoriGrup}
                onChange={(e) => setKategoriGrup(e.target.value as ServiceGroup)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {SERVICE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="sb-desc" className="block text-sm font-semibold text-slate-900 mb-1">
              Deskripsi Singkat untuk Warga
            </label>
            <textarea
              id="sb-desc"
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              placeholder="Jelaskan kegunaan layanan ini dengan bahasa sederhana..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sb-syarat" className="block text-sm font-semibold text-slate-900 mb-1">
                Persyaratan Dokumen
              </label>
              <input
                id="sb-syarat"
                type="text"
                value={persyaratanDokumen}
                onChange={(e) => setPersyaratanDokumen(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="sb-pj" className="block text-sm font-semibold text-slate-900 mb-1">
                Petugas Penanggung Jawab
              </label>
              <select
                id="sb-pj"
                value={idPetugasPj}
                onChange={(e) => setIdPetugasPj(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {petugasList.map((p) => (
                  <option key={p.ID_PETUGAS} value={p.ID_PETUGAS}>
                    {p.NAMA_PETUGAS}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sb-ikon" className="block text-sm font-semibold text-slate-900 mb-1">
                Ikon Layanan
              </label>
              <select
                id="sb-ikon"
                value={ikon}
                onChange={(e) => setIkon(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="file-text">Dokumen / Surat</option>
                <option value="heart">Bantuan Sosial</option>
                <option value="road">Infrastruktur Jalan</option>
                <option value="building">Pembangunan</option>
              </select>
            </div>
          </div>

          {/* Dynamic Form Builder */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="font-display font-bold text-sm text-[#0F2942]">
                  Dynamic Form Builder (KONFIGURASI_FORM)
                </h4>
                <p className="text-xs text-slate-600">
                  Tambahkan pertanyaan khusus untuk warga saat memilih layanan ini.
                </p>
              </div>
              <button
                type="button"
                onClick={addDynamicField}
                className="px-3 py-1.5 bg-[#0F2942] text-white text-xs font-bold rounded-lg hover:bg-[#173b5e] cursor-pointer"
              >
                + Tambah Pertanyaan
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada pertanyaan khusus. Klik "+ Tambah Pertanyaan" jika diperlukan.</p>
            ) : (
              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Label Pertanyaan
                      </label>
                      <input
                        type="text"
                        value={field.LABEL_PERTANYAAN}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, LABEL_PERTANYAAN: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Misal: Nama Bayi / Lokasi"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Tipe Isian
                      </label>
                      <select
                        value={field.TIPE_ISIAN}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, TIPE_ISIAN: e.target.value as FormFieldType }
                                : item
                            )
                          )
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                      >
                        {FORM_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FIELD_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Opsi (pisahkan koma)
                      </label>
                      <input
                        type="text"
                        value={field.OPSI_RAW}
                        disabled={!['dropdown', 'radio', 'checkbox'].includes(field.TIPE_ISIAN)}
                        onChange={(e) =>
                          setFields((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, OPSI_RAW: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Opsi A, Opsi B"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.WAJIB}
                          onChange={(e) =>
                            setFields((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, WAJIB: e.target.checked } : item
                              )
                            )
                          }
                          className="w-4 h-4 accent-[#0B6E4F]"
                        />
                        Wajib
                      </label>
                      <button
                        type="button"
                        onClick={() => removeField(idx)}
                        aria-label={`Hapus pertanyaan ${idx + 1}`}
                        className="p-2 text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={statusAktif}
                onChange={(e) => setStatusAktif(e.target.checked)}
                className="w-4 h-4 accent-[#0B6E4F]"
              />
              Aktifkan layanan langsung di halaman warga
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreator(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-lg hover:bg-[#08553d] cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Layanan Baru'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Existing Dynamic Services Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
              <th className="py-3 px-4">Nama Layanan</th>
              <th className="py-3 px-4">Grup</th>
              <th className="py-3 px-4">PJ Petugas</th>
              <th className="py-3 px-4 text-right">Pertanyaan Dinamis</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {services.map((svc) => (
              <tr key={svc.ID_LAYANAN} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-semibold text-slate-900">
                  {svc.NAMA_LAYANAN}
                  <span className="block text-xs font-normal text-slate-500">{svc.DESKRIPSI}</span>
                </td>
                <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{svc.KATEGORI_GRUP}</td>
                <td className="py-3 px-4 text-slate-700">{svc.NAMA_PETUGAS_PJ}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">
                  {Array.isArray(svc.fields) ? svc.fields.length : 0}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`font-semibold ${
                      svc.STATUS_AKTIF ? 'text-emerald-800' : 'text-slate-500'
                    }`}
                  >
                    {svc.STATUS_AKTIF ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleActive(svc)}
                      className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {svc.STATUS_AKTIF ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSvc(svc)}
                      aria-label={`Hapus layanan ${svc.NAMA_LAYANAN}`}
                      className="px-3 py-1.5 text-xs font-semibold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImportModal && (
        <ExcelImportModal
          title="Import Jenis Layanan dari Excel"
          subtitle="Unggah file Excel (.xlsx/.xls/.csv) sesuai contoh template. Anda dapat meninjau hasil pembacaan sebelum data layanan disimpan."
          onClose={() => setShowImportModal(false)}
          onDownloadTemplate={downloadServicesTemplate}
          onParseFile={(buf) => parseServicesImportExcel(buf, petugasList)}
          onConfirmImport={handleConfirmExcelImport}
        />
      )}

      {confirmDeleteSvc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-svc-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => !deleting && setConfirmDeleteSvc(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-rose-700">
                  Konfirmasi Penghapusan Layanan
                </p>
                <h3
                  id="confirm-delete-svc-title"
                  className="mt-1 font-display text-lg font-bold text-[#0F2942]"
                >
                  Hapus &ldquo;{confirmDeleteSvc.NAMA_LAYANAN}&rdquo;?
                </h3>
              </div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteSvc(null)}
                aria-label="Tutup dialog konfirmasi"
                className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Layanan pada grup{' '}
              <span className="font-semibold text-[#0F2942]">{confirmDeleteSvc.KATEGORI_GRUP}</span>{' '}
              beserta pertanyaan dinamisnya akan dihapus permanen dari daftar layanan warga. Riwayat laporan atau permohonan yang sudah masuk tetap aman.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteSvc(null)}
                className="px-4 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-bold bg-rose-700 hover:bg-rose-800 disabled:opacity-60 text-white rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus Layanan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
