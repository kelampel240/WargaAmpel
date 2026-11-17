import React, { useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Upload, X, AlertCircle } from 'lucide-react';
import { ParsedImportRow } from '../lib/excelImport';

interface ExcelImportModalProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onParseFile: (buffer: ArrayBuffer) => ParsedImportRow[];
  onConfirmImport: (validRows: ParsedImportRow[]) => Promise<void>;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  title,
  subtitle,
  onClose,
  onDownloadTemplate,
  onParseFile,
  onConfirmImport,
}) => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedImportRow[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);

  const validRows = rows ? rows.filter((r) => !r.error) : [];
  const invalidCount = rows ? rows.length - validRows.length : 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = onParseFile(buf);
      if (parsed.length === 0) {
        setRows([]);
        setParseError('File terbaca, tetapi tidak ditemukan baris data yang dapat diimpor.');
      } else {
        setRows(parsed);
      }
    } catch (err) {
      setRows(null);
      setParseError((err as Error).message || 'Gagal membaca file Excel. Pastikan format .xlsx, .xls, atau .csv valid.');
    }
  };

  const handleSubmit = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setParseError('');
    try {
      await onConfirmImport(validRows);
    } catch (err) {
      setParseError((err as Error).message || 'Sebagian atau seluruh data gagal diimpor.');
      setImporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="excel-import-title"
      className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-[#D4AF37] shadow-xl overflow-hidden my-8">
        <div className="bg-[#0F2942] px-6 py-4 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <h3 id="excel-import-title" className="font-display text-lg font-bold truncate">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela import Excel"
            className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-sm text-slate-600">{subtitle}</p>

          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F2942] text-amber-300 border border-[#D4AF37] text-sm font-bold rounded-xl cursor-pointer hover:bg-[#173b5e]">
              <Upload className="w-4 h-4" aria-hidden="true" />
              <span>{fileName ? 'Ganti File Excel' : 'Pilih File (.xlsx / .csv)'}</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            <button
              type="button"
              onClick={onDownloadTemplate}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold border border-slate-300 bg-white text-[#0F2942] rounded-xl hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#0B6E4F]" aria-hidden="true" />
              <span>Unduh Contoh Template</span>
            </button>
          </div>

          {fileName && (
            <p className="text-xs font-mono text-slate-600">
              Berkas dipilih: <strong className="text-[#0F2942]">{fileName}</strong>
            </p>
          )}

          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-sm font-semibold text-rose-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{parseError}</span>
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <span className="text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {validRows.length} baris valid siap diimpor
                </span>
                {invalidCount > 0 && (
                  <span className="text-rose-700">
                    {invalidCount} baris dilewati karena perlu perbaikan
                  </span>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2 px-3">Baris</th>
                      <th className="py-2 px-3">Nama</th>
                      <th className="py-2 px-3">Keterangan</th>
                      <th className="py-2 px-3">Status Validasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.map((r) => (
                      <tr key={r.rowNumber} className={r.error ? 'bg-rose-50/50' : ''}>
                        <td className="py-2 px-3 font-mono text-slate-500">{r.rowNumber}</td>
                        <td className="py-2 px-3 font-bold text-[#0F2942]">{r.label}</td>
                        <td className="py-2 px-3 text-slate-700">{r.detail || '-'}</td>
                        <td className="py-2 px-3">
                          {r.error ? (
                            <span className="text-rose-700 font-semibold">{r.error}</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">Siap Diimpor</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-xl cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={importing || validRows.length === 0}
              onClick={handleSubmit}
              className="px-5 py-2 bg-[#0B6E4F] text-white text-sm font-bold rounded-xl hover:bg-[#08553d] disabled:opacity-50 cursor-pointer"
            >
              {importing ? 'Mengimpor...' : `Impor ${validRows.length} Data`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
