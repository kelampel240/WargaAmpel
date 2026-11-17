import { clearCachedAccessToken, getGoogleDriveAccessToken } from './googleDriveAuth';

export interface SpreadsheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheets: SpreadsheetTabInfo[];
}

export const SIWARGA_SHEET_TABS = [
  'LAPORAN',
  'TINDAK_LANJUT',
  'KATEGORI_LAYANAN',
  'WARGA',
  'PETUGAS',
  'BUKTI_DOKUMEN',
  'PENGUMUMAN',
  'PENGATURAN',
  'LOG_AKTIVITAS',
] as const;

async function requireToken(): Promise<string> {
  const token = await getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }
  return token;
}

async function sheetsFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await requireToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    clearCachedAccessToken();
    throw new Error('AUTH_REQUIRED');
  }

  const text = await res.text().catch(() => '');
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Permintaan Google Sheets gagal (${res.status}).`);
  }
  return data as T;
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([A-Za-z0-9-_]+)/);
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

function escapeSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

export async function getSpreadsheetMetadata(spreadsheetIdOrUrl: string): Promise<SpreadsheetMetadata> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  if (!spreadsheetId) {
    throw new Error('ID atau URL Google Spreadsheet wajib diisi.');
  }

  const raw = await sheetsFetchJson<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        index?: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))`
  );

  return {
    spreadsheetId: raw.spreadsheetId,
    spreadsheetUrl:
      raw.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${raw.spreadsheetId}/edit`,
    title: raw.properties?.title || 'Spreadsheet Tanpa Judul',
    sheets: (raw.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Sheet ${idx + 1}`,
      index: s.properties?.index ?? idx,
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
    })),
  };
}

export async function readSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  rangeSuffix = 'A1:Z500'
): Promise<string[][]> {
  const range = `${escapeSheetName(sheetTitle)}!${rangeSuffix}`;
  const data = await sheetsFetchJson<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`
  );
  return data.values || [];
}

export async function createSiwargaSpreadsheet(
  title = 'DATABASE_SIWARGA — WARGA AMPEL'
): Promise<SpreadsheetMetadata> {
  const raw = await sheetsFetchJson<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        index?: number;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title },
      sheets: SIWARGA_SHEET_TABS.map((tab, idx) => ({
        properties: { title: tab, index: idx },
      })),
    }),
  });

  return {
    spreadsheetId: raw.spreadsheetId,
    spreadsheetUrl:
      raw.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${raw.spreadsheetId}/edit`,
    title: raw.properties?.title || title,
    sheets: (raw.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || SIWARGA_SHEET_TABS[idx] || `Sheet ${idx + 1}`,
      index: s.properties?.index ?? idx,
      rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
      columnCount: s.properties?.gridProperties?.columnCount ?? 26,
    })),
  };
}

export async function ensureSheetTabs(
  spreadsheetId: string,
  requiredTabs: readonly string[]
): Promise<SpreadsheetMetadata> {
  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const existingTitles = new Set(meta.sheets.map((s) => s.title));
  const missing = requiredTabs.filter((t) => !existingTitles.has(t));

  if (missing.length > 0) {
    await sheetsFetchJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
    return getSpreadsheetMetadata(spreadsheetId);
  }
  return meta;
}

export async function clearAndWriteSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  values: string[][]
): Promise<void> {
  const escaped = escapeSheetName(sheetTitle);
  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${escaped}!A1:ZZ`)}:clear`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
  );

  if (values.length === 0) return;

  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(`${escaped}!A1`)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  );
}

export async function appendSheetRow(
  spreadsheetId: string,
  sheetTitle: string,
  rowValues: string[]
): Promise<void> {
  const range = `${escapeSheetName(sheetTitle)}!A1`;
  await sheetsFetchJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rowValues] }),
    }
  );
}

function serializeObjectsToTable(rows: Array<Record<string, unknown>>): string[][] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }
  const keySet = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (k === 'PASSWORD_HASH' || k === 'NIK_HASH') continue;
      keySet.add(k);
    }
  }
  const headers = Array.from(keySet);
  const body = rows.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    })
  );
  return [headers, ...body];
}

export async function syncFullDatabaseToSpreadsheet(
  spreadsheetId: string,
  db: Record<string, unknown>
): Promise<{ syncedTabs: string[]; spreadsheetUrl: string }> {
  const meta = await ensureSheetTabs(spreadsheetId, SIWARGA_SHEET_TABS);
  const syncedTabs: string[] = [];

  for (const tab of SIWARGA_SHEET_TABS) {
    const rawRows = Array.isArray(db[tab]) ? (db[tab] as Array<Record<string, unknown>>) : [];
    const table = serializeObjectsToTable(rawRows);
    await clearAndWriteSheetValues(spreadsheetId, tab, table.length > 0 ? table : [['(Kosong)']]);
    syncedTabs.push(tab);
  }

  return { syncedTabs, spreadsheetUrl: meta.spreadsheetUrl };
}
