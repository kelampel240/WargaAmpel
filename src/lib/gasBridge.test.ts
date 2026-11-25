import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGasWebAppUrl, mapRestToGasCall } from './gasBridge';

test('isValidGasWebAppUrl validates standard and Workspace GAS Web App URLs', () => {
  assert.equal(
    isValidGasWebAppUrl('https://script.google.com/macros/s/AKfycbx123456/exec'),
    true
  );
  assert.equal(
    isValidGasWebAppUrl('https://script.google.com/a/ampel.kelurahan.id/macros/s/AKfycbx123456/exec'),
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

  const roleAccs = mapRestToGasCall('/api/public/role-accounts', 'GET');
  assert.equal(roleAccs.action, 'getPublicRoleAccounts');

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

  const createTpPkk = mapRestToGasCall('/api/admin/org/tp_pkk', 'POST', { nama: 'Ibu Ketua', jabatan: 'Ketua PKK' }, 'tok-1');
  assert.equal(createTpPkk.action, 'createOrgItem');
  assert.equal(createTpPkk.payload.entity, 'tp_pkk');

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

  // Beranda & Super Admin Beranda CMS routes
  const pubBeranda = mapRestToGasCall('/api/public/beranda', 'GET');
  assert.equal(pubBeranda.action, 'getBerandaContent');

  const adminBeranda = mapRestToGasCall('/api/admin/beranda', 'GET', {}, 'tok-sa');
  assert.equal(adminBeranda.action, 'getAdminBeranda');
  assert.equal(adminBeranda.token, 'tok-sa');

  const uploadMedia = mapRestToGasCall(
    '/api/admin/beranda/upload',
    'POST',
    { fileName: 'hero.jpg', mimeType: 'image/jpeg', base64Data: 'abc', category: 'banner' },
    'tok-sa'
  );
  assert.equal(uploadMedia.action, 'uploadBerandaMedia');
  assert.equal(uploadMedia.payload.category, 'banner');
  assert.equal(uploadMedia.token, 'tok-sa');

  const updateBanner = mapRestToGasCall(
    '/api/admin/beranda/banner',
    'PUT',
    { judul: 'WARGA AMPEL', subjudul: 'Sambutan hangat' },
    'tok-sa'
  );
  assert.equal(updateBanner.action, 'updateHeroBanner');
  assert.equal(updateBanner.payload.judul, 'WARGA AMPEL');

  const createProgram = mapRestToGasCall(
    '/api/admin/beranda/program',
    'POST',
    { judul: 'Kerja Bakti', status: 'Berjalan' },
    'tok-sa'
  );
  assert.equal(createProgram.action, 'saveBerandaProgram');
  assert.equal(createProgram.payload.judul, 'Kerja Bakti');

  const updateProgram = mapRestToGasCall(
    '/api/admin/beranda/program/PRG-001',
    'PUT',
    { judul: 'Kerja Bakti RW 02', status: 'Selesai' },
    'tok-sa'
  );
  assert.equal(updateProgram.action, 'saveBerandaProgram');
  assert.equal(updateProgram.payload.idProgram, 'PRG-001');

  const deleteProgram = mapRestToGasCall('/api/admin/beranda/program/PRG-001', 'DELETE', {}, 'tok-sa');
  assert.equal(deleteProgram.action, 'deleteBerandaProgram');
  assert.equal(deleteProgram.payload.idProgram, 'PRG-001');

  const createGaleri = mapRestToGasCall(
    '/api/admin/beranda/galeri',
    'POST',
    { judul: 'Musrenbang', fotoUrl: 'https://example.com/a.jpg' },
    'tok-sa'
  );
  assert.equal(createGaleri.action, 'saveBerandaGaleri');

  const deleteGaleri = mapRestToGasCall('/api/admin/beranda/galeri/GAL-001', 'DELETE', {}, 'tok-sa');
  assert.equal(deleteGaleri.action, 'deleteBerandaGaleri');
  assert.equal(deleteGaleri.payload.idGaleri, 'GAL-001');

  const saveFooter = mapRestToGasCall(
    '/api/admin/beranda/footer',
    'PUT',
    { alamatKantor: 'Balai Kelurahan Ampel', jamLayanan: 'Senin - Jumat, 08.00 - 15.00 WIB' },
    'tok-sa'
  );
  assert.equal(saveFooter.action, 'saveBerandaFooter');
  assert.equal(saveFooter.payload.alamatKantor, 'Balai Kelurahan Ampel');

  // Contoh File Warga (Super Admin upload -> Public/Warga download)
  const pubTemplateFiles = mapRestToGasCall('/api/public/template-files', 'GET');
  assert.equal(pubTemplateFiles.action, 'getPublicTemplateFiles');

  const adminTemplateFiles = mapRestToGasCall('/api/admin/template-files', 'GET', {}, 'tok-sa');
  assert.equal(adminTemplateFiles.action, 'getAdminTemplateFiles');
  assert.equal(adminTemplateFiles.token, 'tok-sa');

  const uploadTemplate = mapRestToGasCall(
    '/api/admin/template-files',
    'POST',
    { judulFile: 'Contoh F-1.02', idLayanan: 'LAY-01' },
    'tok-sa'
  );
  assert.equal(uploadTemplate.action, 'saveTemplateFile');
  assert.equal(uploadTemplate.payload.judulFile, 'Contoh F-1.02');

  const updateTemplate = mapRestToGasCall(
    '/api/admin/template-files/CF-001',
    'PUT',
    { judulFile: 'Contoh F-1.02 Revisi' },
    'tok-sa'
  );
  assert.equal(updateTemplate.action, 'saveTemplateFile');
  assert.equal(updateTemplate.payload.idFile, 'CF-001');

  const deleteTemplate = mapRestToGasCall('/api/admin/template-files/CF-001', 'DELETE', {}, 'tok-sa');
  assert.equal(deleteTemplate.action, 'deleteTemplateFile');
  assert.equal(deleteTemplate.payload.idFile, 'CF-001');

  const importServices = mapRestToGasCall(
    '/api/admin/services/import',
    'POST',
    { items: [{ namaLayanan: 'Domisili', kategoriGrup: 'C. Administrasi' }] },
    'tok-sa'
  );
  assert.equal(importServices.action, 'importServicesBatch');
  assert.equal(importServices.token, 'tok-sa');

  const delService = mapRestToGasCall('/api/admin/services/LAY-001', 'DELETE', {}, 'tok-sa');
  assert.equal(delService.action, 'deleteService');
  assert.equal(delService.payload.idLayanan, 'LAY-001');
});
