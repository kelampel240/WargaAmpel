import { BerandaFooterInfo, ServiceWithForm } from './types';

export interface FormFillField {
  label: string;
  hint?: string;
  multiline?: boolean;
}

export interface DownloadableServiceForm {
  id: string;
  kodeForm: string;
  namaForm: string;
  keterangan: string;
  estimasiWaktu: string;
  externalUrl?: string;
  sections: Array<{
    judulBagian: string;
    fields: FormFillField[];
  }>;
  catatanPengisian?: string[];
}

export interface ServiceRequirementItem {
  id: string;
  label: string;
  isOptional: boolean;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyFileName(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'formulir_layanan'
  );
}

export function extractRequirementsChecklist(service: ServiceWithForm): ServiceRequirementItem[] {
  const items: ServiceRequirementItem[] = [];
  const seen = new Set<string>();

  const pushSegments = (raw: string | undefined) => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    // Split on semicolon, newline, or comma (while preserving parentheses content reasonably)
    const parts = clean
      .split(/[;\n]+|,(?![^(]*\))/)
      .map((p) => p.replace(/^[\s\-•*]+/, '').trim())
      .filter((p) => p.length >= 2);

    for (const part of parts) {
      // Ignore pure external URLs from checklist text
      if (/^https?:\/\/\S+$/i.test(part)) continue;
      const key = part.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `REQ-${items.length + 1}`,
        label: part,
        isOptional: /opsional/i.test(part),
      });
    }
  };

  pushSegments(service.PERSYARATAN_DOKUMEN);
  if (items.length === 0) {
    pushSegments(service.DESKRIPSI);
  }

  // Ensure fundamental identity documents are reminded for Kantor Kelurahan submissions
  if (
    service.KATEGORI_GRUP === 'C. Administrasi' &&
    !Array.from(seen).some((s) => /\bktp\b|\bkk\b|ktp-el/i.test(s))
  ) {
    items.unshift({
      id: 'REQ-KTP-KK',
      label: 'Fotokopi KTP-el dan Kartu Keluarga (KK) Pemohon yang masih berlaku',
      isOptional: false,
    });
  }

  return items;
}

export function extractDownloadableForms(service: ServiceWithForm): DownloadableServiceForm[] {
  const combinedText = `${service.NAMA_LAYANAN} ${service.DESKRIPSI} ${service.PERSYARATAN_DOKUMEN}`;
  const forms: DownloadableServiceForm[] = [];
  const addedCodes = new Set<string>();

  const addForm = (form: DownloadableServiceForm) => {
    if (addedCodes.has(form.kodeForm)) return;
    addedCodes.add(form.kodeForm);
    forms.push(form);
  };

  // Detect any external URL provided in sheet text (e.g. Drive PDF link)
  const urls = combinedText.match(/https?:\/\/[^\s,;)]+/gi) || [];

  // 1. Official F-1.02 (Pendaftaran Peristiwa Kependudukan)
  if (/F[-.\s]?1[.-]?02/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-F102`,
      kodeForm: 'F-1.02',
      namaForm: 'Formulir F-1.02 — Pendaftaran Peristiwa Kependudukan',
      keterangan:
        'Formulir resmi permohonan pencatatan/perubahan data kependudukan (KK, KTP-el, KIA, atau Pindah Datang) untuk diserahkan di loket Kelurahan.',
      estimasiWaktu: 'Diisi sebelum ke loket · 1 lembar',
      sections: [
        {
          judulBagian: 'I. Data Pemohon',
          fields: [
            { label: 'Nama Lengkap Pemohon (sesuai KTP-el)' },
            { label: 'Nomor Induk Kependudukan (NIK)' },
            { label: 'Nomor Kartu Keluarga (KK)' },
            { label: 'Alamat Lengkap / Dusun / RT-RW' },
            { label: 'Nomor HP / WhatsApp Aktif' },
          ],
        },
        {
          judulBagian: 'II. Jenis Permohonan Dokumen Kependudukan',
          fields: [
            {
              label: 'Pilih Jenis Layanan',
              hint: '[ ] Kartu Keluarga Baru   [ ] Perubahan Data KK   [ ] KTP-el   [ ] Pindah Datang   [ ] KIA',
            },
            { label: 'Alasan Permohonan / Keterangan Tambahan', multiline: true },
          ],
        },
      ],
      catatanPengisian: [
        'Tulis menggunakan huruf kapital dengan tinta hitam agar jelas terbaca petugas.',
        'Lampirkan fotokopi KTP-el, Kartu Keluarga, serta dokumen pendukung asli saat datang ke loket.',
      ],
    });
  }

  // 2. Official F-1.03 / SKPWNI (Pendaftaran Perpindahan Penduduk)
  if (/F[-.\s]?1[.-]?03|SKPWNI|pindah\s*datang/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-F103`,
      kodeForm: 'F-1.03',
      namaForm: 'Formulir F-1.03 — Pendaftaran Perpindahan Penduduk (SKPWNI)',
      keterangan:
        'Formulir resmi pendaftaran pindah datang atau pindah keluar penduduk antar kecamatan/kabupaten/kota.',
      estimasiWaktu: 'Diisi sebelum ke loket · 1 lembar',
      sections: [
        {
          judulBagian: 'I. Data Daerah Asal',
          fields: [
            { label: 'Nomor Kartu Keluarga (KK) Asal' },
            { label: 'Nama Kepala Keluarga Asal' },
            { label: 'NIK Pemohon' },
            { label: 'Nama Lengkap Pemohon' },
            { label: 'Alamat Asal Lengkap (Kelurahan/Desa, Kecamatan, Kab/Kota)' },
          ],
        },
        {
          judulBagian: 'II. Data Kepindahan & Daerah Tujuan',
          fields: [
            {
              label: 'Alasan Kepindahan',
              hint: '[ ] Pekerjaan   [ ] Pendidikan   [ ] Keamanan   [ ] Kesehatan   [ ] Perumahan   [ ] Keluarga',
            },
            { label: 'Alamat Tujuan di Kelurahan Ampel (Jalan/Lingkungan, RT/RW)' },
            {
              label: 'Jenis Kepindahan',
              hint: '[ ] Kepala Keluarga   [ ] Kepala Keluarga & Seluruh Anggota   [ ] Anggota Keluarga',
            },
            { label: 'Daftar Anggota Keluarga yang Ikut Pindah (Nama & NIK)', multiline: true },
          ],
        },
      ],
      catatanPengisian: [
        'Sertakan SKPWNI asli dari daerah asal apabila mengurus pindah datang ke Kelurahan Ampel.',
      ],
    });
  }

  // 3. Official F-2.01 (Pelaporan Pencatatan Sipil — Kelahiran / Kematian / Perkawinan)
  if (/F[-.\s]?2[.-]?01|kelahiran/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-F201`,
      kodeForm: 'F-2.01',
      namaForm: 'Formulir F-2.01 — Pelaporan Pencatatan Sipil (Akta Kelahiran)',
      keterangan:
        'Formulir resmi pelaporan pencatatan sipil untuk penerbitan Kutipan Akta Kelahiran di Kantor Kelurahan Ampel.',
      estimasiWaktu: 'Diisi lengkap + 2 saksi · 2 lembar',
      sections: [
        {
          judulBagian: 'I. Data Pelapor & Orang Tua',
          fields: [
            { label: 'Nama Lengkap Pelapor & NIK' },
            { label: 'Nomor KK & Nomor HP/WhatsApp' },
            { label: 'Nama Lengkap Ayah & NIK' },
            { label: 'Nama Lengkap Ibu & NIK' },
            { label: 'Tanggal Pencatatan Perkawinan Orang Tua / Nomor Akta Nikah' },
          ],
        },
        {
          judulBagian: 'II. Data Anak / Bayi yang Dilaporkan',
          fields: [
            { label: 'Nama Lengkap Anak / Bayi' },
            { label: 'Jenis Kelamin', hint: '[ ] Laki-laki   [ ] Perempuan' },
            { label: 'Tempat, Hari & Tanggal Lahir (serta Jam Kelahiran)' },
            {
              label: 'Penolong Kelahiran & Tempat Dilahirkan',
              hint: '[ ] RS/RB   [ ] Puskesmas   [ ] Bidan/Dokter   [ ] Lainnya',
            },
            { label: 'Kelahiran Ke- / Berat & Panjang Bayi' },
          ],
        },
        {
          judulBagian: 'III. Data Saksi (2 Orang)',
          fields: [
            { label: 'Nama & NIK Saksi I' },
            { label: 'Nama & NIK Saksi II' },
          ],
        },
      ],
      catatanPengisian: [
        'Wajib melampirkan Surat Keterangan Lahir asli dari dokter/bidan/rumah sakit.',
        'Jika buku nikah tidak ada atau belum tercatat, sertakan formulir SPTJM di bawah ini.',
      ],
    });
  }

  // 4. SPTJM (Surat Pernyataan Tanggung Jawab Mutlak)
  if (/SPTJM/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-SPTJM`,
      kodeForm: 'SPTJM',
      namaForm: 'Surat Pernyataan Tanggung Jawab Mutlak (SPTJM)',
      keterangan:
        'Surat pernyataan kebenaran data kelahiran atau pasangan suami istri apabila dokumen nikah/kelahiran belum tersedia.',
      estimasiWaktu: 'Bermaterai Rp10.000 · 1 lembar',
      sections: [
        {
          judulBagian: 'Identitas Pembuat Pernyataan',
          fields: [
            { label: 'Nama Lengkap' },
            { label: 'NIK' },
            { label: 'Tempat, Tanggal Lahir' },
            { label: 'Pekerjaan' },
            { label: 'Alamat Lengkap (RT/RW)' },
            { label: 'Isi Pernyataan Kebenaran Data (Nama Anak / Pasangan & Fakta Kejadian)', multiline: true },
            { label: 'Nama, NIK & Tanda Tangan 2 (Dua) Orang Saksi', multiline: true },
          ],
        },
      ],
      catatanPengisian: [
        'Tempelkan materai Rp10.000 pada kolom tanda tangan pembuat pernyataan sebelum diserahkan ke petugas kelurahan.',
      ],
    });
  }

  // 5. Surat Persetujuan Pemilik Rumah
  if (/persetujuan pemilik rumah/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-PEMILIK-RUMAH`,
      kodeForm: 'SURAT-RUMAH',
      namaForm: 'Surat Pernyataan Persetujuan Pemilik Rumah / Jaminan Domisili',
      keterangan:
        'Surat persetujuan dari pemilik rumah/induk semang bagi warga pindah datang yang menumpang atau menyewa tempat tinggal.',
      estimasiWaktu: 'Ditandatangani pemilik rumah · 1 lembar',
      sections: [
        {
          judulBagian: 'I. Identitas Pemilik Rumah',
          fields: [
            { label: 'Nama Lengkap Pemilik Rumah' },
            { label: 'NIK Pemilik Rumah' },
            { label: 'Alamat Rumah yang Ditempati (Dusun, RT/RW)' },
          ],
        },
        {
          judulBagian: 'II. Identitas Warga yang Menumpang / Pindah Datang',
          fields: [
            { label: 'Nama Lengkap Pemohon Pindah Datang' },
            { label: 'NIK & Nomor KK Asal' },
            { label: 'Status Tinggal', hint: '[ ] Menumpang Keluarga   [ ] Sewa / Kontrak   [ ] Lainnya' },
          ],
        },
      ],
    });
  }

  // 6. Surat Pengantar RT/RW & Verifikasi Domisili
  if (/RT\/RW|domisili|verifikasi domisili|pengantar/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-PENGANTAR-RTRW`,
      kodeForm: 'PENGANTAR-RT/RW',
      namaForm: 'Surat Pengantar RT/RW & Keterangan Verifikasi Domisili',
      keterangan:
        'Lembar pengantar dan verifikasi tempat tinggal yang diketahui Ketua RT dan Ketua RW setempat sebelum dibawa ke Kantor Kelurahan Ampel.',
      estimasiWaktu: 'Tanda tangan RT/RW · 1 lembar',
      sections: [
        {
          judulBagian: 'Data Warga & Keperluan',
          fields: [
            { label: 'Nama Lengkap Warga' },
            { label: 'NIK / Nomor KK' },
            { label: 'Tempat, Tanggal Lahir' },
            { label: 'Alamat Domisili Saat Ini (RT / RW / Dusun)' },
            { label: 'Keperluan Pengurusan di Kantor Kelurahan Ampel', multiline: true },
          ],
        },
      ],
    });
  }

  // 7. Surat Keterangan Usaha (SKU)
  if (/usaha|\bSKU\b/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-SKU`,
      kodeForm: 'FORM-SKU',
      namaForm: 'Formulir Permohonan Surat Keterangan Usaha (SKU)',
      keterangan:
        'Formulir resmi permohonan penerbitan Surat Keterangan Usaha mikro/UMKM untuk pengajuan KUR, NIB, atau administrasi usaha.',
      estimasiWaktu: 'Diisi pemohon · 1 lembar',
      sections: [
        {
          judulBagian: 'I. Identitas Pemilik Usaha',
          fields: [
            { label: 'Nama Lengkap Pemohon' },
            { label: 'NIK' },
            { label: 'Alamat Tempat Tinggal (RT/RW)' },
            { label: 'Nomor HP / WhatsApp' },
          ],
        },
        {
          judulBagian: 'II. Rincian Kegiatan Usaha',
          fields: [
            { label: 'Nama / Jenis Bidang Usaha' },
            { label: 'Alamat Lokasi Tempat Usaha' },
            { label: 'Lama Usaha Berjalan' },
            { label: 'Keperluan Pembuatan SKU (misal: KUR Bank / NIB / Koperasi)' },
          ],
        },
      ],
    });
  }

  // 8. Surat Keterangan Tidak Mampu (SKTM)
  if (/tidak mampu|\bSKTM\b/i.test(combinedText)) {
    addForm({
      id: `${service.ID_LAYANAN}-SKTM`,
      kodeForm: 'FORM-SKTM',
      namaForm: 'Formulir Permohonan Surat Keterangan Tidak Mampu (SKTM)',
      keterangan:
        'Formulir permohonan SKTM untuk keperluan keringanan biaya pendidikan sekolah, beasiswa, atau jaminan layanan kesehatan.',
      estimasiWaktu: 'Diisi + pengantar RT/RW · 1 lembar',
      sections: [
        {
          judulBagian: 'Data Pemohon & Keterangan Keperluan',
          fields: [
            { label: 'Nama Lengkap Kepala Keluarga / Pemohon' },
            { label: 'NIK & Nomor KK' },
            { label: 'Alamat Lengkap (RT/RW)' },
            { label: 'Pekerjaan & Penghasilan Rata-Rata per Bulan' },
            { label: 'Nama Siswa / Pasien Penerima Manfaat (jika untuk anggota keluarga)' },
            { label: 'Tujuan Penggunaan SKTM (Sekolah / Rumah Sakit / BPJS)' },
          ],
        },
      ],
    });
  }

  // Always provide a tailored Formulir Permohonan Layanan Resmi when no specialized main form was matched,
  // OR when the service has custom KONFIGURASI_FORM fields configured by Admin
  if (forms.length === 0 || (Array.isArray(service.fields) && service.fields.length > 0 && !addedCodes.has('FORM-SKU'))) {
    const dynamicFields: FormFillField[] = (service.fields || []).map((f) => ({
      label: f.LABEL_PERTANYAAN,
      hint:
        f.OPSI_PILIHAN && f.OPSI_PILIHAN.length > 0
          ? `Pilihan: ${f.OPSI_PILIHAN.join(' / ')}`
          : f.PLACEHOLDER || undefined,
      multiline: f.TIPE_ISIAN === 'textarea' || f.TIPE_ISIAN === 'location',
    }));

    const isBantuan = service.KATEGORI_GRUP === 'B. Bantuan';
    const isPengaduan = service.KATEGORI_GRUP === 'A. Pengaduan';
    const kodePrefix = isBantuan ? 'FORM-BANTUAN' : isPengaduan ? 'FORM-ADUAN' : 'FORM-LAYANAN';

    addForm({
      id: `${service.ID_LAYANAN}-UTAMA`,
      kodeForm: kodePrefix,
      namaForm: `Formulir Permohonan ${service.NAMA_LAYANAN}`,
      keterangan: `Formulir pengajuan resmi layanan "${service.NAMA_LAYANAN}" untuk dilengkapi dan dibawa ke loket pelayanan Kantor Kelurahan Ampel.`,
      estimasiWaktu: 'Siap cetak · 1 lembar',
      sections: [
        {
          judulBagian: 'I. Identitas Pemohon / Pelapor',
          fields: [
            { label: 'Nama Lengkap (sesuai KTP-el)' },
            { label: 'NIK / Nomor KK' },
            { label: 'Alamat Lengkap & RT/RW' },
            { label: 'Nomor HP / WhatsApp Aktif' },
          ],
        },
        {
          judulBagian: `II. Rincian Permohonan (${service.NAMA_LAYANAN})`,
          fields: [
            ...dynamicFields,
            { label: 'Lokasi / Alamat Objek Layanan (jika ada)' },
            { label: 'Uraian Keperluan / Keterangan Tambahan', multiline: true },
          ],
        },
      ],
      catatanPengisian: [
        'Bawa formulir yang telah diisi bersama dokumen persyaratan ke loket pelayanan Kantor Kelurahan Ampel.',
      ],
    });
  }

  // Attach any external PDF/Drive URL found in sheet text to the primary form
  if (urls.length > 0 && forms.length > 0) {
    forms[0].externalUrl = urls[0];
  }

  return forms;
}

export function buildSingleFormPrintMarkup(
  form: DownloadableServiceForm,
  service: ServiceWithForm,
  footer?: BerandaFooterInfo
): string {
  const kantorNama = footer?.namaKantor || 'Pemerintah Kelurahan Ampel';
  const kantorAlamat =
    footer?.alamat || 'Jl. Raya Kelurahan Ampel No. 01, Kecamatan Wuluhan, Kabupaten Jember';
  const kantorKontak = `${footer?.telepon || '(0336) 621-104'} · ${footer?.email || 'pelayanan@ampel.kelurahan.id'}`;
  const checklist = extractRequirementsChecklist(service);

  const sectionsHtml = form.sections
    .map(
      (sec) => `
      <div style="margin-top: 14px;">
        <h3 style="font-size: 11pt; font-weight: 700; margin: 0 0 6px 0; padding-bottom: 3px; border-bottom: 1px solid #cbd5e1; color: #0F2942;">
          ${escapeHtml(sec.judulBagian)}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <tbody>
            ${sec.fields
              .map(
                (field) => `
              <tr>
                <td style="width: 38%; padding: 7px 8px; border: 1px solid #94a3b8; vertical-align: top; background: #f8fafc; font-weight: 600;">
                  ${escapeHtml(field.label)}
                  ${field.hint ? `<div style="font-weight: 400; font-size: 8.5pt; color: #475569; margin-top: 2px;">${escapeHtml(field.hint)}</div>` : ''}
                </td>
                <td style="width: 62%; padding: ${field.multiline ? '18px 8px' : '7px 8px'}; border: 1px solid #94a3b8; vertical-align: top; color: #64748b;">
                  &nbsp;
                </td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )
    .join('');

  const checklistHtml =
    checklist.length > 0
      ? `
      <div style="margin-top: 14px; padding: 10px 12px; border: 1px solid #94a3b8; background: #f8fafc;">
        <p style="font-size: 10pt; font-weight: 700; margin: 0 0 6px 0; color: #0F2942;">
          Kelengkapan Berkas Persyaratan (Dibawa ke Kantor Kelurahan Ampel):
        </p>
        <ul style="margin: 0; padding-left: 16px; font-size: 9.5pt; line-height: 1.5;">
          ${checklist
            .map(
              (item) =>
                `<li style="margin-bottom: 2px;">[ &nbsp; ] ${escapeHtml(item.label)}</li>`
            )
            .join('')}
        </ul>
      </div>`
      : '';

  const notesHtml =
    form.catatanPengisian && form.catatanPengisian.length > 0
      ? `
      <div style="margin-top: 10px; font-size: 9pt; color: #334155;">
        <strong>Catatan Pengisian:</strong>
        <ul style="margin: 4px 0 0 0; padding-left: 16px;">
          ${form.catatanPengisian.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
        </ul>
      </div>`
      : '';

  return `
    <div style="font-family: 'Times New Roman', Georgia, serif; color: #0f172a; line-height: 1.4;">
      <table style="width: 100%; border-collapse: collapse; border-bottom: 3px double #0f172a; margin-bottom: 12px;">
        <tr>
          <td style="padding-bottom: 8px; text-align: center;">
            <div style="font-size: 10pt; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700;">
              PEMERINTAH KABUPATEN JEMBER · KECAMATAN WULUHAN
            </div>
            <div style="font-size: 14pt; font-weight: 700; text-transform: uppercase; margin-top: 2px;">
              ${escapeHtml(kantorNama)}
            </div>
            <div style="font-size: 9pt; color: #334155; margin-top: 2px;">
              ${escapeHtml(kantorAlamat)} · ${escapeHtml(kantorKontak)}
            </div>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-bottom: 14px;">
        <div style="font-size: 9.5pt; font-weight: 700; letter-spacing: 0.06em; color: #0B6E4F;">
          KODE FORMULIR: ${escapeHtml(form.kodeForm)} · LAYANAN: ${escapeHtml(service.NAMA_LAYANAN.toUpperCase())}
        </div>
        <h2 style="font-size: 13pt; font-weight: 700; margin: 4px 0 0 0; text-transform: uppercase;">
          ${escapeHtml(form.namaForm)}
        </h2>
      </div>

      ${sectionsHtml}
      ${checklistHtml}
      ${notesHtml}

      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 10pt; text-align: center;">
        <tr>
          <td style="width: 34%; vertical-align: top; padding: 6px;">
            <div>Mengetahui,</div>
            <div><strong>Ketua RT / RW Setempat</strong></div>
            <div style="height: 56px;"></div>
            <div>( ............................................ )</div>
          </td>
          <td style="width: 32%; vertical-align: top; padding: 6px;">
            <div>Verifikasi Petugas Loket</div>
            <div><strong>Kantor Kelurahan Ampel</strong></div>
            <div style="height: 56px;"></div>
            <div>( ............................................ )</div>
          </td>
          <td style="width: 34%; vertical-align: top; padding: 6px;">
            <div>Ampel, .............................. 20....</div>
            <div><strong>Pemohon</strong></div>
            <div style="height: 56px;"></div>
            <div>( ............................................ )</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function buildWordDocumentBlob(htmlBody: string, title: string): Blob {
  const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40" lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 1.8cm; }
    body { font-family: "Times New Roman", serif; font-size: 11pt; color: #0f172a; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
  return new Blob(['\ufeff', fullHtml], { type: 'application/msword;charset=utf-8' });
}

export function triggerFormWordDownload(
  form: DownloadableServiceForm,
  service: ServiceWithForm,
  footer?: BerandaFooterInfo
): void {
  const markup = buildSingleFormPrintMarkup(form, service, footer);
  const blob = buildWordDocumentBlob(markup, form.namaForm);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugifyFileName(`${form.kodeForm}_${service.NAMA_LAYANAN}`)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function triggerAllFormsPacketDownload(
  forms: DownloadableServiceForm[],
  service: ServiceWithForm,
  footer?: BerandaFooterInfo
): void {
  const pages = forms
    .map((form, idx) => {
      const markup = buildSingleFormPrintMarkup(form, service, footer);
      return idx === 0
        ? markup
        : `<div style="page-break-before: always;">${markup}</div>`;
    })
    .join('\n');
  const blob = buildWordDocumentBlob(pages, `Paket Formulir ${service.NAMA_LAYANAN}`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `paket_formulir_${slugifyFileName(service.NAMA_LAYANAN)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
