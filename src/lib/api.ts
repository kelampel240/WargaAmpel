import { PublicUserSession, ReportStatus } from '../shared/types';
import { isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

const TOKEN_STORAGE_KEY = 'siwarga_auth_token';
const USER_STORAGE_KEY = 'siwarga_auth_user';
const GAS_URL_STORAGE_KEY = 'warga_ampel_gas_url';

export const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbz898DjJanfBIwZxbm6cMq6hbIr5Gkd9eREGpJ-uBVeU3jVRwBpNvHKoLT4JLwncwh-lw/exec';

export function getGasWebAppUrl(): string {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('gasUrl') || '';
      if (isValidGasWebAppUrl(fromQuery)) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, fromQuery.trim());
        return fromQuery.trim();
      }
      const fromStorage = localStorage.getItem(GAS_URL_STORAGE_KEY) || '';
      if (isValidGasWebAppUrl(fromStorage)) {
        return fromStorage.trim();
      }
    }
  } catch {
    // ignore storage errors
  }
  const fromEnv = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GAS_WEB_APP_URL || '';
  if (isValidGasWebAppUrl(fromEnv)) {
    return fromEnv.trim();
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')) {
    return DEFAULT_GAS_WEB_APP_URL;
  }
  return '';
}

export function isGasMode(): boolean {
  return getGasWebAppUrl().length > 0;
}

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): PublicUserSession | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PublicUserSession) : null;
  } catch {
    return null;
  }
}

export function persistAuth(token: string, user: PublicUserSession): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const gasUrl = getGasWebAppUrl();

  if (gasUrl) {
    let parsedBody: Record<string, unknown> = {};
    if (typeof options.body === 'string' && options.body.trim()) {
      try {
        parsedBody = JSON.parse(options.body) as Record<string, unknown>;
      } catch {
        parsedBody = {};
      }
    }
    const spec = mapRestToGasCall(url, options.method || 'GET', parsedBody, token);
    if (spec.localResponse !== undefined) {
      return spec.localResponse as T;
    }

    const targetUrl =
      url === '/api/admin/test-gas' && typeof parsedBody.url === 'string' && isValidGasWebAppUrl(parsedBody.url)
        ? parsedBody.url.trim()
        : gasUrl;

    const publicGetActions = new Set([
      'ping',
      'getPublicServices',
      'getPublicAnnouncements',
      'getPublicOrgStructure',
    ]);

    let res: Response;
    try {
      // Gunakan text/plain agar browser GitHub Pages tidak memicu CORS preflight OPTIONS ke Google Apps Script
      res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: spec.action,
          payload: spec.payload,
          token: spec.token || '',
        }),
      });
    } catch (postErr) {
      if (publicGetActions.has(spec.action)) {
        try {
          const sep = targetUrl.includes('?') ? '&' : '?';
          res = await fetch(`${targetUrl}${sep}action=${encodeURIComponent(spec.action)}`, {
            method: 'GET',
          });
        } catch {
          throw new Error(
            'Gagal terhubung ke backend Google Apps Script (CORS/jaringan). Pastikan Code.gs sudah ditempel di Apps Script, di-deploy ulang sebagai "New version", dan akses disetel ke "Anyone".'
          );
        }
      } else {
        const msg = (postErr as Error)?.message || '';
        if (msg === 'Failed to fetch' || msg.toLowerCase().includes('network')) {
          throw new Error(
            'Gagal terhubung ke backend Google Apps Script (CORS/jaringan). Pastikan Code.gs sudah ditempel di Apps Script, di-deploy ulang sebagai "New version", dan akses disetel ke "Anyone".'
          );
        }
        throw postErr;
      }
    }

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(text || '{}') as Record<string, unknown>;
    } catch {
      throw new Error(
        'Backend Google Apps Script mengembalikan halaman HTML, bukan JSON. Pastikan di Apps Script (Deploy → Manage deployments → Edit → New version) akses disetel ke "Anyone" dan Code.gs berisi fungsi doGet/doPost.'
      );
    }
    if (!res.ok || data.error) {
      throw new Error(String(data.error || `Permintaan GAS gagal (${res.status})`));
    }
    if (url === '/api/admin/test-gas') {
      return { ok: true, status: res.status, preview: text.slice(0, 300) } as unknown as T;
    }
    return data as T;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      if (res.ok && !contentType.includes('application/json')) {
        throw new Error('Server mengembalikan respons non-JSON. Pastikan server API aktif pada port 3000.');
      }
      data = {};
    }
  }
  if (!res.ok) {
    if (data && typeof data.error === 'string' && data.error) {
      throw new Error(data.error);
    }
    if (res.status === 403) {
      throw new Error(
        'Akses ditolak server/proxy (403). Silakan muat ulang halaman (Refresh), lalu login ulang sebagai Super Admin atau Operator.'
      );
    }
    throw new Error(`Permintaan gagal (${res.status})`);
  }
  return data as T;
}

export async function downloadCsvExport(): Promise<void> {
  if (isGasMode()) {
    const res = await apiFetch<{ csv: string; filename?: string }>('/api/admin/export');
    const blob = new Blob([res.csv || ''], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename || 'LAPORAN_WARGA_AMPEL.csv';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const token = getStoredToken() || '';
  window.location.href = `/api/admin/export?token=${encodeURIComponent(token)}`;
}

export function readFileAsBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        base64: String(reader.result || ''),
      });
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

export function formatTanggalIndo(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function getStatusVisual(status: ReportStatus): {
  textClass: string;
  bgClass: string;
  borderClass: string;
  shortLabel: string;
} {
  switch (status) {
    case 'Laporan diterima':
      return {
        textClass: 'text-slate-800',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        shortLabel: 'Diterima',
      };
    case 'Sedang ditindaklanjuti':
      return {
        textClass: 'text-sky-900',
        bgClass: 'bg-sky-50',
        borderClass: 'border-sky-300',
        shortLabel: 'Ditindaklanjuti',
      };
    case 'Sedang dalam proses perbaikan':
      return {
        textClass: 'text-amber-900',
        bgClass: 'bg-amber-50',
        borderClass: 'border-amber-300',
        shortLabel: 'Dalam Perbaikan',
      };
    case 'Sudah diusulkan ke dinas terkait':
    case 'Menunggu tindak lanjut dinas':
      return {
        textClass: 'text-indigo-900',
        bgClass: 'bg-indigo-50',
        borderClass: 'border-indigo-300',
        shortLabel: 'Usulan Dinas',
      };
    case 'Sudah diperbaiki atau ditangani':
      return {
        textClass: 'text-emerald-900',
        bgClass: 'bg-emerald-50',
        borderClass: 'border-emerald-300',
        shortLabel: 'Selesai',
      };
    case 'Tidak dapat ditindaklanjuti':
      return {
        textClass: 'text-rose-900',
        bgClass: 'bg-rose-50',
        borderClass: 'border-rose-300',
        shortLabel: 'Tidak Dapat Ditindaklanjuti',
      };
    default:
      return {
        textClass: 'text-slate-800',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        shortLabel: status,
      };
  }
}
