import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

test('isValidGasWebAppUrl validates standard and Workspace GAS Web App URLs', () => {
  assert.equal(
    isValidGasWebAppUrl('https://script.google.com/macros/s/AKfycbx123456/exec'),
    true
  );
  assert.equal(
    isValidGasWebAppUrl('https://script.google.com/a/ampel.desa.id/macros/s/AKfycbx123456/exec'),
    true
  );
  assert.equal(
    isValidGasWebAppUrl(
      'https://script.google.com/macros/s/AKfycbynL1cGsXjMkFrOuJBRq97Dgd8N3zhNV2iG3jtTD9JOB1xbIugOMcptY-2aJbVbnWajoQ/exec'
    ),
    true
  );
  assert.equal(isValidGasWebAppUrl('http://localhost:3000/api'), false);
  assert.equal(isValidGasWebAppUrl(''), false);
});

test('mapRestToGasCall maps public, auth, reporting, and admin routes accurately', () => {
  const pub = mapRestToGasCall('/api/public/services', 'GET');
  assert.equal(pub.action, 'getPublicServices');

  const login = mapRestToGasCall('/api/auth/login', 'POST', { username: 'admin', password: 'secret' });
  assert.equal(login.action, 'authenticateUser');
  assert.equal(login.payload.username, 'admin');

  const followUp = mapRestToGasCall(
    '/api/admin/reports/SW-2026-000001/followup',
    'POST',
    { status: 'Sedang ditindaklanjuti', keterangan: 'Sudah dicek di lapangan' },
    'tok-123'
  );
  assert.equal(followUp.action, 'saveFollowUp');
  assert.equal(followUp.payload.idLaporan, 'SW-2026-000001');
  assert.equal(followUp.token, 'tok-123');

  const listFiltered = mapRestToGasCall('/api/admin/reports?group=A.%20Pengaduan&search=jalan', 'GET', {}, 'tok-123');
  assert.equal(listFiltered.action, 'getAllReports');
  assert.equal(listFiltered.payload.group, 'A. Pengaduan');
  assert.equal(listFiltered.payload.search, 'jalan');

  const createSchool = mapRestToGasCall('/api/admin/org/sekolah', 'POST', { namaSekolah: 'SDN Ampel 01' }, 'tok-1');
  assert.equal(createSchool.action, 'createOrgItem');
  assert.equal(createSchool.payload.entity, 'sekolah');

  const importGuru = mapRestToGasCall('/api/admin/org/guru/import', 'POST', { items: [] }, 'tok-1');
  assert.equal(importGuru.action, 'importOrgBatch');
  assert.equal(importGuru.payload.entity, 'guru');

  const delBalai = mapRestToGasCall('/api/admin/org/balai_rw/BLR-1', 'DELETE', {}, 'tok-1');
  assert.equal(delBalai.action, 'deleteOrgItem');
  assert.equal(delBalai.payload.entity, 'balai_rw');
  assert.equal(delBalai.payload.id, 'BLR-1');

  const driveTree = mapRestToGasCall('/api/admin/drive-tree', 'GET', {}, 'tok-1');
  assert.equal(driveTree.action, 'getDriveTree');
  assert.equal(driveTree.token, 'tok-1');

  const verifyWarga = mapRestToGasCall(
    '/api/admin/warga/WRG-001/verify',
    'PATCH',
    { status: 'TERVERIFIKASI' },
    'tok-1'
  );
  assert.equal(verifyWarga.action, 'verifyWarga');
  assert.equal(verifyWarga.payload.idWarga, 'WRG-001');
  assert.equal(verifyWarga.payload.status, 'TERVERIFIKASI');
});
