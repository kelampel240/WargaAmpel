import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSingleFormPrintMarkup,
  buildWordDocumentBlob,
  extractDownloadableForms,
  extractRequirementsChecklist,
} from './serviceForms';
import { REPORT_STATUSES, ServiceWithForm } from './types';

function makeService(overrides: Partial<ServiceWithForm>): ServiceWithForm {
  return {
    ID_LAYANAN: 'LAY-TEST',
    KODE_LAYANAN: 'ADM-TEST',
    NAMA_LAYANAN: 'Layanan Uji',
    KATEGORI_GRUP: 'C. Administrasi',
    DESKRIPSI: 'Deskripsi layanan uji',
    IKON: 'file-text',
    PERSYARATAN_DOKUMEN: 'Foto KTP & KK',
    ID_PETUGAS_PJ: 'PTG-003',
    NAMA_PETUGAS_PJ: 'Petugas Layanan Desa Ampel',
    ALUR_STATUS: [...REPORT_STATUSES],
    STATUS_AKTIF: true,
    URUTAN: 1,
    CREATED_AT: '2026-11-01T00:00:00.000Z',
    fields: [],
    ...overrides,
  };
}

test('extractDownloadableForms detects F-1.02, F-1.03, approval letter, and verification forms for Pindah Datang', () => {
  const pindahDatang = makeService({
    ID_LAYANAN: 'LAY-PINDAH',
    NAMA_LAYANAN: 'Pindah Datang',
    DESKRIPSI:
      'F1-02, F1-03, SKPWNI, akta lahir atau nikah, surat persetujuan pemilik rumah, laporan verifikasi domisili',
    PERSYARATAN_DOKUMEN:
      'Di bawah 17 tahun belum menikah perlu penetapan hak asuh atau persetujuan orang tua; surat sekolah jika tidak didampingi',
  });

  const forms = extractDownloadableForms(pindahDatang);
  const codes = forms.map((f) => f.kodeForm);
  assert.ok(codes.includes('F-1.02'));
  assert.ok(codes.includes('F-1.03'));
  assert.ok(codes.includes('SURAT-RUMAH'));
  assert.ok(codes.includes('PENGANTAR-RT/RW'));

  const checklist = extractRequirementsChecklist(pindahDatang);
  assert.ok(checklist.some((item) => /hak asuh|persetujuan orang tua/i.test(item.label)));
  assert.ok(checklist.some((item) => /surat sekolah/i.test(item.label)));
});

test('extractDownloadableForms detects F-2.01, SPTJM, and Pengantar RT/RW for Kelahiran', () => {
  const kelahiran = makeService({
    ID_LAYANAN: 'LAY-LAHIR',
    NAMA_LAYANAN: 'Kelahiran',
    DESKRIPSI:
      'Lahir tanpa asal-usul jelas (BAP atau SPTJM, 2 saksi); usia 3 sampai 17 tahun perlu surat belum masuk KK dari RT/RW',
    PERSYARATAN_DOKUMEN:
      'F-2.01, surat keterangan lahir dari dokter atau bidan, surat nikah orang tua (atau SPTJM), KTP-el pemohon dan saksi',
  });

  const forms = extractDownloadableForms(kelahiran);
  const codes = forms.map((f) => f.kodeForm);
  assert.ok(codes.includes('F-2.01'));
  assert.ok(codes.includes('SPTJM'));
  assert.ok(codes.includes('PENGANTAR-RT/RW'));
});

test('extractDownloadableForms always includes custom dynamic fields and generates valid Word markup', () => {
  const customService = makeService({
    ID_LAYANAN: 'LAY-CUSTOM',
    NAMA_LAYANAN: 'Surat Keterangan Ahli Waris',
    DESKRIPSI: 'Pengurusan keterangan ahli waris warga Kelurahan Ampel',
    PERSYARATAN_DOKUMEN: 'Surat kematian, KTP ahli waris, KK',
    fields: [
      {
        ID_FIELD: 'F-1',
        ID_LAYANAN: 'LAY-CUSTOM',
        LABEL_PERTANYAAN: 'Nama Almarhum / Pewaris',
        TIPE_ISIAN: 'text',
        OPSI_PILIHAN: [],
        WAJIB: true,
        PLACEHOLDER: 'Isi nama lengkap sesuai KTP',
        URUTAN: 1,
      },
    ],
  });

  const forms = extractDownloadableForms(customService);
  assert.equal(forms.length >= 1, true);
  const markup = buildSingleFormPrintMarkup(forms[0], customService, {
    namaKantor: 'Kelurahan Ampel',
    alamat: 'Jl. Raya Desa Ampel No. 01',
    jamLayanan: 'Senin-Jumat 08.00-14.30 WIB',
    telepon: '0336-621104',
    email: 'pelayanan@ampel.desa.id',
  });
  assert.ok(markup.includes('Kelurahan Ampel'));
  assert.ok(markup.includes('Nama Almarhum / Pewaris'));
  assert.ok(markup.includes('Surat kematian'));

  const blob = buildWordDocumentBlob(markup, forms[0].namaForm);
  assert.ok(blob.size > 200);
});
