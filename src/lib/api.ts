import { PublicUserSession, ReportStatus } from '../shared/types';
import { isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

const TOKEN_STORAGE_KEY = 'siwarga_auth_token';
const USER_STORAGE_KEY = 'siwarga_auth_user';
const GAS_URL_STORAGE_KEY = 'warga_ampel_gas_url';

export const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec';

export const DEFAULT_DRIVE_FOLDER_ID = '1gT7JFuHwe2LYhJp2BlZeQ9j5tgLC2IJx';
export const BERANDA_DRIVE_FOLDER_ID = '1wR1Kt5shcFFll0OiM3-Jxtv8MauBOkFv';
export const DEFAULT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;
export const BERANDA_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${BERANDA_DRIVE_FOLDER_ID}`;
export const DEFAULT_SPREADSHEET_ID = '1yGeHQ_rWh24fhTrK9NP19hO3L0TwoKXOVboczMAPhkY';
export const DEFAULT_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SPREADSHEET_ID}/edit`;

export async function fetchGasConnectionStatus(): Promise<{
  connected: boolean;
  rootFolderId: string;
  spreadsheetId: string;
  desa: string;
}> {
  const gasUrl = getGasWebAppUrl();
  if (!gasUrl) {
    return {
      connected: false,
      rootFolderId: DEFAULT_DRIVE_FOLDER_ID,
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      desa: 'Kelurahan Ampel',
    };
  }
  try {
    const sep = gasUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${gasUrl}${sep}action=ping`, { method: 'GET' });
    const data = (await res.json()) as {
      ok?: boolean;
      rootFolderId?: string;
      spreadsheetId?: string;
      desa?: string;
    };
    return {
      connected: Boolean(data?.ok),
      rootFolderId: String(data?.rootFolderId || DEFAULT_DRIVE_FOLDER_ID),
      spreadsheetId: String(data?.spreadsheetId || DEFAULT_SPREADSHEET_ID),
      desa: String(data?.desa || 'Kelurahan Ampel'),
    };
  } catch {
    return {
      connected: false,
      rootFolderId: DEFAULT_DRIVE_FOLDER_ID,
      spreadsheetId: DEFAULT_SPREADSHEET_ID,
      desa: 'Kelurahan Ampel',
    };
  }
}

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
      if (fromStorage.includes('AKfycbz898DjJanfBIwZxbm6cMq6hbIr5Gkd9eREGpJ-uBVeU3jVRwBpNvHKoLT4JLwncwh-lw')) {
        localStorage.setItem(GAS_URL_STORAGE_KEY, DEFAULT_GAS_WEB_APP_URL);
        return DEFAULT_GAS_WEB_APP_URL;
      }
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

export function setGasWebAppUrl(url: string): void {
  const trimmed = url.trim();
  if (!isValidGasWebAppUrl(trimmed)) {
    throw new Error('URL Web App GAS harus berupa link https://script.google.com/.../exec yang valid.');
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(GAS_URL_STORAGE_KEY, trimmed);
  }
}

export function resetGasWebAppUrl(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GAS_URL_STORAGE_KEY);
  }
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

const BERANDA_OUTDATED_GAS_GUIDE =
  'Web App Google Apps Script (Code.gs) yang terhubung masih versi lama sehingga belum mengenali aksi Beranda terbaru. Buka editor Google Apps Script → salin ulang isi gas/Code.gs & gas/SetupDatabase.gs → jalankan setupDatabase() → pilih Deploy → Kelola deployment → Edit (ikon pensil) → Versi baru → Deploy.';

async function executeGasAction(
  targetUrl: string,
  action: string,
  payload: Record<string, unknown>,
  token: string,
  allowGetFallback: boolean
): Promise<{ status: number; ok: boolean; rawText: string; data: Record<string, unknown> }> {
  let res: Response;
  try {
    // Gunakan text/plain agar browser GitHub Pages tidak memicu CORS preflight OPTIONS ke Google Apps Script
    res = await fetch(targetUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload,
        token,
      }),
    });
  } catch (postErr) {
    if (allowGetFallback) {
      try {
        const sep = targetUrl.includes('?') ? '&' : '?';
        res = await fetch(
          `${targetUrl}${sep}action=${encodeURIComponent(action)}&_ts=${Date.now()}`,
          {
            method: 'GET',
            cache: 'no-store',
          }
        );
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

  const rawText = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(rawText || '{}') as Record<string, unknown>;
  } catch {
    throw new Error(
      'Backend Google Apps Script mengembalikan halaman HTML, bukan JSON. Pastikan di Apps Script (Deploy → Manage deployments → Edit → New version) akses disetel ke "Anyone" dan Code.gs berisi fungsi doGet/doPost.'
    );
  }
  return { status: res.status, ok: res.ok, rawText, data };
}

function extractFooterFromSettings(settingsArr: unknown): {
  namaKantor: string;
  alamat: string;
  telepon: string;
  email: string;
  jamLayanan: string;
} {
  const map: Record<string, string> = {};
  if (Array.isArray(settingsArr)) {
    for (const row of settingsArr) {
      if (row && typeof row === 'object' && 'KUNCI' in row) {
        const k = String((row as { KUNCI: unknown }).KUNCI || '');
        const v = String((row as { NILAI?: unknown }).NILAI || '');
        if (k) map[k] = v;
      }
    }
  }
  return {
    namaKantor: map.FOOTER_NAMA_KANTOR || 'Balai Kelurahan Ampel',
    alamat: map.FOOTER_ALAMAT || 'Jl. Raya Kelurahan Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember',
    telepon: map.FOOTER_TELEPON || '(0336) 621-104 / 0811-0000-0003',
    email: map.FOOTER_EMAIL || 'pelayanan@ampel.kelurahan.id',
    jamLayanan: map.FOOTER_JAM_LAYANAN || 'Senin–Jumat, 08.00–14.30 WIB (Portal online aktif 24 jam)',
  };
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
      'getPublicRoleAccounts',
      'getBerandaContent',
      'getPublicTemplateFiles',
    ]);

    const { status, ok, rawText, data } = await executeGasAction(
      targetUrl,
      spec.action,
      spec.payload,
      spec.token || '',
      publicGetActions.has(spec.action)
    );

    if (!ok || data.error) {
      const errMsg = String(data.error || `Permintaan GAS gagal (${status})`);

      // Fallback otomatis jika Web App GAS masih versi lama
      if (errMsg.includes('Aksi tidak dikenali')) {
        if (spec.action === 'saveBerandaFooter') {
          const footerSettings = [
            { KUNCI: 'FOOTER_NAMA_KANTOR', NILAI: String(parsedBody.namaKantor || 'Balai Kelurahan Ampel').trim() },
            { KUNCI: 'FOOTER_ALAMAT', NILAI: String(parsedBody.alamat || '').trim() },
            { KUNCI: 'FOOTER_TELEPON', NILAI: String(parsedBody.telepon || '').trim() },
            { KUNCI: 'FOOTER_EMAIL', NILAI: String(parsedBody.email || '').trim() },
            { KUNCI: 'FOOTER_JAM_LAYANAN', NILAI: String(parsedBody.jamLayanan || '').trim() },
          ];
          const fb = await executeGasAction(
            targetUrl,
            'saveSettings',
            { settings: footerSettings },
            spec.token || '',
            false
          );
          if (!fb.ok || fb.data.error) {
            throw new Error(String(fb.data.error || errMsg));
          }
          return {
            ok: true,
            footer: extractFooterFromSettings(fb.data.settings),
            savedViaFallback: true,
          } as unknown as T;
        }

        if (spec.action === 'getAdminBeranda') {
          const fb = await executeGasAction(targetUrl, 'getSettings', {}, spec.token || '', false);
          if (fb.ok && !fb.data.error) {
            return {
              banner: null,
              program: [],
              galeri: [],
              footer: extractFooterFromSettings(fb.data.settings),
              driveFolderId: BERANDA_DRIVE_FOLDER_ID,
              gasOutdated: true,
            } as unknown as T;
          }
        }

        if (spec.action === 'getPublicTemplateFiles') {
          return { files: [], gasOutdated: true } as unknown as T;
        }
        if (spec.action === 'getAdminTemplateFiles') {
          return { files: [], gasOutdated: true } as unknown as T;
        }

        if (spec.action === 'importServicesBatch') {
          const items = Array.isArray(parsedBody.items) ? parsedBody.items : [];
          let importedCount = 0;
          for (const item of items) {
            if (item && typeof item === 'object') {
              const created = await executeGasAction(
                targetUrl,
                'createService',
                item as Record<string, unknown>,
                spec.token || '',
                false
              );
              if (!created.ok || created.data.error) {
                throw new Error(String(created.data.error || errMsg));
              }
              importedCount++;
            }
          }
          return { ok: true, count: importedCount, savedViaFallback: true } as unknown as T;
        }

        const berandaActions = [
          'getBerandaContent',
          'getAdminBeranda',
          'uploadBerandaMedia',
          'updateHeroBanner',
          'saveBerandaProgram',
          'deleteBerandaProgram',
          'saveBerandaGaleri',
          'deleteBerandaGaleri',
          'saveBerandaFooter',
          'saveTemplateFile',
          'deleteTemplateFile',
        ];
        if (berandaActions.some((a) => errMsg.includes(a))) {
          throw new Error(BERANDA_OUTDATED_GAS_GUIDE);
        }
      }

      if (errMsg.includes('Entitas organisasi tidak valid')) {
        throw new Error(
          'Script Google Apps Script (Code.gs) pada Web App Anda masih versi lama sehingga belum mendukung entitas terbaru (TP PKK / Sekolah / Balai RW). Salin ulang isi gas/Code.gs & gas/SetupDatabase.gs ke editor Apps Script, jalankan setupDatabase(), lalu pilih Deploy → Kelola deployment → Edit → Versi baru.'
        );
      }
      throw new Error(errMsg);
    }
    if (url === '/api/admin/test-gas') {
      return { ok: true, status, preview: rawText.slice(0, 300) } as unknown as T;
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
  const res = await fetch(url, { ...options, cache: 'no-store', headers });
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
