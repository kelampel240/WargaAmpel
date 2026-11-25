import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckSquare,
  Clock,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  MapPin,
  Phone,
  Printer,
  Square,
  X,
} from 'lucide-react';
import { BerandaFooterInfo, ServiceWithForm, SheetContohFile } from '../shared/types';
import {
  DownloadableServiceForm,
  extractDownloadableForms,
  extractRequirementsChecklist,
  triggerAllFormsPacketDownload,
  triggerFormWordDownload,
} from '../shared/serviceForms';

function formatFileSize(bytes?: number): string {
  const n = Number(bytes) || 0;
  if (n <= 0) return 'Tautan Resmi';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

interface ServiceFormDownloadViewProps {
  service: ServiceWithForm;
  footer?: BerandaFooterInfo;
  templateFiles?: SheetContohFile[];
  onBack: () => void;
}

export const ServiceFormDownloadView: React.FC<ServiceFormDownloadViewProps> = ({
  service,
  footer,
  templateFiles = [],
  onBack,
}) => {
  const forms = useMemo(() => extractDownloadableForms(service), [service]);
  const checklist = useMemo(() => extractRequirementsChecklist(service), [service]);
  const matchingTemplateFiles = useMemo(
    () =>
      (Array.isArray(templateFiles) ? templateFiles : []).filter(
        (f) =>
          f.AKTIF !== false &&
          (f.ID_LAYANAN === service.ID_LAYANAN || f.ID_LAYANAN === 'UMUM')
      ),
    [templateFiles, service.ID_LAYANAN]
  );
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});
  const [previewForm, setPreviewForm] = useState<DownloadableServiceForm | null>(null);
  const [downloadNotice, setDownloadNotice] = useState('');

  useEffect(() => {
    setCheckedIds({});
    setPreviewForm(null);
    setDownloadNotice('');
  }, [service.ID_LAYANAN]);

  useEffect(() => {
    if (!previewForm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewForm(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewForm]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkedCount = checklist.filter((item) => checkedIds[item.id]).length;

  const handleDownloadSingle = (form: DownloadableServiceForm) => {
    triggerFormWordDownload(form, service, footer);
    setDownloadNotice(`Berhasil mengunduh ${form.namaForm} (.doc).`);
  };

  const handleDownloadAll = () => {
    triggerAllFormsPacketDownload(forms, service, footer);
    setDownloadNotice(
      `Berhasil mengunduh paket lengkap ${forms.length} formulir untuk layanan ${service.NAMA_LAYANAN} (.doc).`
    );
  };

  const kantorNama = footer?.namaKantor || 'Kantor Kelurahan Ampel';
  const kantorAlamat =
    footer?.alamat || 'Jl. Raya Kelurahan Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember';
  const kantorJam =
    footer?.jamLayanan || 'Senin–Jumat, 08.00–14.30 WIB (Portal online aktif 24 jam)';
  const kantorTelp = footer?.telepon || '(0336) 621-104 / 0811-0000-0003';

  return (
    <>
      <main
        className={`max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 ${
          previewForm ? 'no-print' : ''
        }`}
      >
        {/* Top Back Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-[#0F2942] hover:text-[#0B6E4F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke Daftar Layanan</span>
          </button>

          <p className="text-xs sm:text-sm text-slate-500">
            {service.KATEGORI_GRUP} · PJ: {service.NAMA_PETUGAS_PJ}
          </p>
        </div>

        {/* Service Header & 3-Step Submission Flow */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="max-w-3xl">
            <p className="text-xs sm:text-sm font-semibold text-[#0B6E4F] tracking-wide">
              Berkas &amp; Formulir Pengajuan Layanan Tatap Muka
            </p>
            <h1 className="mt-1.5 font-display text-2xl sm:text-4xl font-bold text-[#0F2942] text-balance">
              {service.NAMA_LAYANAN}
            </h1>
            {service.DESKRIPSI && (
              <p className="mt-2.5 text-base text-slate-700 leading-relaxed">
                {service.DESKRIPSI}
              </p>
            )}
          </div>

          <div className="pt-5 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <p className="font-mono text-xs font-bold text-[#0B6E4F] tabular-nums">
                01. UNDUH FORMULIR
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F2942]">
                Unduh &amp; cetak formulir yang dibutuhkan
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                Tersedia dalam format Word (.doc) siap isi maupun cetak PDF langsung.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-[#0B6E4F] tabular-nums">
                02. LENGKAPI BERKAS
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F2942]">
                Isi data &amp; siapkan dokumen persyaratan
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                Pastikan formulir telah ditandatangani pemohon dan diketahui RT/RW bila diperlukan.
              </p>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-[#0B6E4F] tabular-nums">
                03. AJUKAN DI KANTOR
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F2942]">
                Serahkan ke loket {kantorNama}
              </p>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                Petugas kami akan memverifikasi dan memproses berkas permohonan Anda.
              </p>
            </div>
          </div>
        </section>

        {downloadNotice && (
          <div
            role="status"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-medium text-emerald-950 flex flex-wrap items-center justify-between gap-3"
          >
            <span>{downloadNotice}</span>
            <button
              type="button"
              onClick={() => setDownloadNotice('')}
              className="text-xs font-semibold text-[#0B6E4F] hover:underline cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Main 2-Column Workspace: Left Forms List / Right Checklist & Office Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Downloadable Forms & Super Admin Contoh Files */}
          <section
            aria-labelledby="daftar-formulir-heading"
            className="lg:col-span-7 space-y-6"
          >
            {matchingTemplateFiles.length > 0 && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-[#0B6E4F]">
                    Unduhan Terbuka · Akun Warga &amp; Pengunjung Umum
                  </p>
                  <h2 className="mt-0.5 font-display text-lg sm:text-xl font-bold text-[#0F2942]">
                    Contoh File &amp; Blangko dari Kelurahan Ampel ({matchingTemplateFiles.length})
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-700">
                    Contoh file resmi yang diunggah oleh pengelola kelurahan sebagai acuan pengisian berkas.
                  </p>
                </div>

                <div className="space-y-3">
                  {matchingTemplateFiles.map((file) => (
                    <article
                      key={file.ID_FILE}
                      className="bg-white border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-[#0B6E4F] font-semibold">
                          {file.NAMA_LAYANAN || 'Semua Layanan / Umum'} · {formatFileSize(file.UKURAN_BYTES)}
                        </p>
                        <h3 className="font-display text-base font-bold text-[#0F2942]">
                          {file.JUDUL_FILE}
                        </h3>
                        {file.KETERANGAN && (
                          <p className="mt-0.5 text-xs sm:text-sm text-slate-600">{file.KETERANGAN}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                          href={file.FILE_URL}
                          download={file.NAMA_FILE_ASLI || undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                          <span>Unduh Contoh File</span>
                        </a>
                        {file.PREVIEW_URL && file.PREVIEW_URL !== file.FILE_URL && (
                          <a
                            href={file.PREVIEW_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-[#0F2942] text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" aria-hidden="true" />
                            <span>Pratinjau</span>
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="daftar-formulir-heading"
                  className="font-display text-xl sm:text-2xl font-bold text-[#0F2942]"
                >
                  Formulir yang Harus Diunduh ({forms.length})
                </h2>
                <p className="mt-0.5 text-sm text-slate-600">
                  Unduh setiap formulir di bawah ini, isi dengan lengkap, lalu bawa saat pengajuan di kelurahan.
                </p>
              </div>
              {forms.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="px-4 py-2.5 bg-[#0F2942] hover:bg-[#163a5c] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileDown className="w-4 h-4" aria-hidden="true" />
                  <span>Unduh Semua Formulir (.doc)</span>
                </button>
              )}
            </div>

            <div className="space-y-4">
              {forms.map((form, idx) => (
                <article
                  key={form.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 hover:border-[#0B6E4F] transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-mono text-xs font-bold text-[#0B6E4F] tabular-nums">
                        {String(idx + 1).padStart(2, '0')} · {form.kodeForm} · {form.estimasiWaktu}
                      </p>
                      <h3 className="font-display text-lg font-bold text-[#0F2942]">
                        {form.namaForm}
                      </h3>
                    </div>
                    <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-1" aria-hidden="true" />
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed">{form.keterangan}</p>

                  {/* Preview of fields inside this form */}
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">
                      Isian utama dalam formulir ini:
                    </p>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                      {form.sections
                        .flatMap((sec) => sec.fields.map((f) => f.label))
                        .slice(0, 5)
                        .join(' · ')}
                      {form.sections.flatMap((sec) => sec.fields).length > 5 ? ' · dan lainnya' : ''}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadSingle(form)}
                      className="px-4 py-2.5 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-4 h-4" aria-hidden="true" />
                      <span>Unduh Word (.doc)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewForm(form)}
                      className="px-4 py-2.5 bg-white hover:bg-slate-50 text-[#0F2942] border border-slate-300 text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Printer className="w-4 h-4" aria-hidden="true" />
                      <span>Pratinjau &amp; Cetak PDF</span>
                    </button>

                    {form.externalUrl && (
                      <a
                        href={form.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-[#0B6E4F] border border-emerald-300 text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        <span>Lampiran Resmi</span>
                      </a>
                    )}
                  </div>
                </article>
              ))}
              </div>
            </div>
          </section>

          {/* Right: Document Checklist + Kelurahan Ampel Office Submission Guide */}
          <aside className="lg:col-span-5 space-y-5">
            {/* Checklist Persyaratan */}
            <section
              aria-labelledby="checklist-syarat-heading"
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2
                    id="checklist-syarat-heading"
                    className="font-display text-lg font-bold text-[#0F2942]"
                  >
                    Persyaratan Dokumen Pendukung
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-slate-600">
                    Tandai berkas yang sudah Anda siapkan agar tidak ada yang tertinggal saat ke kelurahan.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-[#0B6E4F] tabular-nums whitespace-nowrap shrink-0 mt-1">
                  {checkedCount}/{checklist.length} siap
                </span>
              </div>

              {checklist.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Bawa KTP-el dan Kartu Keluarga (KK) asli beserta fotokopinya saat mengurus di loket.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {checklist.map((item) => {
                    const checked = Boolean(checkedIds[item.id]);
                    return (
                      <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() => toggleCheck(item.id)}
                          className="w-full text-left flex items-start gap-3 group cursor-pointer"
                        >
                          {checked ? (
                            <CheckSquare
                              className="w-5 h-5 text-[#0B6E4F] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          ) : (
                            <Square
                              className="w-5 h-5 text-slate-400 group-hover:text-[#0B6E4F] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={`text-sm leading-relaxed ${
                              checked ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}
                          >
                            {item.label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Lokasi & Jam Pelayanan Kantor Kelurahan */}
            <section
              aria-labelledby="info-loket-heading"
              className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-[#0B6E4F] shrink-0" aria-hidden="true" />
                <h2
                  id="info-loket-heading"
                  className="font-display text-lg font-bold text-[#0F2942]"
                >
                  Pengajuan di {kantorNama}
                </h2>
              </div>

              <div className="space-y-3 text-sm text-slate-800">
                <p className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{kantorAlamat}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{kantorJam}</span>
                </p>
                <p className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-[#0B6E4F] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{kantorTelp}</span>
                </p>
              </div>

              <p className="pt-3 border-t border-emerald-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                Serahkan formulir yang sudah diisi lengkap beserta map berkas persyaratan kepada{' '}
                <span className="font-semibold text-[#0F2942]">{service.NAMA_PETUGAS_PJ}</span> di
                loket pelayanan kelurahan.
              </p>
            </section>
          </aside>
        </div>
      </main>

      {/* Printable Preview Modal (Uses clean window.print() CSS, zero window.open) */}
      {previewForm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau Cetak ${previewForm.namaForm}`}
          className="fixed inset-0 z-50 bg-slate-950/80 flex items-start justify-center p-2 sm:p-6 overflow-y-auto print-only-root"
          onClick={() => setPreviewForm(null)}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden print-only-root"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar (Hidden when printing) */}
            <div className="no-print sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-bold text-[#0B6E4F]">
                  PRATINJAU DOKUMEN SIAP CETAK · {previewForm.kodeForm}
                </p>
                <h3 className="font-display text-base font-bold text-[#0F2942]">
                  {previewForm.namaForm}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(previewForm)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-[#0F2942] text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Unduh Word</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-[#0B6E4F] hover:bg-[#08553d] text-white text-xs sm:text-sm font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewForm(null)}
                  aria-label="Tutup pratinjau cetak"
                  className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Official A4 Printable Document Sheet */}
            <div className="p-6 sm:p-10 bg-white text-slate-900 font-serif">
              <header className="text-center border-b-4 border-double border-slate-900 pb-3 mb-5">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
                  Pemerintah Kabupaten Jember · Kecamatan Wuluhan
                </p>
                <h4 className="text-xl font-bold uppercase mt-0.5 text-slate-950">
                  {kantorNama}
                </h4>
                <p className="text-xs text-slate-700 mt-0.5">
                  {kantorAlamat} · Telp: {kantorTelp}
                </p>
              </header>

              <div className="text-center mb-6">
                <p className="font-sans text-xs font-bold tracking-wider uppercase text-[#0B6E4F]">
                  Kode Formulir: {previewForm.kodeForm} · Layanan: {service.NAMA_LAYANAN}
                </p>
                <h5 className="text-lg font-bold uppercase mt-1 text-slate-950">
                  {previewForm.namaForm}
                </h5>
              </div>

              <div className="space-y-5 font-sans">
                {previewForm.sections.map((sec) => (
                  <div key={sec.judulBagian}>
                    <h6 className="text-sm font-bold text-[#0F2942] border-b border-slate-300 pb-1 mb-2">
                      {sec.judulBagian}
                    </h6>
                    <table className="w-full border-collapse text-xs sm:text-sm">
                      <tbody>
                        {sec.fields.map((field) => (
                          <tr key={field.label}>
                            <td className="w-2/5 border border-slate-400 bg-slate-50 px-3 py-2 align-top font-semibold text-slate-900">
                              <div>{field.label}</div>
                              {field.hint && (
                                <div className="font-normal text-xs text-slate-600 mt-0.5">
                                  {field.hint}
                                </div>
                              )}
                            </td>
                            <td
                              className={`w-3/5 border border-slate-400 px-3 ${
                                field.multiline ? 'py-6' : 'py-2'
                              } align-top`}
                            >
                              &nbsp;
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}

                {checklist.length > 0 && (
                  <div className="border border-slate-400 bg-slate-50 p-3.5 text-xs">
                    <p className="font-bold text-[#0F2942] mb-1.5">
                      Kelengkapan Berkas Persyaratan (Dibawa ke Kantor Kelurahan Ampel):
                    </p>
                    <ul className="space-y-1">
                      {checklist.map((item) => (
                        <li key={item.id} className="flex items-start gap-2">
                          <span className="font-mono">[ &nbsp; ]</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {previewForm.catatanPengisian && previewForm.catatanPengisian.length > 0 && (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p className="font-bold">Catatan Pengisian:</p>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {previewForm.catatanPengisian.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-bold">Ketua RT / RW Setempat</p>
                    <div className="h-16" />
                    <p>( ........................................ )</p>
                  </div>
                  <div>
                    <p>Verifikasi Petugas Loket</p>
                    <p className="font-bold">{kantorNama}</p>
                    <div className="h-16" />
                    <p>( ........................................ )</p>
                  </div>
                  <div>
                    <p>Ampel, ........................ 20....</p>
                    <p className="font-bold">Pemohon</p>
                    <div className="h-16" />
                    <p>( ........................................ )</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
