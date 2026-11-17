import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DriveConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  affectedItems?: string[];
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DriveConfirmDialog: React.FC<DriveConfirmDialogProps> = ({
  open,
  title,
  description,
  affectedItems,
  confirmLabel = 'Ya, Lanjutkan',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drive-confirm-title"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Tutup dialog konfirmasi"
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="drive-confirm-title" className="font-display text-lg font-bold text-[#0F2942]">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-slate-700 leading-relaxed">{description}</p>
            {affectedItems && affectedItems.length > 0 && (
              <ul className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 space-y-1 max-h-36 overflow-y-auto">
                {affectedItems.map((item) => (
                  <li key={item} className="truncate">
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg cursor-pointer disabled:opacity-60 ${
              danger ? 'bg-rose-700 hover:bg-rose-800' : 'bg-[#0B6E4F] hover:bg-[#08553d]'
            }`}
          >
            {busy ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
