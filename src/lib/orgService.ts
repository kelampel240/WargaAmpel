import { apiFetch } from './api';
import { OrgEntityType } from '../shared/orgLogic';
import {
  AdminOrgStructureResponse,
  PublicOrgStructureResponse,
} from '../shared/types';

export async function fetchPublicOrgStructure(): Promise<PublicOrgStructureResponse> {
  return apiFetch<PublicOrgStructureResponse>('/api/public/org-structure');
}

export async function fetchAdminOrgStructure(): Promise<AdminOrgStructureResponse> {
  return apiFetch<AdminOrgStructureResponse>('/api/admin/org-structure');
}

export async function createOrgItem(
  entity: OrgEntityType,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return apiFetch<{ ok: boolean; id: string }>(`/api/admin/org/${entity}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function importOrgItemsBatch(
  entity: OrgEntityType,
  items: Array<Record<string, unknown>>
): Promise<{ ok: boolean; count: number; ids: string[] }> {
  return apiFetch<{ ok: boolean; count: number; ids: string[] }>(`/api/admin/org/${entity}/import`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export async function updateOrgItem(
  entity: OrgEntityType,
  id: string,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; id: string }> {
  return apiFetch<{ ok: boolean; id: string }>(`/api/admin/org/${entity}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteOrgItem(
  entity: OrgEntityType,
  id: string
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/api/admin/org/${entity}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function saveOrgDisplaySettings(
  displaySettings: PublicOrgStructureResponse['displaySettings']
): Promise<{ displaySettings: PublicOrgStructureResponse['displaySettings'] }> {
  return apiFetch<{ displaySettings: PublicOrgStructureResponse['displaySettings'] }>(
    '/api/admin/org-settings',
    {
      method: 'PUT',
      body: JSON.stringify(displaySettings),
    }
  );
}
