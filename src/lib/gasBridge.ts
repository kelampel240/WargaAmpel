export interface GasCallSpec {
  action: string;
  payload: Record<string, unknown>;
  token?: string;
  localResponse?: unknown;
}

export function isValidGasWebAppUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[^/]+\/exec(\?.*)?$/.test(trimmed);
}

export function mapRestToGasCall(
  rawUrl: string,
  method = 'GET',
  bodyObj: Record<string, unknown> = {},
  token?: string | null
): GasCallSpec {
  const upperMethod = method.toUpperCase();
  const [pathname, queryStr] = rawUrl.split('?');
  const searchParams = new URLSearchParams(queryStr || '');

  // Public routes
  if (pathname === '/api/public/services' && upperMethod === 'GET') {
    return { action: 'getPublicServices', payload: {} };
  }
  if (pathname === '/api/public/announcements' && upperMethod === 'GET') {
    return { action: 'getPublicAnnouncements', payload: {} };
  }
  if (pathname === '/api/public/role-accounts' && upperMethod === 'GET') {
    return { action: 'getPublicRoleAccounts', payload: {} };
  }

  // Auth routes
  if (pathname === '/api/auth/me' && upperMethod === 'GET') {
    return { action: 'getAuthMe', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/auth/login' && upperMethod === 'POST') {
    return { action: 'authenticateUser', payload: bodyObj };
  }
  if (pathname === '/api/auth/register' && upperMethod === 'POST') {
    return { action: 'registerCitizen', payload: bodyObj };
  }
  if (pathname === '/api/auth/verify' && upperMethod === 'POST') {
    return { action: 'verifyCitizenAccount', payload: bodyObj };
  }
  if (pathname === '/api/auth/reset-password' && upperMethod === 'POST') {
    return { action: 'resetPassword', payload: bodyObj };
  }

  // Citizen reporting & tracking
  if (pathname === '/api/reports' && upperMethod === 'POST') {
    return { action: 'submitReport', payload: bodyObj, token: token || undefined };
  }
  if (pathname === '/api/reports/track' && upperMethod === 'POST') {
    return { action: 'getReportStatus', payload: bodyObj };
  }
  if (pathname === '/api/citizen/dashboard' && upperMethod === 'GET') {
    return { action: 'getCitizenDashboard', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/citizen/reports' && upperMethod === 'GET') {
    return { action: 'getCitizenReports', payload: {}, token: token || undefined };
  }
  const notifMatch = pathname.match(/^\/api\/citizen\/notifications\/([^/]+)\/read$/);
  if (notifMatch && upperMethod === 'POST') {
    return {
      action: 'markNotificationRead',
      payload: { idNotifikasi: decodeURIComponent(notifMatch[1]) },
      token: token || undefined,
    };
  }

  // Admin & Officer routes
  if (pathname === '/api/admin/dashboard' && upperMethod === 'GET') {
    return { action: 'getAdminDashboard', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/reports' && upperMethod === 'GET') {
    return {
      action: 'getAllReports',
      payload: {
        group: searchParams.get('group') || undefined,
        status: searchParams.get('status') || undefined,
        search: searchParams.get('search') || undefined,
      },
      token: token || undefined,
    };
  }
  const detailMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)$/);
  if (detailMatch && upperMethod === 'GET') {
    return {
      action: 'getReportDetail',
      payload: { idLaporan: decodeURIComponent(detailMatch[1]) },
      token: token || undefined,
    };
  }
  const followUpMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/followup$/);
  if (followUpMatch && upperMethod === 'POST') {
    return {
      action: 'saveFollowUp',
      payload: { ...bodyObj, idLaporan: decodeURIComponent(followUpMatch[1]) },
      token: token || undefined,
    };
  }
  const evidenceMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/evidence$/);
  if (evidenceMatch && upperMethod === 'POST') {
    return {
      action: 'uploadEvidence',
      payload: { ...bodyObj, idLaporan: decodeURIComponent(evidenceMatch[1]) },
      token: token || undefined,
    };
  }
  const classifyMatch = pathname.match(/^\/api\/admin\/reports\/([^/]+)\/classify$/);
  if (classifyMatch && upperMethod === 'POST') {
    return {
      action: 'classifyReport',
      payload: { ...bodyObj, idLaporan: decodeURIComponent(classifyMatch[1]) },
      token: token || undefined,
    };
  }

  // Service Builder
  if (pathname === '/api/admin/services' && upperMethod === 'GET') {
    return { action: 'getAdminServices', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/services' && upperMethod === 'POST') {
    return { action: 'createService', payload: bodyObj, token: token || undefined };
  }
  const svcMatch = pathname.match(/^\/api\/admin\/services\/([^/]+)$/);
  if (svcMatch && upperMethod === 'PUT') {
    return {
      action: 'updateService',
      payload: { ...bodyObj, idLayanan: decodeURIComponent(svcMatch[1]) },
      token: token || undefined,
    };
  }
  if (svcMatch && upperMethod === 'DELETE') {
    return {
      action: 'deleteService',
      payload: { idLayanan: decodeURIComponent(svcMatch[1]) },
      token: token || undefined,
    };
  }

  // Warga, Petugas, Drive, Announcements, Settings, Logs, Export
  if (pathname === '/api/admin/warga' && upperMethod === 'GET') {
    return { action: 'getWarga', payload: {}, token: token || undefined };
  }
  const verifyWargaMatch = pathname.match(/^\/api\/admin\/warga\/([^/]+)\/verify$/);
  if (verifyWargaMatch && (upperMethod === 'POST' || upperMethod === 'PATCH')) {
    return {
      action: 'verifyWarga',
      payload: { ...bodyObj, idWarga: decodeURIComponent(verifyWargaMatch[1]) },
      token: token || undefined,
    };
  }
  if (pathname === '/api/admin/petugas' && upperMethod === 'GET') {
    return { action: 'getPetugas', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/petugas' && upperMethod === 'POST') {
    return { action: 'createPetugas', payload: bodyObj, token: token || undefined };
  }
  if (pathname === '/api/admin/petugas/import' && upperMethod === 'POST') {
    return { action: 'importPetugasBatch', payload: bodyObj, token: token || undefined };
  }
  if ((pathname === '/api/admin/drive' || pathname === '/api/admin/drive-tree') && upperMethod === 'GET') {
    return { action: 'getDriveTree', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/announcements' && upperMethod === 'GET') {
    return { action: 'getAnnouncements', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/announcements' && upperMethod === 'POST') {
    return { action: 'createAnnouncement', payload: bodyObj, token: token || undefined };
  }
  const annDelMatch = pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/);
  if (annDelMatch && upperMethod === 'DELETE') {
    return {
      action: 'deleteAnnouncement',
      payload: { idPengumuman: decodeURIComponent(annDelMatch[1]) },
      token: token || undefined,
    };
  }
  if (pathname === '/api/admin/settings' && upperMethod === 'GET') {
    return { action: 'getSettings', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/settings' && upperMethod === 'PUT') {
    return { action: 'saveSettings', payload: bodyObj, token: token || undefined };
  }
  if (pathname === '/api/admin/logs' && upperMethod === 'GET') {
    return { action: 'getLogs', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/export' && upperMethod === 'GET') {
    return { action: 'exportReportCsv', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/backup-json' && upperMethod === 'GET') {
    return { action: 'getBackupJson', payload: {}, token: token || undefined };
  }
  const driveLinkMatch = pathname.match(/^\/api\/admin\/evidence\/([^/]+)\/drive-link$/);
  if (driveLinkMatch && upperMethod === 'PATCH') {
    return {
      action: 'updateEvidenceDriveLink',
      payload: { ...bodyObj, idBukti: decodeURIComponent(driveLinkMatch[1]) },
      token: token || undefined,
    };
  }
  if (pathname === '/api/admin/test-gas' && upperMethod === 'POST') {
    return { action: 'ping', payload: bodyObj, token: token || undefined };
  }
  if (pathname === '/api/gas-bundle' && upperMethod === 'GET') {
    return {
      action: 'ping',
      payload: {},
      localResponse: {
        bundle: {
          'INFO.txt':
            'Portal berjalan dalam mode statis (GitHub Pages -> Google Apps Script).\nBerkas skrip lengkap tersedia di folder /gas/ pada repositori GitHub.',
        },
      },
    };
  }

  // Organization Structure routes
  if (pathname === '/api/public/org-structure' && upperMethod === 'GET') {
    return { action: 'getPublicOrgStructure', payload: {} };
  }
  if (pathname === '/api/admin/org-structure' && upperMethod === 'GET') {
    return { action: 'getAdminOrgStructure', payload: {}, token: token || undefined };
  }
  if (pathname === '/api/admin/org-settings' && upperMethod === 'PUT') {
    return { action: 'saveOrgSettings', payload: bodyObj, token: token || undefined };
  }
  const orgImportMatch = pathname.match(
    /^\/api\/admin\/org\/(kelurahan|lpmk|rw|rt|kader|sekolah|guru|balai_rw)\/import$/
  );
  if (orgImportMatch && upperMethod === 'POST') {
    return {
      action: 'importOrgBatch',
      payload: { ...bodyObj, entity: orgImportMatch[1] },
      token: token || undefined,
    };
  }
  const orgPostMatch = pathname.match(
    /^\/api\/admin\/org\/(kelurahan|lpmk|rw|rt|kader|sekolah|guru|balai_rw)$/
  );
  if (orgPostMatch && upperMethod === 'POST') {
    return {
      action: 'createOrgItem',
      payload: { ...bodyObj, entity: orgPostMatch[1] },
      token: token || undefined,
    };
  }
  const orgItemMatch = pathname.match(
    /^\/api\/admin\/org\/(kelurahan|lpmk|rw|rt|kader|sekolah|guru|balai_rw)\/([^/]+)$/
  );
  if (orgItemMatch && upperMethod === 'PUT') {
    return {
      action: 'updateOrgItem',
      payload: { ...bodyObj, entity: orgItemMatch[1], id: decodeURIComponent(orgItemMatch[2]) },
      token: token || undefined,
    };
  }
  if (orgItemMatch && upperMethod === 'DELETE') {
    return {
      action: 'deleteOrgItem',
      payload: { entity: orgItemMatch[1], id: decodeURIComponent(orgItemMatch[2]) },
      token: token || undefined,
    };
  }

  throw new Error(`Endpoint ${upperMethod} ${pathname} belum dipetakan ke Google Apps Script.`);
}
