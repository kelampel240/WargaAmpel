import { clearCachedAccessToken, getGoogleDriveAccessToken } from './googleDriveAuth';

export interface GoogleDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
  capabilities?: {
    canEdit?: boolean;
    canDelete?: boolean;
    canRename?: boolean;
  };
}

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export const SIWARGA_SUBFOLDERS = [
  '01_LAPORAN_WARGA',
  '02_SURAT_ADMINISTRASI',
  '03_BUKTI_PENANGANAN',
  '04_SURAT_KE_DINAS',
  '05_DOKUMEN_PENDUKUNG',
  '06_FOTO_ORGANISASI',
] as const;

async function requireToken(): Promise<string> {
  const token = await getGoogleDriveAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }
  return token;
}

async function driveFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
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
    throw new Error(errObj?.message || `Permintaan Google Drive gagal (${res.status}).`);
  }
  return data as T;
}

export function extractDriveFolderId(input: string): string {
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  return trimmed;
}

export async function getDriveFileMetadata(fileId: string): Promise<GoogleDriveFileItem> {
  const cleanId = extractDriveFolderId(fileId);
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canEdit,canDelete,canRename)',
    supportsAllDrives: 'true',
  });
  return driveFetchJson<GoogleDriveFileItem>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(cleanId)}?${params.toString()}`
  );
}

export async function listDriveFiles(options: {
  folderId?: string;
  search?: string;
  pageSize?: number;
}): Promise<GoogleDriveFileItem[]> {
  const clauses: string[] = ['trashed = false'];
  if (options.folderId && options.folderId !== 'root') {
    const cleanId = extractDriveFolderId(options.folderId).replace(/'/g, "\\'");
    clauses.push(`'${cleanId}' in parents`);
  } else if (!options.search?.trim()) {
    clauses.push(`'root' in parents`);
  }

  if (options.search?.trim()) {
    const q = options.search.trim().replace(/'/g, "\\'");
    clauses.push(`name contains '${q}'`);
  }

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: String(options.pageSize || 50),
    orderBy: 'folder,modifiedTime desc',
    fields:
      'files(id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canEdit,canDelete,canRename))',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const data = await driveFetchJson<{ files?: GoogleDriveFileItem[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  );
  return data.files || [];
}

export async function findDriveFolderByName(
  name: string,
  parentId?: string
): Promise<GoogleDriveFileItem | null> {
  const safeName = name.replace(/'/g, "\\'");
  const clauses = [
    'trashed = false',
    `mimeType = '${DRIVE_FOLDER_MIME}'`,
    `name = '${safeName}'`,
  ];
  if (parentId && parentId !== 'root') {
    clauses.push(`'${parentId.replace(/'/g, "\\'")}' in parents`);
  }
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    pageSize: '5',
    fields: 'files(id,name,mimeType,webViewLink,parents)',
  });
  const data = await driveFetchJson<{ files?: GoogleDriveFileItem[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  );
  return data.files && data.files.length > 0 ? data.files[0] : null;
}

export async function createDriveFolder(
  name: string,
  parentId?: string
): Promise<GoogleDriveFileItem> {
  const metadata: Record<string, unknown> = {
    name: name.trim(),
    mimeType: DRIVE_FOLDER_MIME,
  };
  if (parentId && parentId !== 'root') {
    metadata.parents = [extractDriveFolderId(parentId)];
  }
  return driveFetchJson<GoogleDriveFileItem>(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    }
  );
}

export async function ensureSiwargaDriveStructure(existingRootId?: string): Promise<{
  rootFolder: GoogleDriveFileItem;
  subfolders: Record<string, GoogleDriveFileItem>;
}> {
  let rootFolder: GoogleDriveFileItem | null = null;
  if (existingRootId && existingRootId.trim() && !existingRootId.includes('ISI_')) {
    try {
      const candidate = await getDriveFileMetadata(existingRootId.trim());
      if (candidate && candidate.mimeType === DRIVE_FOLDER_MIME) {
        rootFolder = candidate;
      }
    } catch {
      rootFolder = null;
    }
  }

  if (!rootFolder) {
    rootFolder = await findDriveFolderByName('SIWARGA_DESA');
  }
  if (!rootFolder) {
    rootFolder = await createDriveFolder('SIWARGA_DESA');
  }

  const subfolders: Record<string, GoogleDriveFileItem> = {};
  for (const subName of SIWARGA_SUBFOLDERS) {
    let existing = await findDriveFolderByName(subName, rootFolder.id);
    if (!existing) {
      existing = await createDriveFolder(subName, rootFolder.id);
    }
    subfolders[subName] = existing;
  }

  return { rootFolder, subfolders };
}

export async function uploadFileToDrive(options: {
  fileName: string;
  mimeType: string;
  blob: Blob;
  parentId?: string;
}): Promise<GoogleDriveFileItem> {
  const token = await requireToken();
  const metadata: Record<string, unknown> = {
    name: options.fileName,
    mimeType: options.mimeType,
  };
  if (options.parentId && options.parentId !== 'root') {
    metadata.parents = [extractDriveFolderId(options.parentId)];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', options.blob);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canEdit,canDelete,canRename)',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    }
  );

  if (res.status === 401) {
    clearCachedAccessToken();
    throw new Error('AUTH_REQUIRED');
  }
  const text = await res.text().catch(() => '');
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Gagal mengunggah file ke Google Drive (${res.status}).`);
  }
  return data as unknown as GoogleDriveFileItem;
}

export async function updateFileContentInDrive(options: {
  fileId: string;
  mimeType: string;
  blob: Blob;
}): Promise<GoogleDriveFileItem> {
  const token = await requireToken();
  const res = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(options.fileId)}?uploadType=media&fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canEdit,canDelete,canRename)`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': options.mimeType,
      },
      body: options.blob,
    }
  );
  if (res.status === 401) {
    clearCachedAccessToken();
    throw new Error('AUTH_REQUIRED');
  }
  const text = await res.text().catch(() => '');
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined;
    throw new Error(errObj?.message || `Gagal memperbarui file di Google Drive (${res.status}).`);
  }
  return data as unknown as GoogleDriveFileItem;
}

export async function renameDriveFile(
  fileId: string,
  newName: string
): Promise<GoogleDriveFileItem> {
  return driveFetchJson<GoogleDriveFileItem>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,capabilities(canEdit,canDelete,canRename)`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }
  );
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await requireToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (res.status === 401) {
    clearCachedAccessToken();
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = `Gagal menghapus file (${res.status}).`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
}

export async function downloadDriveFile(file: GoogleDriveFileItem): Promise<void> {
  const token = await requireToken();
  const isGoogleDoc = file.mimeType.startsWith('application/vnd.google-apps.');
  const url = isGoogleDoc
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=application/pdf`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearCachedAccessToken();
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    throw new Error(`Gagal mengunduh "${file.name}" (${res.status}).`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = isGoogleDoc ? `${file.name}.pdf` : file.name;
  a.click();
  URL.revokeObjectURL(blobUrl);
}
