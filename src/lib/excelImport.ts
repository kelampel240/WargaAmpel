import * as XLSX from 'xlsx';
import {
  inferTpPkkPokja,
  isValidIndonesianPhone,
  normalizeIndonesianPhone,
  OrgEntityType,
  validateOrgInput,
} from '../shared/orgLogic';
import { AdminOrgStructureResponse, OrgKelurahanLevel, SchoolJenjang } from '../shared/types';

export interface ParsedImportRow {
  rowNumber: number;
  label: string;
  detail: string;
  payload: Record<string, unknown>;
  error: string | null;
}

const ENTITY_SHEET_NAMES: Record<OrgEntityType, string[]> = {
  kelurahan: ['Kelurahan'],
  tp_pkk: ['TP PKK', 'TP PKK Kelurahan Ampel', 'PKK'],
  lpmk: ['LPMK'],
  rw: ['Daftar RW', 'RW'],
  rt: ['Daftar RT', 'RT'],
  kader: ['Data Kader', 'Kader'],
  sekolah: ['Sekolah', 'Lokasi Sekolahan'],
  guru: ['Data Guru', 'Guru'],
  balai_rw: ['Balai RW', 'Alamat Balai RW'],
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[normalizeKey(k)] = v;
  }
  return out;
}

function pickStr(normRow: Record<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const val = normRow[normalizeKey(alias)];
    if (val !== undefined && val !== null) {
      const str = String(val).trim();
      if (str && str !== '-') return str;
    }
  }
  return '';
}

function pickNum(normRow: Record<string, unknown>, aliases: string[], fallback: number): number {
  for (const alias of aliases) {
    const val = normRow[normalizeKey(alias)];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const n = Number(val);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }
  }
  return fallback;
}

function pickBool(normRow: Record<string, unknown>, aliases: string[], fallback: boolean): boolean {
  for (const alias of aliases) {
    const val = normRow[normalizeKey(alias)];
    if (val === undefined || val === null) continue;
    const raw = String(val).trim().toLowerCase();
    if (!raw) continue;
    if (['ya', 'y', 'yes', 'true', '1', 'aktif', 'publik', 'tampil'].includes(raw)) return true;
    if (['tidak', 't', 'no', 'false', '0', 'nonaktif', 'sembunyi', 'hidden'].includes(raw)) return false;
  }
  return fallback;
}

function pickTingkat(raw: string): OrgKelurahanLevel {
  const upper = raw.trim().toUpperCase();
  if (upper.includes('LURAH')) return 'LURAH';
  if (upper.includes('KASI') || upper.includes('SEKSI')) return 'KASI';
  return 'STAF';
}

function pickJenjang(raw: string): SchoolJenjang {
  const upper = raw.trim().toUpperCase();
  if (upper.includes('PAUD') || upper.includes('TK') || upper.includes('KB')) return 'PAUD / TK';
  if (upper.includes('SMP') || upper.includes('MTS')) return 'SMP / MTs';
  if (upper.includes('SMA') || upper.includes('SMK') || upper.includes('MA')) return 'SMA / SMK';
  if (upper.includes('TPQ') || upper.includes('MADIN') || upper.includes('PONDOK')) return 'TPQ / Madrasah';
  return 'SD / MI';
}

function normalizeWilayahNum(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, '').replace(/^rw0*/, 'rw').replace(/^rt0*/, 'rt');
}

function readTargetSheetRows(
  buffer: ArrayBuffer | Uint8Array,
  preferredNames: string[]
): Array<Record<string, unknown>> {
  const wb = XLSX.read(buffer, { type: 'array' });
  if (!wb.SheetNames.length) return [];

  const lowerMap = new Map(wb.SheetNames.map((n) => [n.toLowerCase().trim(), n]));
  let selectedName = wb.SheetNames[0];
  for (const cand of preferredNames) {
    const match = lowerMap.get(cand.toLowerCase().trim());
    if (match) {
      selectedName = match;
      break;
    }
  }

  const ws = wb.Sheets[selectedName];
  if (!ws) return [];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return rawRows.filter((r) => {
    const values = Object.values(r).map((v) => String(v ?? '').trim());
    if (values.every((v) => v === '')) return false;
    if (values.length === 1 && values[0] === 'Belum ada data tersedia.') return false;
    return true;
  });
}

export function parseOrgImportExcel(
  buffer: ArrayBuffer | Uint8Array,
  entity: OrgEntityType,
  orgData: Pick<AdminOrgStructureResponse, 'rw' | 'rt'> & {
    sekolah?: AdminOrgStructureResponse['sekolah'];
  }
): ParsedImportRow[] {
  const rows = readTargetSheetRows(buffer, ENTITY_SHEET_NAMES[entity]);
  const dbRef = {
    ORG_RW: orgData.rw,
    ORG_RT: orgData.rt,
    ORG_SEKOLAH: orgData.sekolah || [],
  };

  return rows.map((raw, idx) => {
    const n = normalizeRowKeys(raw);
    const rowNumber = idx + 2; // Excel row 1 is header

    const nama = pickStr(n, [
      'Nama',
      'Nama Lengkap',
      'Nama Ketua',
      'Nama Kader',
      'Nama Guru',
      'Nama Sekolah',
      'Nama Balai RW',
      'NAMA',
      'NAMA_KETUA',
      'NAMA_SEKOLAH',
      'NAMA_BALAI',
    ]);
    const jabatan = pickStr(n, [
      'Jabatan',
      'Jabatan / Peran',
      'Mata Pelajaran / Jabatan',
      'Mata Pelajaran',
      'Peran',
      'JABATAN',
    ]);
    const noHpRaw = pickStr(n, [
      'No. HP',
      'Nomor HP',
      'No HP',
      'No.HP',
      'HP',
      'Telepon',
      'No. Telepon',
      'No Telepon',
      'Telp',
      'No. Telp',
      'No Telp',
      'WhatsApp',
      'No. WhatsApp',
      'No. WA',
      'No WA',
      'WA',
      'Kontak',
      'No. Kontak',
      'Handphone',
      'NO_HP',
    ]);
    const noHp = normalizeIndonesianPhone(noHpRaw);
    const urutan = pickNum(n, ['Urutan', 'Urut', 'URUTAN'], idx + 1);
    const tampilkanHp = pickBool(n, ['Tampilkan HP Publik', 'Tampilkan HP', 'TAMPILKAN_HP'], false);
    const tampilkanPublik = pickBool(n, ['Tampil Publik', 'Tampilkan Publik', 'TAMPILKAN_PUBLIK'], true);
    const aktif = pickBool(n, ['Status', 'Aktif', 'AKTIF'], true);
    const fotoUrl = pickStr(n, ['URL Foto', 'Foto URL', 'FOTO_URL']);

    let payload: Record<string, unknown> = {
      nama,
      namaKetua: nama,
      jabatan,
      noHp,
      fotoUrl,
      tampilkanHp,
      tampilkanPublik,
      aktif,
      urutan,
    };

    let detail = jabatan;
    let extraError: string | null = null;
    let displayLabel = nama;

    if (entity === 'kelurahan') {
      const tingkat = pickTingkat(pickStr(n, ['Tingkat', 'TINGKAT']));
      const wilayahTugas = pickStr(n, ['Wilayah Tugas', 'Wilayah', 'WILAYAH_TUGAS']);
      payload = { ...payload, tingkat, wilayahTugas };
      detail = `${tingkat} · ${jabatan}`;
    } else if (entity === 'tp_pkk') {
      const pokjaRaw = pickStr(n, ['Unsur / Pokja', 'Unsur', 'Pokja', 'POKJA']);
      const pokja = inferTpPkkPokja(jabatan, pokjaRaw);
      const bidang = pickStr(n, ['Bidang', 'Bidang / Tugas', 'BIDANG']);
      payload = { ...payload, pokja, bidang };
      detail = pokja ? `${pokja} · ${jabatan}` : jabatan;
    } else if (entity === 'lpmk') {
      const bidang = pickStr(n, ['Bidang', 'Bidang / Seksi', 'BIDANG']);
      payload = { ...payload, bidang };
      detail = bidang ? `${jabatan} (${bidang})` : jabatan;
    } else if (entity === 'rw') {
      const nomorRw = pickStr(n, ['Nomor RW', 'RW', 'No RW', 'No. RW', 'NOMOR_RW']);
      const wilayahTugas =
        pickStr(n, ['Wilayah Tugas', 'Wilayah', 'Dusun', 'Alamat', 'WILAYAH_TUGAS']) ||
        (nomorRw ? `Wilayah ${nomorRw}` : '');
      const rwJabatan = jabatan || (nomorRw ? `Ketua ${nomorRw}` : 'Ketua RW');
      payload = { ...payload, nomorRw, wilayahTugas, jabatan: rwJabatan };
      detail = `${nomorRw || '?'} · ${wilayahTugas || '-'}`;
    } else if (entity === 'rt') {
      const nomorRt = pickStr(n, ['Nomor RT', 'RT', 'No RT', 'No. RT', 'NOMOR_RT']);
      const rwInput = pickStr(n, ['Nomor RW', 'RW', 'No RW', 'No. RW', 'ID_RW', 'Induk RW']);
      const wilayahTugas = pickStr(n, ['Wilayah Tugas', 'Wilayah', 'Alamat', 'WILAYAH_TUGAS']);

      const rwMatch = orgData.rw.find(
        (r) =>
          r.ID_RW === rwInput ||
          r.NOMOR_RW.toLowerCase() === rwInput.toLowerCase() ||
          normalizeWilayahNum(r.NOMOR_RW) === normalizeWilayahNum(rwInput.startsWith('rw') || /^\d+$/.test(rwInput) ? (/^\d+$/.test(rwInput) ? `RW ${rwInput}` : rwInput) : rwInput)
      );

      if (!rwMatch) {
        extraError = rwInput
          ? `RW "${rwInput}" belum terdaftar di Daftar RW.`
          : 'Kolom Nomor RW wajib diisi.';
      }

      const rtJabatan = jabatan || (nomorRt ? `Ketua ${nomorRt}` : 'Ketua RT');
      payload = {
        ...payload,
        idRw: rwMatch?.ID_RW || '',
        nomorRt,
        wilayahTugas,
        jabatan: rtJabatan,
      };
      detail = `${rwMatch?.NOMOR_RW || rwInput || '?'} / ${nomorRt || '?'}`;
    } else if (entity === 'kader') {
      const rtInput = pickStr(n, ['RT', 'Nomor RT', 'ID_RT', 'Wilayah RT']);
      const rwInput = pickStr(n, ['RW', 'Nomor RW', 'ID_RW']);

      const matchingRts = orgData.rt.filter((t) => {
        if (t.ID_RT === rtInput) return true;
        const parentRw = orgData.rw.find((r) => r.ID_RW === t.ID_RW);
        const normInputRt = normalizeWilayahNum(/^\d+$/.test(rtInput) ? `RT ${rtInput}` : rtInput);
        const rtMatch = normalizeWilayahNum(t.NOMOR_RT) === normInputRt;
        if (!rtMatch) return false;
        if (!rwInput) return true;
        const normInputRw = normalizeWilayahNum(/^\d+$/.test(rwInput) ? `RW ${rwInput}` : rwInput);
        return parentRw ? normalizeWilayahNum(parentRw.NOMOR_RW) === normInputRw : false;
      });

      let resolvedRt: (typeof orgData.rt)[number] | undefined = matchingRts[0];
      if (!rtInput) {
        extraError = 'Kolom RT wajib diisi.';
      } else if (matchingRts.length === 0) {
        extraError = `RT "${rtInput}"${rwInput ? ` (${rwInput})` : ''} tidak ditemukan di Daftar RT.`;
      } else if (matchingRts.length > 1 && !rwInput) {
        extraError = `Terdapat beberapa "${rtInput}" di RW berbeda. Tambahkan kolom RW agar jelas.`;
        resolvedRt = undefined;
      }

      payload = {
        ...payload,
        idRt: resolvedRt?.ID_RT || '',
      };
      const parentRw = resolvedRt ? orgData.rw.find((r) => r.ID_RW === resolvedRt.ID_RW) : undefined;
      detail = resolvedRt
        ? `${parentRw?.NOMOR_RW || ''} / ${resolvedRt.NOMOR_RT} · ${jabatan}`
        : `${rwInput ? rwInput + ' / ' : ''}${rtInput || '?'} · ${jabatan}`;
    } else if (entity === 'sekolah') {
      const namaSekolah = pickStr(n, ['Nama Sekolah', 'Sekolah', 'Nama', 'NAMA_SEKOLAH']);
      const jenjang = pickJenjang(pickStr(n, ['Jenjang', 'Tingkat', 'JENJANG']));
      const kepalaSekolah = pickStr(n, ['Kepala Sekolah', 'Kepsek', 'KEPALA_SEKOLAH']);
      const alamat = pickStr(n, ['Alamat Lokasi', 'Alamat', 'Lokasi', 'ALAMAT']);
      const mapsUrl = pickStr(n, ['Tautan Google Maps', 'Google Maps', 'Maps URL', 'MAPS_URL']);

      displayLabel = namaSekolah;
      payload = {
        ...payload,
        namaSekolah,
        nama: namaSekolah,
        jenjang,
        kepalaSekolah,
        alamat,
        mapsUrl,
      };
      detail = `${jenjang} · ${alamat || '-'}`;
    } else if (entity === 'guru') {
      const sekolahInput = pickStr(n, ['Nama Sekolah', 'Sekolah', 'ID_SEKOLAH']);
      const schoolList = orgData.sekolah || [];
      const schoolMatch = schoolList.find(
        (s) =>
          s.ID_SEKOLAH === sekolahInput ||
          s.NAMA_SEKOLAH.trim().toLowerCase() === sekolahInput.trim().toLowerCase()
      );
      if (!sekolahInput) {
        extraError = 'Kolom Nama Sekolah wajib diisi.';
      } else if (!schoolMatch) {
        extraError = `Sekolah "${sekolahInput}" belum terdaftar di Daftar Sekolah.`;
      }
      payload = {
        ...payload,
        idSekolah: schoolMatch?.ID_SEKOLAH || '',
      };
      detail = `${schoolMatch?.NAMA_SEKOLAH || sekolahInput || '?'} · ${jabatan}`;
    } else if (entity === 'balai_rw') {
      const namaBalai = pickStr(n, ['Nama Balai RW', 'Nama Balai', 'Nama', 'NAMA_BALAI']);
      const rwInput = pickStr(n, ['RW', 'Nomor RW', 'ID_RW']);
      const alamat = pickStr(n, ['Alamat Balai RW', 'Alamat', 'Lokasi', 'ALAMAT']);
      const jamLayanan = pickStr(n, ['Jam Layanan / Fasilitas', 'Jam Layanan', 'JAM_LAYANAN']);
      const mapsUrl = pickStr(n, ['Tautan Google Maps', 'Google Maps', 'Maps URL', 'MAPS_URL']);

      const rwMatch = orgData.rw.find(
        (r) =>
          r.ID_RW === rwInput ||
          r.NOMOR_RW.toLowerCase() === rwInput.toLowerCase() ||
          normalizeWilayahNum(r.NOMOR_RW) === normalizeWilayahNum(/^\d+$/.test(rwInput) ? `RW ${rwInput}` : rwInput)
      );

      if (!rwMatch) {
        extraError = rwInput
          ? `RW "${rwInput}" belum terdaftar di Daftar RW.`
          : 'Kolom RW wajib diisi.';
      }

      displayLabel = namaBalai;
      payload = {
        ...payload,
        idRw: rwMatch?.ID_RW || '',
        namaBalai,
        nama: namaBalai,
        alamat,
        jamLayanan,
        mapsUrl,
      };
      detail = `${rwMatch?.NOMOR_RW || rwInput || '?'} · ${alamat || '-'}`;
    }

    const validationError = extraError || validateOrgInput(entity, payload, dbRef);

    return {
      rowNumber,
      label: displayLabel || `(Baris ${rowNumber})`,
      detail,
      payload,
      error: validationError,
    };
  });
}

export function parsePetugasImportExcel(buffer: ArrayBuffer | Uint8Array): ParsedImportRow[] {
  const rows = readTargetSheetRows(buffer, ['Data Petugas', 'Petugas']);
  return rows.map((raw, idx) => {
    const n = normalizeRowKeys(raw);
    const rowNumber = idx + 2;
    const namaPetugas = pickStr(n, ['Nama Petugas', 'Nama', 'Nama Lengkap', 'NAMA_PETUGAS']);
    const jabatan = pickStr(n, ['Jabatan', 'JABATAN']);
    const bidangTugas = pickStr(n, ['Bidang Tugas', 'Bidang', 'BIDANG_TUGAS']);
    const noHpRaw = pickStr(n, [
      'No. HP',
      'Nomor HP',
      'No HP',
      'HP',
      'Telepon',
      'Telp',
      'No. WA',
      'WhatsApp',
      'NO_HP',
    ]);
    const noHp = normalizeIndonesianPhone(noHpRaw);

    let error: string | null = null;
    if (namaPetugas.length < 2) error = 'Nama Petugas wajib diisi minimal 2 karakter.';
    else if (jabatan.length < 2) error = 'Jabatan wajib diisi minimal 2 karakter.';
    else if (noHp && !isValidIndonesianPhone(noHp)) error = 'Format No. HP tidak valid.';

    return {
      rowNumber,
      label: namaPetugas || `(Baris ${rowNumber})`,
      detail: bidangTugas ? `${jabatan} · ${bidangTugas}` : jabatan,
      payload: {
        namaPetugas,
        jabatan,
        bidangTugas,
        noHp,
      },
      error,
    };
  });
}
