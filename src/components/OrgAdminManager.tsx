import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Building,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  GraduationCap,
  HeartHandshake,
  History,
  Home,
  Landmark,
  MapPin,
  Plus,
  School,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { inferTpPkkPokja, isValidIndonesianPhone, OrgEntityType } from '../shared/orgLogic';
import {
  AdminOrgStructureResponse,
  OrgKelurahanLevel,
  PublicOrgStructureResponse,
  SchoolJenjang,
  SheetLogAktivitas,
  TP_PKK_JABATAN_OPTIONS,
  UserRole,
} from '../shared/types';
import { apiFetch, readFileAsBase64 } from '../lib/api';
import {
  downloadOrgEntityTemplate,
  exportOrgEntityToExcel,
} from '../lib/excelExport';
import { ParsedImportRow, parseOrgImportExcel } from '../lib/excelImport';
import { ExcelImportModal } from './ExcelImportModal';
import {
  createOrgItem,
  deleteOrgItem,
  fetchAdminOrgStructure,
  importOrgItemsBatch,
  saveOrgDisplaySettings,
  updateOrgItem,
} from '../lib/orgService';

type AdminOrgTab =
  | 'kelurahan'
  | 'tp_pkk'
  | 'lpmk'
  | 'rw'
  | 'rt'
  | 'kader'
  | 'sekolah'
  | 'guru'
  | 'balai_rw'
  | 'pengaturan'
  | 'log';

interface FormState {
  id?: string;
  nama: string;
  jabatan: string;
  tingkat: OrgKelurahanLevel;
  pokja: string;
  bidang: string;
  wilayahTugas: string;
  nomorRw: string;
  nomorRt: string;
  idRw: string;
  idRt: string;
  idSekolah: string;
  jenjang: SchoolJenjang;
  kepalaSekolah: string;
  alamat: string;
  jamLayanan: string;
  mapsUrl: string;
  fotoUrl: string;
  noHp: string;
  tampilkanHp: boolean;
  tampilkanPublik: boolean;
  aktif: boolean;
  urutan: number;
}

const emptyForm = (): FormState => ({
  nama: '',
  jabatan: '',
  tingkat: 'STAF',
  pokja: '',
  bidang: '',
  wilayahTugas: '',
  nomorRw: '',
  nomorRt: '',
  idRw: '',
  idRt: '',
  idSekolah: '',
  jenjang: 'SD / MI',
  kepalaSekolah: '',
  alamat: '',
  jamLayanan: '',
  mapsUrl: '',
  fotoUrl: '',
  noHp: '',
  tampilkanHp: false, // Default wajib disembunyikan (Tahap 3 & 4)
  tampilkanPublik: true,
  aktif: true,
  urutan: 1,
});

interface OrgAdminManagerProps {
  userRole?: UserRole;
  onOrgChanged?: () => void;
}

export const OrgAdminManager: React.FC<OrgAdminManagerProps> = ({ userRole, onOrgChanged }) => {
  const canEdit = !userRole || userRole === 'SUPER_ADMIN' || userRole === 'OPERATOR';
  const [data, setData] = useState<AdminOrgStructureResponse | null>(null);
  const [logs, setLogs] = useState<SheetLogAktivitas[]>([]);
  const [activeTab, setActiveTab] = useState<AdminOrgTab>('kelurahan');
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Modal Form state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalEntity, setModalEntity] = useState<OrgEntityType>('kelurahan');
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  // Confirm Delete Modal state (no window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{
    entity: OrgEntityType;
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Excel Import Modal state
  const [importEntity, setImportEntity] = useState<OrgEntityType | null>(null);

  // Display Settings state
  const [displayDraft, setDisplayDraft] = useState<
    PublicOrgStructureResponse['displaySettings']
  >({
    pengumumanBeranda: '',
    urutanBagian: ['KELURAHAN', 'TP_PKK', 'LPMK_RW_RT', 'KADER', 'SEKOLAH_GURU', 'BALAI_RW'],
    tampilkanBagian: {
      kelurahan: true,
      tpPkk: true,
      lpmk: true,
      rwRt: true,
      kader: true,
      sekolahGuru: true,
      balaiRw: true,
    },
  });

  const loadAll = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const canViewLogs =
        !userRole || userRole === 'SUPER_ADMIN' || userRole === 'OPERATOR' || userRole === 'KEPALA_DESA';
      const [orgRes, logsRes] = await Promise.all([
        fetchAdminOrgStructure(),
        canViewLogs
          ? apiFetch<{ logs: SheetLogAktivitas[] }>('/api/admin/logs').catch(() => ({ logs: [] }))
          : Promise.resolve({ logs: [] }),
      ]);
      setData(orgRes);
      if (orgRes?.displaySettings) {
        setDisplayDraft((prev) => ({
          ...prev,
          ...orgRes.displaySettings,
          urutanBagian: Array.isArray(orgRes.displaySettings.urutanBagian)
            ? orgRes.displaySettings.urutanBagian
            : prev.urutanBagian,
        }));
      }
      setLogs((Array.isArray(logsRes?.logs) ? logsRes.logs : []).filter((l) => String(l.AKSI || '').startsWith('ORG_')));
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openCreateModal = (entity: OrgEntityType) => {
    const base = emptyForm();
    if ((entity === 'rt' || entity === 'balai_rw') && data?.rw.length) {
      base.idRw = data.rw[0].ID_RW;
    }
    if (entity === 'kader' && data?.rt.length) {
      base.idRt = data.rt[0].ID_RT;
    }
    if (entity === 'guru' && data?.sekolah.length) {
      base.idSekolah = data.sekolah[0].ID_SEKOLAH;
    }
    if (entity === 'kelurahan' && data) {
      base.urutan = data.kelurahan.length + 1;
    } else if (entity === 'tp_pkk' && data) {
      base.jabatan = 'Pembina PKK';
      base.pokja = 'Pembina';
      base.urutan = (data.tpPkk || []).length + 1;
    } else if (entity === 'lpmk' && data) {
      base.urutan = data.lpmk.length + 1;
    } else if (entity === 'rw' && data) {
      base.urutan = data.rw.length + 1;
    } else if (entity === 'rt' && data) {
      base.urutan = data.rt.length + 1;
    } else if (entity === 'kader' && data) {
      base.urutan = data.kader.length + 1;
    } else if (entity === 'sekolah' && data) {
      base.urutan = data.sekolah.length + 1;
    } else if (entity === 'guru' && data) {
      base.urutan = data.guru.length + 1;
    } else if (entity === 'balai_rw' && data) {
      base.urutan = data.balaiRw.length + 1;
    }
    setModalEntity(entity);
    setForm(base);
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (entity: OrgEntityType, item: Record<string, unknown>) => {
    setModalEntity(entity);
    setErrorMsg('');
    if (entity === 'kelurahan') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_KELURAHAN),
        nama: String(item.NAMA || ''),
        jabatan: String(item.JABATAN || ''),
        tingkat: (item.TINGKAT as OrgKelurahanLevel) || 'STAF',
        wilayahTugas: String(item.WILAYAH_TUGAS || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'tp_pkk') {
      const jabatanStr = String(item.JABATAN || '');
      setForm({
        ...emptyForm(),
        id: String(item.ID_PKK),
        nama: String(item.NAMA || ''),
        jabatan: jabatanStr,
        pokja: inferTpPkkPokja(jabatanStr, String(item.POKJA || '')),
        bidang: String(item.BIDANG || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'lpmk') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_LPMK),
        nama: String(item.NAMA || ''),
        jabatan: String(item.JABATAN || ''),
        bidang: String(item.BIDANG || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'rw') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_RW),
        nama: String(item.NAMA_KETUA || ''),
        nomorRw: String(item.NOMOR_RW || ''),
        jabatan: String(item.JABATAN || ''),
        wilayahTugas: String(item.WILAYAH_TUGAS || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'rt') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_RT),
        idRw: String(item.ID_RW || ''),
        nomorRt: String(item.NOMOR_RT || ''),
        nama: String(item.NAMA_KETUA || ''),
        jabatan: String(item.JABATAN || ''),
        wilayahTugas: String(item.WILAYAH_TUGAS || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'kader') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_KADER),
        idRt: String(item.ID_RT || ''),
        nama: String(item.NAMA || ''),
        jabatan: String(item.JABATAN || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'sekolah') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_SEKOLAH),
        nama: String(item.NAMA_SEKOLAH || ''),
        jenjang: (item.JENJANG as SchoolJenjang) || 'SD / MI',
        kepalaSekolah: String(item.KEPALA_SEKOLAH || ''),
        alamat: String(item.ALAMAT || ''),
        mapsUrl: String(item.MAPS_URL || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'guru') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_GURU),
        idSekolah: String(item.ID_SEKOLAH || ''),
        nama: String(item.NAMA || ''),
        jabatan: String(item.JABATAN || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    } else if (entity === 'balai_rw') {
      setForm({
        ...emptyForm(),
        id: String(item.ID_BALAI),
        idRw: String(item.ID_RW || ''),
        nama: String(item.NAMA_BALAI || ''),
        alamat: String(item.ALAMAT || ''),
        jamLayanan: String(item.JAM_LAYANAN || ''),
        mapsUrl: String(item.MAPS_URL || ''),
        fotoUrl: String(item.FOTO_URL || ''),
        noHp: String(item.NO_HP || ''),
        tampilkanHp: Boolean(item.TAMPILKAN_HP),
        tampilkanPublik: item.TAMPILKAN_PUBLIK !== false,
        aktif: item.AKTIF !== false,
        urutan: Number(item.URUTAN) || 1,
      });
    }
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('File foto harus berupa gambar JPG atau PNG.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg('Ukuran foto maksimal 1.5 MB agar tersimpan cepat.');
      return;
    }
    const read = await readFileAsBase64(file);
    setForm((prev) => ({ ...prev, fotoUrl: read.base64 }));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (form.nama.trim().length < 2) {
      setErrorMsg(
        modalEntity === 'sekolah'
          ? 'Nama sekolah wajib diisi (minimal 2 karakter).'
          : modalEntity === 'balai_rw'
          ? 'Nama Balai RW wajib diisi (minimal 2 karakter).'
          : 'Nama wajib diisi (minimal 2 karakter).'
      );
      return;
    }
    if (modalEntity !== 'sekolah' && modalEntity !== 'balai_rw' && form.jabatan.trim().length < 2) {
      setErrorMsg(
        modalEntity === 'guru'
          ? 'Mata pelajaran atau jabatan mengajar wajib diisi (minimal 2 karakter).'
          : 'Jabatan wajib diisi (minimal 2 karakter).'
      );
      return;
    }
    if ((modalEntity === 'sekolah' || modalEntity === 'balai_rw') && form.alamat.trim().length < 5) {
      setErrorMsg('Alamat lokasi wajib diisi minimal 5 karakter.');
      return;
    }
    if (form.noHp.trim() && !isValidIndonesianPhone(form.noHp)) {
      setErrorMsg('Format nomor HP Indonesia tidak valid (contoh: 081234567890).');
      return;
    }
    if (modalEntity === 'rt' && !form.idRw) {
      setErrorMsg('RT wajib terhubung ke salah satu RW.');
      return;
    }
    if (modalEntity === 'kader' && !form.idRt) {
      setErrorMsg('Kader wajib terhubung ke salah satu RT.');
      return;
    }
    if (modalEntity === 'guru' && !form.idSekolah) {
      setErrorMsg('Guru wajib terhubung ke salah satu sekolah.');
      return;
    }
    if (modalEntity === 'balai_rw' && !form.idRw) {
      setErrorMsg('Balai RW wajib terhubung ke salah satu RW.');
      return;
    }

    const payload: Record<string, unknown> = {
      nama: form.nama.trim(),
      namaKetua: form.nama.trim(),
      namaSekolah: form.nama.trim(),
      namaBalai: form.nama.trim(),
      jabatan: form.jabatan.trim(),
      tingkat: form.tingkat,
      pokja: modalEntity === 'tp_pkk' ? inferTpPkkPokja(form.jabatan, form.pokja) : form.pokja.trim(),
      bidang: form.bidang.trim(),
      wilayahTugas: form.wilayahTugas.trim(),
      nomorRw: form.nomorRw.trim(),
      nomorRt: form.nomorRt.trim(),
      idRw: form.idRw,
      idRt: form.idRt,
      idSekolah: form.idSekolah,
      jenjang: form.jenjang,
      kepalaSekolah: form.kepalaSekolah.trim(),
      alamat: form.alamat.trim(),
      jamLayanan: form.jamLayanan.trim(),
      mapsUrl: form.mapsUrl.trim(),
      fotoUrl: form.fotoUrl.trim(),
      noHp: form.noHp.trim(),
      tampilkanHp: form.tampilkanHp,
      tampilkanPublik: form.tampilkanPublik,
      aktif: form.aktif,
      urutan: Number(form.urutan) || 1,
    };

    setSaving(true);
    try {
      const entityLabel = modalEntity.replace('_', ' ').toUpperCase();
      if (form.id) {
        await updateOrgItem(modalEntity, form.id, payload);
        setFeedback(`Data ${entityLabel} "${form.nama}" berhasil diperbarui.`);
      } else {
        await createOrgItem(modalEntity, payload);
        setFeedback(`Data ${entityLabel} "${form.nama}" berhasil ditambahkan.`);
      }
      setModalOpen(false);
      await loadAll();
      onOrgChanged?.();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      await deleteOrgItem(deleteTarget.entity, deleteTarget.id);
      setFeedback(`Data "${deleteTarget.label}" berhasil dihapus.`);
      setDeleteTarget(null);
      await loadAll();
      onOrgChanged?.();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmOrgImport = async (entity: OrgEntityType, validRows: ParsedImportRow[]) => {
    const res = await importOrgItemsBatch(
      entity,
      validRows.map((row) => row.payload)
    );
    setImportEntity(null);
    setFeedback(`${res.count || validRows.length} data ${entity.toUpperCase()} berhasil diimpor dari Excel.`);
    await loadAll();
    onOrgChanged?.();
  };

  const renderEntityActionButtons = (
    entity: OrgEntityType,
    addLabel: string,
    entityLabel: string
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => data && exportOrgEntityToExcel(entity, data)}
        disabled={loading || !data}
        title={`Export Excel (${entityLabel})`}
        aria-label={`Export Excel ${entityLabel}`}
        className="p-2 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-xl hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
      >
        <Download className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          if (!canEdit) {
            setErrorMsg(`Akun Anda (${userRole}) hanya memiliki akses lihat. Login sebagai Super Admin atau Operator untuk mengimpor data.`);
            return;
          }
          setImportEntity(entity);
        }}
        disabled={loading || !data}
        title={`Import Excel (${entityLabel})`}
        aria-label={`Import Excel ${entityLabel}`}
        className="p-2 border border-sky-300 bg-sky-50 text-sky-900 rounded-xl hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
      >
        <Upload className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => openCreateModal(entity)}
        className="px-4 py-2 bg-[#0F2942] text-amber-300 border border-[#D4AF37] text-sm font-bold rounded-xl flex items-center gap-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>{addLabel}</span>
      </button>
    </div>
  );

  const moveSectionOrder = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= displayDraft.urutanBagian.length) return;
    const copy = [...displayDraft.urutanBagian];
    const tmp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = tmp;
    setDisplayDraft((prev) => ({ ...prev, urutanBagian: copy }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    setErrorMsg('');
    try {
      await saveOrgDisplaySettings(displayDraft);
      setFeedback('Pengaturan tampilan & pengumuman Struktur Organisasi berhasil disimpan.');
      await loadAll();
      onOrgChanged?.();
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const rwNameById = (idRw: string) =>
    data?.rw.find((r) => r.ID_RW === idRw)?.NOMOR_RW || idRw;

  const rtLabelById = (idRt: string) => {
    const rt = data?.rt.find((t) => t.ID_RT === idRt);
    if (!rt) return idRt;
    return `${rwNameById(rt.ID_RW)} / ${rt.NOMOR_RT}`;
  };

  const sekolahNameById = (idSekolah: string) =>
    data?.sekolah.find((s) => s.ID_SEKOLAH === idSekolah)?.NAMA_SEKOLAH || idSekolah;

  const kpiCards = data
    ? [
        { label: 'Lurah', value: data.summary.totalLurah },
        { label: 'Kasi', value: data.summary.totalKasi },
        { label: 'Staf Kelurahan', value: data.summary.totalStaf },
        { label: 'TP PKK Ampel', value: data.summary.totalTpPkk ?? (data.tpPkk || []).length },
        { label: 'Pengurus LPMK', value: data.summary.totalLpmk },
        { label: 'Daftar RW', value: data.summary.totalRw },
        { label: 'Daftar RT', value: data.summary.totalRt },
        { label: 'Data Kader', value: data.summary.totalKader },
        { label: 'Sekolah', value: data.summary.totalSekolah },
        { label: 'Data Guru', value: data.summary.totalGuru },
        { label: 'Balai RW', value: data.summary.totalBalaiRw },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0F2942] text-white rounded-2xl border-2 border-[#D4AF37] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Super Admin · Terlindungi Login
          </span>
          <h2 className="font-display text-2xl font-extrabold mt-1">
            Kelola Struktur Organisasi Warga Ampel
          </h2>
          <p className="text-sm text-slate-200 mt-1">
            Setiap perubahan langsung tampil di Beranda Publik dan tercatat otomatis di Activity Logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold bg-white/10 border border-[#D4AF37]/50 px-3.5 py-2 rounded-xl text-amber-200">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Privasi HP Default: Disembunyikan</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <section aria-label="Ringkasan Jumlah Data Organisasi & Fasilitas">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpiCards.map((c) => (
              <div
                key={c.label}
                className="bg-white border border-slate-200 rounded-xl p-4 text-center"
              >
                <p className="text-xs font-semibold text-slate-600">{c.label}</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-[#0F2942] tabular-nums">
                  {c.value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {!canEdit && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-sm font-semibold text-amber-950">
          Mode Lihat Saja ({userRole}): Anda dapat melihat dan mengekspor data, sedangkan Tambah, Ubah, Hapus, dan Import Excel hanya tersedia untuk Super Admin atau Operator.
        </div>
      )}

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-sm font-semibold text-emerald-950 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && !modalOpen && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-sm font-semibold text-rose-900">
          {errorMsg}
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5">
        {(
          [
            { id: 'kelurahan', label: 'Kelurahan', Icon: Landmark },
            { id: 'tp_pkk', label: 'TP PKK Ampel', Icon: Award },
            { id: 'lpmk', label: 'LPMK', Icon: Building2 },
            { id: 'rw', label: 'Daftar RW', Icon: Users },
            { id: 'rt', label: 'Daftar RT', Icon: Home },
            { id: 'kader', label: 'Data Kader', Icon: HeartHandshake },
            { id: 'sekolah', label: 'Sekolah', Icon: School },
            { id: 'guru', label: 'Data Guru', Icon: GraduationCap },
            { id: 'balai_rw', label: 'Balai RW', Icon: Building },
            { id: 'pengaturan', label: 'Pengaturan Tampilan', Icon: Settings },
            { id: 'log', label: 'Log Aktivitas', Icon: History },
          ] as Array<{
            id: AdminOrgTab;
            label: string;
            Icon: React.ComponentType<{ className?: string }>;
          }>
        ).map((tab) => {
          const Icon = tab.Icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                active
                  ? 'bg-[#0F2942] text-amber-300'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-600">
          Memuat data struktur organisasi...
        </div>
      ) : (
        <>
          {/* KELURAHAN TAB */}
          {activeTab === 'kelurahan' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">
                    Pemerintahan Kelurahan (Lurah, Kasi &amp; Staf)
                  </h3>
                  <p className="text-sm text-slate-600">
                    Disusun hierarkis pada Beranda Publik berdasarkan Tingkat &amp; Urutan.
                  </p>
                </div>
                {renderEntityActionButtons('kelurahan', 'Tambah Personel Kelurahan', 'Kelurahan')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Urut</th>
                      <th className="py-3 px-3">Nama &amp; Wilayah</th>
                      <th className="py-3 px-3">Tingkat &amp; Jabatan</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.kelurahan.map((k) => (
                      <tr key={k.ID_KELURAHAN} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold">{k.URUTAN}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-[#0F2942]">{k.NAMA}</p>
                          <p className="text-xs text-slate-600">{k.WILAYAH_TUGAS || '-'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#0F2942] text-amber-300 text-xs font-bold mr-1.5">
                            {k.TINGKAT}
                          </span>
                          <span className="text-slate-800">{k.JABATAN}</span>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{k.NO_HP || '-'}</p>
                          <p className={k.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {k.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <span className={`font-bold ${k.AKTIF && k.TAMPILKAN_PUBLIK ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {k.AKTIF ? (k.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Aktif · Tersembunyi') : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('kelurahan', k as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${k.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ entity: 'kelurahan', id: k.ID_KELURAHAN, label: k.NAMA })
                            }
                            aria-label={`Hapus ${k.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TP PKK KELURAHAN AMPEL TAB */}
          {activeTab === 'tp_pkk' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">
                    TP PKK Kelurahan Ampel (Pembina, Pengurus Inti &amp; POKJA I–IV)
                  </h3>
                  <p className="text-sm text-slate-600">
                    Berkedudukan sejajar Pemerintah Kelurahan dan bersifat independen (tidak mengikat pada pihak mana pun).
                  </p>
                </div>
                {renderEntityActionButtons('tp_pkk', 'Tambah Pengurus TP PKK', 'TP PKK')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Urut</th>
                      <th className="py-3 px-3">Nama &amp; Bidang</th>
                      <th className="py-3 px-3">Unsur / Pokja &amp; Jabatan</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {(data.tpPkk || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Belum ada data TP PKK Kelurahan Ampel. Klik &ldquo;Tambah Pengurus TP PKK&rdquo; atau Import Excel untuk mengisi data.
                        </td>
                      </tr>
                    ) : (
                      (data.tpPkk || []).map((p) => (
                        <tr key={p.ID_PKK} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-mono font-bold">{p.URUTAN}</td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-[#0F2942]">{p.NAMA}</p>
                            <p className="text-xs text-slate-600">{p.BIDANG || '-'}</p>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-900 border border-rose-200 text-xs font-bold mr-1.5">
                              {inferTpPkkPokja(p.JABATAN, p.POKJA)}
                            </span>
                            <span className="text-slate-800 font-medium">{p.JABATAN}</span>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <p className="font-mono">{p.NO_HP || '-'}</p>
                            <p className={p.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                              {p.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-xs">
                            <span className={`font-bold ${p.AKTIF && p.TAMPILKAN_PUBLIK ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {p.AKTIF ? (p.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Aktif · Tersembunyi') : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => openEditModal('tp_pkk', p as unknown as Record<string, unknown>)}
                              aria-label={`Ubah ${p.NAMA}`}
                              className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ entity: 'tp_pkk', id: p.ID_PKK, label: p.NAMA })}
                              aria-label={`Hapus ${p.NAMA}`}
                              className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LPMK TAB */}
          {activeTab === 'lpmk' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">Pengurus LPMK</h3>
                  <p className="text-sm text-slate-600">
                    Lembaga kemasyarakatan independen mitra kelurahan (bukan atasan RW/RT).
                  </p>
                </div>
                {renderEntityActionButtons('lpmk', 'Tambah Pengurus LPMK', 'LPMK')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Urut</th>
                      <th className="py-3 px-3">Nama &amp; Bidang</th>
                      <th className="py-3 px-3">Jabatan</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.lpmk.map((l) => (
                      <tr key={l.ID_LPMK} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono font-bold">{l.URUTAN}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-[#0F2942]">{l.NAMA}</p>
                          <p className="text-xs text-slate-600">{l.BIDANG || '-'}</p>
                        </td>
                        <td className="py-3 px-3">{l.JABATAN}</td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{l.NO_HP || '-'}</p>
                          <p className={l.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {l.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <span className={`font-bold ${l.AKTIF && l.TAMPILKAN_PUBLIK ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {l.AKTIF ? (l.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Aktif · Tersembunyi') : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('lpmk', l as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${l.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ entity: 'lpmk', id: l.ID_LPMK, label: l.NAMA })}
                            aria-label={`Hapus ${l.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RW TAB */}
          {activeTab === 'rw' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">Daftar Rukun Warga (RW)</h3>
                  <p className="text-sm text-slate-600">Satu RW membawahi beberapa RT.</p>
                </div>
                {renderEntityActionButtons('rw', 'Tambah RW Baru', 'RW')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">RW</th>
                      <th className="py-3 px-3">Nama Ketua</th>
                      <th className="py-3 px-3">Wilayah Tugas</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.rw.map((r) => (
                      <tr key={r.ID_RW} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-display font-bold text-[#0F2942]">{r.NOMOR_RW}</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{r.NAMA_KETUA}</p>
                          <p className="text-xs text-slate-600">{r.JABATAN}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{r.WILAYAH_TUGAS}</td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{r.NO_HP || '-'}</p>
                          <p className={r.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {r.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {r.AKTIF ? (r.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('rw', r as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${r.NOMOR_RW}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ entity: 'rw', id: r.ID_RW, label: `${r.NOMOR_RW} (${r.NAMA_KETUA})` })
                            }
                            aria-label={`Hapus ${r.NOMOR_RW}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RT TAB */}
          {activeTab === 'rt' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">Daftar Rukun Tetangga (RT)</h3>
                  <p className="text-sm text-slate-600">
                    Setiap RT wajib terhubung ke RW. Anda dapat memindahkan RT ke RW lain melalui tombol Ubah.
                  </p>
                </div>
                {renderEntityActionButtons('rt', 'Tambah RT Baru', 'RT')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Induk RW &amp; RT</th>
                      <th className="py-3 px-3">Ketua RT</th>
                      <th className="py-3 px-3">Wilayah Tugas</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.rt.map((t) => (
                      <tr key={t.ID_RT} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#0F2942] text-amber-300 text-xs font-bold mr-1.5">
                            {rwNameById(t.ID_RW)}
                          </span>
                          <span className="font-bold text-[#0F2942]">{t.NOMOR_RT}</span>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{t.NAMA_KETUA}</p>
                          <p className="text-xs text-slate-600">{t.JABATAN}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{t.WILAYAH_TUGAS || '-'}</td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{t.NO_HP || '-'}</p>
                          <p className={t.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {t.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {t.AKTIF ? (t.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('rt', t as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${t.NOMOR_RT} ${t.NAMA_KETUA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah / Pindah RW
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({ entity: 'rt', id: t.ID_RT, label: `${t.NOMOR_RT} (${t.NAMA_KETUA})` })
                            }
                            aria-label={`Hapus ${t.NOMOR_RT} ${t.NAMA_KETUA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KADER TAB */}
          {activeTab === 'kader' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">Data Kader per RT</h3>
                  <p className="text-sm text-slate-600">
                    Setiap kader terhubung ke RT. Klik Ubah untuk memindahkan kader ke RT lain, mengganti jabatan, HP, atau foto.
                  </p>
                </div>
                {renderEntityActionButtons('kader', 'Tambah Kader Baru', 'Kader')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Wilayah RT</th>
                      <th className="py-3 px-3">Nama Kader</th>
                      <th className="py-3 px-3">Jabatan / Peran</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.kader.map((k) => (
                      <tr key={k.ID_KADER} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-[#0F2942] whitespace-nowrap">
                          {rtLabelById(k.ID_RT)}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{k.NAMA}</td>
                        <td className="py-3 px-3 text-slate-700">{k.JABATAN}</td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{k.NO_HP || '-'}</p>
                          <p className={k.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {k.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {k.AKTIF ? (k.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('kader', k as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${k.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah / Pindah RT
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ entity: 'kader', id: k.ID_KADER, label: k.NAMA })}
                            aria-label={`Hapus ${k.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SEKOLAH TAB */}
          {activeTab === 'sekolah' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">
                    Lokasi Sekolahan Kelurahan Ampel
                  </h3>
                  <p className="text-sm text-slate-600">
                    Daftar TK, PAUD, SD/MI, SMP/MTs, dan TPQ beserta alamat lengkap serta tautan Google Maps.
                  </p>
                </div>
                {renderEntityActionButtons('sekolah', 'Tambah Sekolah', 'Sekolah')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Jenjang &amp; Nama Sekolah</th>
                      <th className="py-3 px-3">Kepala Sekolah</th>
                      <th className="py-3 px-3">Alamat Lokasi</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.sekolah.map((s) => (
                      <tr key={s.ID_SEKOLAH} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#0F2942] text-amber-300 text-xs font-bold mb-1">
                            {s.JENJANG}
                          </span>
                          <p className="font-bold text-[#0F2942]">{s.NAMA_SEKOLAH}</p>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{s.KEPALA_SEKOLAH || '-'}</td>
                        <td className="py-3 px-3 text-slate-700 max-w-xs">
                          <p className="line-clamp-2">{s.ALAMAT}</p>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{s.NO_HP || '-'}</p>
                          <p className={s.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {s.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {s.AKTIF ? (s.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('sekolah', s as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${s.NAMA_SEKOLAH}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                entity: 'sekolah',
                                id: s.ID_SEKOLAH,
                                label: s.NAMA_SEKOLAH,
                              })
                            }
                            aria-label={`Hapus ${s.NAMA_SEKOLAH}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* GURU TAB */}
          {activeTab === 'guru' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">
                    Data Guru &amp; Pendidik
                  </h3>
                  <p className="text-sm text-slate-600">
                    Setiap guru terhubung ke salah satu sekolah yang terdaftar di Kelurahan Ampel.
                  </p>
                </div>
                {renderEntityActionButtons('guru', 'Tambah Guru', 'Data Guru')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Sekolah</th>
                      <th className="py-3 px-3">Nama Guru</th>
                      <th className="py-3 px-3">Mata Pelajaran / Jabatan</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.guru.map((g) => (
                      <tr key={g.ID_GURU} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-[#0F2942]">
                          {sekolahNameById(g.ID_SEKOLAH)}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{g.NAMA}</td>
                        <td className="py-3 px-3 text-slate-700">{g.JABATAN}</td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{g.NO_HP || '-'}</p>
                          <p className={g.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {g.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {g.AKTIF ? (g.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('guru', g as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${g.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ entity: 'guru', id: g.ID_GURU, label: g.NAMA })}
                            aria-label={`Hapus ${g.NAMA}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BALAI RW TAB */}
          {activeTab === 'balai_rw' && data && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#0F2942]">
                    Alamat Balai RW Kelurahan Ampel
                  </h3>
                  <p className="text-sm text-slate-600">
                    Informasi alamat gedung/balai pertemuan tiap RW beserta jam layanan dan tautan peta.
                  </p>
                </div>
                {renderEntityActionButtons('balai_rw', 'Tambah Balai RW', 'Balai RW')}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-3 px-3">Wilayah RW</th>
                      <th className="py-3 px-3">Nama Balai RW</th>
                      <th className="py-3 px-3">Alamat &amp; Jam Layanan</th>
                      <th className="py-3 px-3">HP &amp; Privasi</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.balaiRw.map((b) => (
                      <tr key={b.ID_BALAI} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#0F2942] text-amber-300 text-xs font-bold">
                            {rwNameById(b.ID_RW)}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#0F2942]">{b.NAMA_BALAI}</td>
                        <td className="py-3 px-3 text-slate-700 max-w-xs">
                          <p>{b.ALAMAT}</p>
                          {b.JAM_LAYANAN && (
                            <p className="text-xs text-slate-500 mt-0.5">{b.JAM_LAYANAN}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-mono">{b.NO_HP || '-'}</p>
                          <p className={b.TAMPILKAN_HP ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                            {b.TAMPILKAN_HP ? 'HP Tampil Publik' : 'HP Disembunyikan'}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-700">
                          {b.AKTIF ? (b.TAMPILKAN_PUBLIK ? 'Aktif · Publik' : 'Tersembunyi') : 'Nonaktif'}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditModal('balai_rw', b as unknown as Record<string, unknown>)}
                            aria-label={`Ubah ${b.NAMA_BALAI}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg hover:bg-slate-100 mr-1.5 cursor-pointer"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                entity: 'balai_rw',
                                id: b.ID_BALAI,
                                label: b.NAMA_BALAI,
                              })
                            }
                            aria-label={`Hapus ${b.NAMA_BALAI}`}
                            className="px-2.5 py-1.5 text-xs font-bold border border-rose-300 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* DISPLAY SETTINGS TAB */}
          {activeTab === 'pengaturan' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F2942]">
                  Pengaturan Tampilan Beranda &amp; Pengumuman Struktur Organisasi
                </h3>
                <p className="text-sm text-slate-600">
                  Atur urutan bagian, tampil/sembunyikan kelompok organisasi, serta pesan pengumuman di bagian atas halaman publik.
                </p>
              </div>

              <div>
                <label htmlFor="org-home-announcement" className="block text-sm font-bold text-[#0F2942] mb-1.5">
                  Pengumuman Beranda Struktur Organisasi
                </label>
                <textarea
                  id="org-home-announcement"
                  rows={3}
                  value={displayDraft.pengumumanBeranda}
                  onChange={(e) =>
                    setDisplayDraft((prev) => ({ ...prev, pengumumanBeranda: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2.5">
                  <p className="text-sm font-bold text-[#0F2942]">Urutan Tampilan Bagian Beranda</p>
                  {displayDraft.urutanBagian.map((sec, idx) => (
                    <div
                      key={sec}
                      className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    >
                      <span className="font-semibold text-[#0F2942]">
                        {idx + 1}.{' '}
                        {sec === 'KELURAHAN'
                          ? 'Bagian A — Pemerintahan Kelurahan'
                          : sec === 'TP_PKK'
                          ? 'Kolom Sejajar — TP PKK Kelurahan Ampel (Independen)'
                          : sec === 'LPMK_RW_RT'
                          ? 'Bagian B — Lembaga Kemasyarakatan (LPMK, RW, RT)'
                          : sec === 'KADER'
                          ? 'Bagian C — Data Kader per RT'
                          : sec === 'SEKOLAH_GURU'
                          ? 'Bagian D — Lokasi Sekolahan & Daftar Guru'
                          : 'Bagian E — Alamat Balai RW'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveSectionOrder(idx, -1)}
                          disabled={idx === 0}
                          aria-label={`Naikkan urutan ${sec}`}
                          className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSectionOrder(idx, 1)}
                          disabled={idx === displayDraft.urutanBagian.length - 1}
                          aria-label={`Turunkan urutan ${sec}`}
                          className="p-1.5 border border-slate-300 rounded-lg bg-white disabled:opacity-40 cursor-pointer"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  <p className="text-sm font-bold text-[#0F2942]">Tampilkan / Sembunyikan Bagian</p>
                  {(
                    [
                      { key: 'kelurahan', label: 'Tampilkan Pemerintahan Kelurahan' },
                      { key: 'tpPkk', label: 'Tampilkan TP PKK Kelurahan Ampel (Sejajar Kelurahan)' },
                      { key: 'lpmk', label: 'Tampilkan Lembaga LPMK' },
                      { key: 'rwRt', label: 'Tampilkan Daftar RW & RT' },
                      { key: 'kader', label: 'Tampilkan Data Kader per RT' },
                      { key: 'sekolahGuru', label: 'Tampilkan Lokasi Sekolahan & Daftar Guru' },
                      { key: 'balaiRw', label: 'Tampilkan Alamat Balai RW' },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={displayDraft.tampilkanBagian[opt.key]}
                        onChange={(e) =>
                          setDisplayDraft((prev) => ({
                            ...prev,
                            tampilkanBagian: {
                              ...prev.tampilkanBagian,
                              [opt.key]: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 accent-[#0F2942]"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0F2942] text-amber-300 border border-[#D4AF37] text-sm font-bold rounded-xl cursor-pointer"
              >
                Simpan Pengaturan Tampilan
              </button>
            </form>
          )}

          {/* ACTIVITY LOGS TAB */}
          {activeTab === 'log' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#0F2942]">
                  Riwayat Aktivitas Struktur Organisasi (activity_logs)
                </h3>
                <p className="text-sm text-slate-600">
                  Mencatat setiap aksi tambah, ubah, hapus, dan pembaruan pengaturan tampilan oleh admin.
                </p>
              </div>
              {logs.length === 0 ? (
                <p className="text-sm text-slate-600 py-6 text-center">
                  Belum ada log perubahan struktur organisasi tercatat.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                        <th className="py-2.5 px-3">Waktu</th>
                        <th className="py-2.5 px-3">Admin</th>
                        <th className="py-2.5 px-3">Aksi</th>
                        <th className="py-2.5 px-3">Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {logs.map((l) => (
                        <tr key={l.ID_LOG}>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {new Date(l.WAKTU).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#0F2942]">{l.NAMA_PENGGUNA}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{l.AKSI}</td>
                          <td className="py-2.5 px-3 text-slate-700">{l.DETAIL}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="org-form-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full border-2 border-[#D4AF37] shadow-xl overflow-hidden my-8">
            <div className="bg-[#0F2942] px-6 py-4 text-white flex items-center justify-between">
              <h3 id="org-form-title" className="font-display text-lg font-bold">
                {form.id ? 'Ubah Data' : 'Tambah Data'} ({modalEntity.replace('_', ' ').toUpperCase()})
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Tutup formulir"
                className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-sm font-semibold text-rose-900">
                  {errorMsg}
                </div>
              )}

              {modalEntity === 'rt' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Terhubung ke RW *
                    </label>
                    <select
                      required
                      value={form.idRw}
                      onChange={(e) => setForm((p) => ({ ...p, idRw: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">-- Pilih RW --</option>
                      {data?.rw.map((r) => (
                        <option key={r.ID_RW} value={r.ID_RW}>
                          {r.NOMOR_RW} — {r.NAMA_KETUA}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Nomor RT *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: RT 03"
                      value={form.nomorRt}
                      onChange={(e) => setForm((p) => ({ ...p, nomorRt: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {modalEntity === 'rw' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Nomor RW *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RW 03"
                    value={form.nomorRw}
                    onChange={(e) => setForm((p) => ({ ...p, nomorRw: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              {modalEntity === 'kader' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Terhubung ke RT * (dapat memindahkan kader ke RT lain)
                  </label>
                  <select
                    required
                    value={form.idRt}
                    onChange={(e) => setForm((p) => ({ ...p, idRt: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih RT --</option>
                    {data?.rt.map((t) => (
                      <option key={t.ID_RT} value={t.ID_RT}>
                        {rwNameById(t.ID_RW)} / {t.NOMOR_RT} — {t.NAMA_KETUA}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalEntity === 'kelurahan' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Tingkat Hirarki Kelurahan *
                  </label>
                  <select
                    value={form.tingkat}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, tingkat: e.target.value as OrgKelurahanLevel }))
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="LURAH">Lurah / Kepala Kelurahan (Puncak)</option>
                    <option value="KASI">Kasi / Kepala Seksi (Menengah)</option>
                    <option value="STAF">Staf Pelaksana (Bawah)</option>
                  </select>
                </div>
              )}

              {modalEntity === 'guru' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Terhubung ke Sekolah *
                  </label>
                  <select
                    required
                    value={form.idSekolah}
                    onChange={(e) => setForm((p) => ({ ...p, idSekolah: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Sekolah --</option>
                    {data?.sekolah.map((s) => (
                      <option key={s.ID_SEKOLAH} value={s.ID_SEKOLAH}>
                        {s.JENJANG} — {s.NAMA_SEKOLAH}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalEntity === 'balai_rw' && (
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Terhubung ke RW *
                  </label>
                  <select
                    required
                    value={form.idRw}
                    onChange={(e) => setForm((p) => ({ ...p, idRw: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih RW --</option>
                    {data?.rw.map((r) => (
                      <option key={r.ID_RW} value={r.ID_RW}>
                        {r.NOMOR_RW} — {r.NAMA_KETUA}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalEntity === 'sekolah' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Jenjang Sekolah *
                    </label>
                    <select
                      value={form.jenjang}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, jenjang: e.target.value as SchoolJenjang }))
                      }
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="PAUD / TK">PAUD / TK</option>
                      <option value="SD / MI">SD / MI</option>
                      <option value="SMP / MTs">SMP / MTs</option>
                      <option value="SMA / SMK">SMA / SMK</option>
                      <option value="TPQ / Madrasah">TPQ / Madrasah</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Kepala Sekolah (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Kepala Sekolah..."
                      value={form.kepalaSekolah}
                      onChange={(e) => setForm((p) => ({ ...p, kepalaSekolah: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {modalEntity === 'sekolah' || modalEntity === 'balai_rw' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      {modalEntity === 'sekolah' ? 'Nama Sekolah *' : 'Nama Balai RW *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        modalEntity === 'sekolah'
                          ? 'Contoh: SDN Ampel 01'
                          : 'Contoh: Balai RW 01 Kelurahan Ampel'
                      }
                      value={form.nama}
                      onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Alamat Lengkap *
                    </label>
                    <textarea
                      required
                      rows={2}
                      placeholder="Jl. Raya Ampel No. ..., Kelurahan Ampel"
                      value={form.alamat}
                      onChange={(e) => setForm((p) => ({ ...p, alamat: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  {modalEntity === 'balai_rw' && (
                    <div>
                      <label className="block text-xs font-bold text-[#0F2942] mb-1">
                        Jam Layanan / Fasilitas (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Senin–Sabtu 08.00–16.00 WIB · Aula Warga & Posyandu"
                        value={form.jamLayanan}
                        onChange={(e) => setForm((p) => ({ ...p, jamLayanan: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-[#0F2942] mb-1">
                      Tautan Google Maps (Opsional — otomatis dicari dari alamat jika kosong)
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" aria-hidden="true" />
                      <input
                        type="url"
                        placeholder="https://maps.google.com/..."
                        value={form.mapsUrl}
                        onChange={(e) => setForm((p) => ({ ...p, mapsUrl: e.target.value }))}
                        className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#0F2942] mb-1">
                        {modalEntity === 'rw' || modalEntity === 'rt'
                          ? 'Nama Ketua / Pengurus *'
                          : modalEntity === 'guru'
                          ? 'Nama Guru *'
                          : 'Nama Lengkap *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nama lengkap..."
                        value={form.nama}
                        onChange={(e) => setForm((p) => ({ ...p, nama: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0F2942] mb-1">
                        {modalEntity === 'guru' ? 'Mata Pelajaran / Jabatan *' : 'Jabatan *'}
                      </label>
                      {modalEntity === 'tp_pkk' ? (
                        <div className="space-y-2">
                          <select
                            value={
                              (TP_PKK_JABATAN_OPTIONS as readonly string[]).includes(form.jabatan)
                                ? form.jabatan
                                : '__CUSTOM__'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '__CUSTOM__') {
                                setForm((p) => ({
                                  ...p,
                                  jabatan: (TP_PKK_JABATAN_OPTIONS as readonly string[]).includes(p.jabatan)
                                    ? ''
                                    : p.jabatan,
                                }));
                              } else {
                                setForm((p) => ({
                                  ...p,
                                  jabatan: val,
                                  pokja: inferTpPkkPokja(val),
                                }));
                              }
                            }}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                          >
                            {TP_PKK_JABATAN_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            <option value="__CUSTOM__">Jabatan Lainnya (Tulis Manual)</option>
                          </select>
                          {!(TP_PKK_JABATAN_OPTIONS as readonly string[]).includes(form.jabatan) && (
                            <input
                              type="text"
                              required
                              placeholder="Tulis jabatan TP PKK..."
                              value={form.jabatan}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  jabatan: e.target.value,
                                  pokja: inferTpPkkPokja(e.target.value, p.pokja),
                                }))
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          required
                          placeholder={
                            modalEntity === 'guru'
                              ? 'Mis. Guru Kelas IV / Guru Matematika'
                              : 'Mis. Ketua RT 01 / Kader Posyandu'
                          }
                          value={form.jabatan}
                          onChange={(e) => setForm((p) => ({ ...p, jabatan: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      )}
                    </div>
                  </div>

                  {modalEntity === 'tp_pkk' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#0F2942] mb-1">
                          Unsur / Kelompok Kerja
                        </label>
                        <select
                          value={form.pokja || inferTpPkkPokja(form.jabatan)}
                          onChange={(e) => setForm((p) => ({ ...p, pokja: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="Pembina">Pembina</option>
                          <option value="Pengurus Inti">Pengurus Inti</option>
                          <option value="POKJA I">POKJA I</option>
                          <option value="POKJA II">POKJA II</option>
                          <option value="POKJA III">POKJA III</option>
                          <option value="POKJA IV">POKJA IV</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#0F2942] mb-1">
                          Bidang / Keterangan Tugas
                        </label>
                        <input
                          type="text"
                          placeholder="Mis. Kesehatan, Gizi & Lingkungan"
                          value={form.bidang}
                          onChange={(e) => setForm((p) => ({ ...p, bidang: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  ) : modalEntity === 'lpmk' ? (
                    <div>
                      <label className="block text-xs font-bold text-[#0F2942] mb-1">Bidang / Seksi</label>
                      <input
                        type="text"
                        placeholder="Mis. Bidang Pembangunan & Pemberdayaan"
                        value={form.bidang}
                        onChange={(e) => setForm((p) => ({ ...p, bidang: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  ) : modalEntity !== 'kader' && modalEntity !== 'guru' ? (
                    <div>
                      <label className="block text-xs font-bold text-[#0F2942] mb-1">
                        Wilayah Tugas {modalEntity === 'rw' ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        required={modalEntity === 'rw'}
                        placeholder="Mis. Dusun Krajan Utara / Blok Melati"
                        value={form.wilayahTugas}
                        onChange={(e) => setForm((p) => ({ ...p, wilayahTugas: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                  ) : null}
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">
                    Nomor HP (Format Indonesia)
                  </label>
                  <input
                    type="text"
                    placeholder="081234567890"
                    value={form.noHp}
                    onChange={(e) => setForm((p) => ({ ...p, noHp: e.target.value }))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    min={1}
                    value={form.urutan}
                    onChange={(e) => setForm((p) => ({ ...p, urutan: Number(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">URL Foto (Opsional)</label>
                  <input
                    type="text"
                    placeholder="https://... atau unggah di samping"
                    value={form.fotoUrl}
                    onChange={(e) => setForm((p) => ({ ...p, fotoUrl: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0F2942] mb-1">Unggah Foto Profil</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePhotoUpload}
                    className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:font-semibold"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-sm">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.tampilkanHp}
                    onChange={(e) => setForm((p) => ({ ...p, tampilkanHp: e.target.checked }))}
                    className="w-4 h-4 accent-[#0F2942]"
                  />
                  <span className="font-semibold text-[#0F2942]">
                    Izinkan tampilkan Nomor HP &amp; tombol WhatsApp di beranda publik (default: disembunyikan)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.tampilkanPublik}
                    onChange={(e) => setForm((p) => ({ ...p, tampilkanPublik: e.target.checked }))}
                    className="w-4 h-4 accent-[#0F2942]"
                  />
                  <span>Tampilkan profil di halaman publik</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.aktif}
                    onChange={(e) => setForm((p) => ({ ...p, aktif: e.target.checked }))}
                    className="w-4 h-4 accent-[#0F2942]"
                  />
                  <span>Status profil Aktif</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0F2942] text-amber-300 border border-[#D4AF37] text-sm font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="org-delete-title"
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full border-2 border-rose-300 p-6 space-y-4 shadow-xl">
            <h3 id="org-delete-title" className="font-display text-lg font-extrabold text-[#0F2942]">
              Konfirmasi Hapus Data
            </h3>
            <p className="text-sm text-slate-700">
              Apakah Anda yakin ingin menghapus <strong>{deleteTarget.label}</strong>? Tindakan ini akan langsung memperbarui tampilan publik dan dicatat di log aktivitas.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-bold border border-slate-300 rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-bold bg-rose-700 text-white rounded-xl hover:bg-rose-800 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Data'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EXCEL IMPORT MODAL */}
      {importEntity && data && (
        <ExcelImportModal
          title={`Import Excel — ${importEntity.replace('_', ' ').toUpperCase()}`}
          subtitle="Unggah file Excel (.xlsx/.xls) atau CSV untuk menambah banyak data sekaligus. Anda juga dapat mengunduh contoh template terlebih dahulu."
          onClose={() => setImportEntity(null)}
          onDownloadTemplate={() => downloadOrgEntityTemplate(importEntity)}
          onParseFile={(buf) => parseOrgImportExcel(buf, importEntity, data)}
          onConfirmImport={(validRows) => handleConfirmOrgImport(importEntity, validRows)}
        />
      )}
    </div>
  );
};
