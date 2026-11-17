import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building,
  Building2,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  MapPin,
  Megaphone,
  Navigation,
  School,
  Search,
  Users,
  XCircle,
} from 'lucide-react';
import { filterOrgProfiles } from '../shared/orgLogic';
import {
  OrgPublicProfile,
  PublicOrgStructureResponse,
} from '../shared/types';
import { fetchPublicOrgStructure } from '../lib/orgService';
import { OrgProfileCard, OrgProfileDetailModal } from './OrgProfileCard';

type OrgMenuTab =
  | 'beranda'
  | 'kelurahan'
  | 'tp_pkk'
  | 'lpmk'
  | 'rw'
  | 'rt'
  | 'kader'
  | 'sekolah_guru'
  | 'balai_rw';

export const OrgPublicPortal: React.FC = () => {
  const [data, setData] = useState<PublicOrgStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Navigation menu tab (Tahap 2)
  const [activeMenu, setActiveMenu] = useState<OrgMenuTab>('beranda');

  // Search & Filter states (Tahap 2)
  const [queryName, setQueryName] = useState('');
  const [queryRole, setQueryRole] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<
    | 'ALL'
    | 'KELURAHAN'
    | 'TP_PKK'
    | 'LPMK'
    | 'RW'
    | 'RT'
    | 'KADER'
    | 'SEKOLAH'
    | 'GURU'
    | 'BALAI_RW'
  >('ALL');
  const [rwFilter, setRwFilter] = useState('');
  const [rtFilter, setRtFilter] = useState('');

  const [selectedProfile, setSelectedProfile] = useState<OrgPublicProfile | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPublicOrgStructure();
      setData(res);
    } catch (err) {
      setError((err as Error).message || 'Gagal memuat data struktur organisasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hasActiveFilter =
    queryName.trim() !== '' ||
    queryRole.trim() !== '' ||
    categoryFilter !== 'ALL' ||
    rwFilter !== '' ||
    rtFilter !== '';

  const allProfiles = useMemo(() => {
    if (!data) return [];
    return [
      ...data.kelurahan,
      ...(data.tpPkk || []),
      ...data.lpmk,
      ...data.rw,
      ...data.rt,
      ...data.kader,
      ...(data.sekolah || []),
      ...(data.guru || []),
      ...(data.balaiRw || []),
    ];
  }, [data]);

  const filteredProfiles = useMemo(() => {
    return filterOrgProfiles(allProfiles, {
      queryName,
      queryRole,
      category: categoryFilter,
      rwId: rwFilter,
      rtId: rtFilter,
    });
  }, [allProfiles, queryName, queryRole, categoryFilter, rwFilter, rtFilter]);

  const rtOptionsForSelectedRw = useMemo(() => {
    if (!data) return [];
    if (!rwFilter) return data.rt;
    return data.rt.filter((t) => t.idRw === rwFilter);
  }, [data, rwFilter]);

  const resetFilters = () => {
    setQueryName('');
    setQueryRole('');
    setCategoryFilter('ALL');
    setRwFilter('');
    setRtFilter('');
  };

  const handleMenuClick = (tab: OrgMenuTab) => {
    setActiveMenu(tab);
    resetFilters();
  };

  // Section renderers for Bagian A (Pemerintahan Kelurahan & Kolom Sejajar TP PKK Kelurahan Ampel), Bagian B, Bagian C, Bagian D, Bagian E
  const renderBagianKelurahan = (inParallelColumns = false) => {
    if (!data) return null;
    const lurah = data.kelurahan.filter((k) => k.tingkat === 'LURAH');
    const kasi = data.kelurahan.filter((k) => k.tingkat === 'KASI');
    const staf = data.kelurahan.filter((k) => k.tingkat === 'STAF');
    const gridClass = inParallelColumns
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

    return (
      <section aria-labelledby="bagian-a-heading" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs h-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0F2942] text-amber-300 border border-[#D4AF37] flex items-center justify-center shrink-0">
              <Landmark className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Bagian A · Tingkat Kelurahan
              </span>
              <h2 id="bagian-a-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                Pemerintahan Kelurahan
              </h2>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-600">{data.kelurahan.length} Personel Aktif</span>
        </div>

        {data.kelurahan.length === 0 ? (
          <p className="text-base text-slate-600 py-6 text-center">Belum ada data Pemerintahan Kelurahan yang ditampilkan.</p>
        ) : (
          <div className="space-y-2">
            {/* Level 1: Lurah */}
            {lurah.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-md">
                  {lurah.map((item) => (
                    <OrgProfileCard
                      key={item.id}
                      profile={item}
                      onSelectDetail={setSelectedProfile}
                      highlightGold
                      compact={inParallelColumns}
                    />
                  ))}
                </div>
                {(kasi.length > 0 || staf.length > 0) && (
                  <div className="w-0.5 h-8 bg-[#D4AF37]" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Level 2: Kasi */}
            {kasi.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-4xl border-t-2 border-[#D4AF37] pt-5 relative">
                  <div className="mb-3 text-center">
                    <span className="inline-block px-3 py-1 rounded-lg bg-[#0F2942] text-amber-300 text-xs font-bold uppercase tracking-wider">
                      Kepala Seksi (Kasi)
                    </span>
                  </div>
                  <div className={gridClass}>
                    {kasi.map((item) => (
                      <OrgProfileCard
                        key={item.id}
                        profile={item}
                        onSelectDetail={setSelectedProfile}
                        compact={inParallelColumns}
                      />
                    ))}
                  </div>
                </div>
                {staf.length > 0 && (
                  <div className="w-0.5 h-8 bg-[#0F2942]/40 mt-2" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Level 3: Staf */}
            {staf.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="w-full border-t-2 border-slate-300 pt-5">
                  <div className="mb-3 text-center">
                    <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-[#0F2942] border border-slate-300 text-xs font-bold uppercase tracking-wider">
                      Staf Pelaksana
                    </span>
                  </div>
                  <div className={gridClass}>
                    {staf.map((item) => (
                      <OrgProfileCard
                        key={item.id}
                        profile={item}
                        onSelectDetail={setSelectedProfile}
                        compact={inParallelColumns}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderBagianTpPkk = (inParallelColumns = false) => {
    if (!data) return null;
    const pkkList = data.tpPkk || [];
    const gridClass = inParallelColumns
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

    const isPembina = (p: OrgPublicProfile) =>
      p.pokja?.toLowerCase() === 'pembina' || p.jabatan.toLowerCase().includes('pembina');
    const getPokjaKey = (p: OrgPublicProfile): string | null => {
      const hay = `${p.pokja || ''} ${p.jabatan}`.toUpperCase();
      if (/\bPOKJA\s*(IV|4)\b/.test(hay)) return 'POKJA IV';
      if (/\bPOKJA\s*(III|3)\b/.test(hay)) return 'POKJA III';
      if (/\bPOKJA\s*(II|2)\b/.test(hay)) return 'POKJA II';
      if (/\bPOKJA\s*(I|1)\b/.test(hay)) return 'POKJA I';
      return null;
    };

    const pembina = pkkList.filter(isPembina);
    const pokjaGroups = ['POKJA I', 'POKJA II', 'POKJA III', 'POKJA IV'].map((pokjaName) => ({
      name: pokjaName,
      members: pkkList.filter((p) => !isPembina(p) && getPokjaKey(p) === pokjaName),
    })).filter((g) => g.members.length > 0);
    const pengurusInti = pkkList.filter((p) => !isPembina(p) && !getPokjaKey(p));

    return (
      <section aria-labelledby="bagian-pkk-heading" className="bg-white rounded-2xl border-2 border-[#D4AF37] p-6 sm:p-8 shadow-xs h-full">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-900 border border-[#D4AF37] flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800">
                Sejajar Pemerintah Kelurahan · Independen (Tidak Mengikat)
              </span>
              <h2 id="bagian-pkk-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                TP PKK Kelurahan Ampel
              </h2>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-600">{pkkList.length} Pengurus Aktif</span>
        </div>

        <div className="mb-5 rounded-xl bg-rose-50/70 border border-rose-200 px-4 py-2.5 text-xs sm:text-sm font-medium text-rose-950">
          Berkedudukan sejajar dengan Pemerintah Kelurahan secara independen (tidak mengikat pada pihak mana pun).
        </div>

        {pkkList.length === 0 ? (
          <p className="text-base text-slate-600 py-6 text-center">Belum ada data TP PKK Kelurahan Ampel yang ditampilkan.</p>
        ) : (
          <div className="space-y-4">
            {/* Pembina */}
            {pembina.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="mb-2 text-center">
                  <span className="inline-block px-3 py-1 rounded-lg bg-[#0F2942] text-amber-300 text-xs font-bold uppercase tracking-wider">
                    Pembina TP PKK
                  </span>
                </div>
                <div className="w-full max-w-md space-y-3">
                  {pembina.map((item) => (
                    <OrgProfileCard
                      key={item.id}
                      profile={item}
                      onSelectDetail={setSelectedProfile}
                      highlightGold
                      compact={inParallelColumns}
                    />
                  ))}
                </div>
                {(pengurusInti.length > 0 || pokjaGroups.length > 0) && (
                  <div className="w-0.5 h-6 bg-[#D4AF37] mt-2" aria-hidden="true" />
                )}
              </div>
            )}

            {/* Pengurus Inti: Ketua, Wakil, Sekretaris, Bendahara */}
            {pengurusInti.length > 0 && (
              <div className="border-t-2 border-[#D4AF37] pt-4">
                <div className="mb-3 text-center">
                  <span className="inline-block px-3 py-1 rounded-lg bg-rose-50 text-rose-900 border border-rose-200 text-xs font-bold uppercase tracking-wider">
                    Pengurus Inti (Ketua, Wakil, Sekretaris &amp; Bendahara PKK)
                  </span>
                </div>
                <div className={gridClass}>
                  {pengurusInti.map((item) => (
                    <OrgProfileCard
                      key={item.id}
                      profile={item}
                      onSelectDetail={setSelectedProfile}
                      compact={inParallelColumns}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Kelompok Kerja (POKJA I - IV) */}
            {pokjaGroups.length > 0 && (
              <div className="border-t-2 border-slate-200 pt-4 space-y-4">
                <div className="text-center">
                  <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 text-[#0F2942] border border-slate-300 text-xs font-bold uppercase tracking-wider">
                    Kelompok Kerja (POKJA I – POKJA IV)
                  </span>
                </div>
                {pokjaGroups.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-[#0F2942] text-amber-300 text-xs font-bold uppercase tracking-wider">
                        {group.name}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {group.members.length} Pengurus &amp; Anggota
                      </span>
                    </div>
                    <div className={gridClass}>
                      {group.members.map((item) => (
                        <OrgProfileCard
                          key={item.id}
                          profile={item}
                          onSelectDetail={setSelectedProfile}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    );
  };

  const renderBagianLpmk = () => {
    if (!data) return null;
    return (
      <div className="bg-amber-50/50 rounded-2xl border-2 border-[#D4AF37] p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F2942] text-amber-300 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-[#0F2942]">
                Lembaga Pemberdayaan Masyarakat Kelurahan (LPMK)
              </h3>
              <p className="text-sm text-amber-950 font-medium">
                Mitra koordinasi pembangunan &amp; pemberdayaan kelurahan (berdiri sendiri, bukan atasan RW/RT).
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-lg bg-white border border-[#D4AF37] text-amber-950">
            {data.lpmk.length} Pengurus
          </span>
        </div>

        {data.lpmk.length === 0 ? (
          <p className="text-base text-slate-600 py-4">Belum ada pengurus LPMK yang ditampilkan.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.lpmk.map((item) => (
              <OrgProfileCard
                key={item.id}
                profile={item}
                onSelectDetail={setSelectedProfile}
                highlightGold
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBagianRwRt = () => {
    if (!data) return null;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0F2942] text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-[#0F2942]">
                Rukun Warga (RW) &amp; Rukun Tetangga (RT)
              </h3>
              <p className="text-sm text-slate-600">
                Susunan bertingkat RW beserta daftar pengurus RT di wilayah tugas masing-masing.
              </p>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {data.rw.length} RW · {data.rt.length} RT
          </span>
        </div>

        {data.rw.length === 0 ? (
          <p className="text-base text-slate-600 py-4">Belum ada data RW yang ditampilkan.</p>
        ) : (
          <div className="space-y-6">
            {data.rw.map((rwItem) => {
              const childRts = data.rt.filter((t) => t.idRw === rwItem.id);
              return (
                <div
                  key={rwItem.id}
                  className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
                >
                  <div className="max-w-lg">
                    <OrgProfileCard
                      profile={rwItem}
                      onSelectDetail={setSelectedProfile}
                      highlightGold
                    />
                  </div>

                  {/* Connector + RT List */}
                  <div className="pl-4 sm:pl-8 border-l-2 border-[#0F2942]/30 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#0F2942]">
                      Daftar RT di bawah {rwItem.nomorRw} ({childRts.length} RT)
                    </p>
                    {childRts.length === 0 ? (
                      <p className="text-sm text-slate-600">Belum ada RT aktif di bawah {rwItem.nomorRw}.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {childRts.map((rtItem) => (
                          <OrgProfileCard
                            key={rtItem.id}
                            profile={rtItem}
                            onSelectDetail={setSelectedProfile}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderBagianKader = () => {
    if (!data) return null;
    return (
      <section aria-labelledby="bagian-c-heading" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-950 border border-[#D4AF37] flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Bagian C</span>
              <h2 id="bagian-c-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                Data Kader per RT
              </h2>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-600">{data.kader.length} Kader Aktif</span>
        </div>

        {data.rw.length === 0 || data.rt.length === 0 ? (
          <p className="text-base text-slate-600 py-4 text-center">Belum ada data RT &amp; Kader yang ditampilkan.</p>
        ) : (
          <div className="space-y-6">
            {data.rw.map((rwItem) => {
              const rts = data.rt.filter((t) => t.idRw === rwItem.id);
              if (rts.length === 0) return null;
              return (
                <div key={rwItem.id} className="space-y-4">
                  {rts.map((rtItem) => {
                    const kaders = data.kader.filter((k) => k.idRt === rtItem.id);
                    return (
                      <div
                        key={rtItem.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-base font-display font-bold text-[#0F2942]">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0F2942] text-amber-300 text-sm">
                            {rwItem.nomorRw}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[#0F2942] text-sm">
                            {rtItem.nomorRt}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400" aria-hidden="true" />
                          <span className="text-sm sm:text-base text-slate-800">
                            Ketua RT: {rtItem.nama} ({kaders.length} Kader)
                          </span>
                        </div>

                        {kaders.length === 0 ? (
                          <p className="text-sm text-slate-600">Belum ada kader terdaftar pada {rtItem.nomorRt}.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {kaders.map((kaderItem) => (
                              <OrgProfileCard
                                key={kaderItem.id}
                                profile={kaderItem}
                                onSelectDetail={setSelectedProfile}
                                compact
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderBagianSekolahGuru = () => {
    if (!data) return null;
    const sekolahList = data.sekolah || [];
    const guruList = data.guru || [];

    return (
      <section aria-labelledby="bagian-d-heading" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#0F2942] text-amber-300 border border-[#D4AF37] flex items-center justify-center shrink-0">
              <School className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Bagian D</span>
              <h2 id="bagian-d-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                Lokasi Sekolahan &amp; Daftar Guru Kelurahan Ampel
              </h2>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-600">
            {sekolahList.length} Sekolah · {guruList.length} Guru
          </span>
        </div>

        {sekolahList.length === 0 ? (
          <p className="text-base text-slate-600 py-6 text-center">
            Belum ada data lokasi sekolahan yang ditampilkan.
          </p>
        ) : (
          <div className="space-y-6">
            {sekolahList.map((school) => {
              const teachers = guruList.filter((g) => g.idSekolah === school.id);
              return (
                <div
                  key={school.id}
                  className="rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-5 sm:p-6 space-y-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-[#0F2942] text-amber-300 text-xs font-bold">
                          {school.jenjang}
                        </span>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1">
                          <GraduationCap className="w-3.5 h-3.5" aria-hidden="true" />
                          {teachers.length} Guru / Pengajar
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-extrabold text-[#0F2942]">
                        {school.nama}
                      </h3>
                      {school.kepalaSekolah && (
                        <p className="text-sm font-semibold text-amber-900">
                          Kepala Sekolah: {school.kepalaSekolah}
                        </p>
                      )}
                      {school.alamat && (
                        <p className="text-sm text-slate-700 flex items-start gap-2 pt-0.5">
                          <MapPin className="w-4 h-4 text-[#0F2942] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{school.alamat}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedProfile(school)}
                        className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-[#0F2942] text-[#0F2942] text-sm font-bold cursor-pointer"
                      >
                        Detail Sekolah
                      </button>
                      {school.mapsUrl && (
                        <a
                          href={school.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-[#0F2942] border border-sky-300 text-sm font-bold inline-flex items-center gap-1.5"
                        >
                          <Navigation className="w-4 h-4 text-sky-700 shrink-0" aria-hidden="true" />
                          <span>Lihat Lokasi</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {teachers.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Belum ada daftar guru yang tercatat untuk {school.nama}.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {teachers.map((guruItem) => (
                        <OrgProfileCard
                          key={guruItem.id}
                          profile={guruItem}
                          onSelectDetail={setSelectedProfile}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderBagianBalaiRw = () => {
    if (!data) return null;
    const balaiList = data.balaiRw || [];

    return (
      <section aria-labelledby="bagian-e-heading" className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 text-[#0F2942] border border-[#D4AF37] flex items-center justify-center shrink-0">
              <Building className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Bagian E</span>
              <h2 id="bagian-e-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                Alamat Balai RW Kelurahan Ampel
              </h2>
            </div>
          </div>
          <span className="text-sm font-semibold text-slate-600">{balaiList.length} Balai RW Aktif</span>
        </div>

        {balaiList.length === 0 ? (
          <p className="text-base text-slate-600 py-6 text-center">
            Belum ada data alamat Balai RW yang ditampilkan.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {balaiList.map((balai) => (
              <OrgProfileCard
                key={balai.id}
                profile={balai}
                onSelectDetail={setSelectedProfile}
                highlightGold
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero Section (Biru Tua, Putih, Aksen Emas) */}
      <section className="rounded-2xl bg-[#0F2942] text-white border-2 border-[#D4AF37] p-6 sm:p-9 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl">
            <span className="inline-block px-3 py-1 rounded-md bg-amber-400/15 border border-[#D4AF37] text-amber-300 text-xs font-bold uppercase tracking-wider">
              Portal Resmi Warga Ampel
            </span>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              STRUKTUR ORGANISASI WARGA AMPEL
            </h1>
            <p className="mt-2.5 text-lg text-slate-200 leading-relaxed">
              Kenali Pengurus, Struktur Organisasi, Sekolah &amp; Guru, serta Lokasi Balai RW di Lingkungan Warga Ampel.
            </p>
          </div>

          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {data.kelurahan.length + (data.tpPkk || []).length}
                </p>
                <p className="text-xs text-slate-200 mt-0.5">Kelurahan &amp; TP PKK</p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {data.rw.length} / {data.rt.length}
                </p>
                <p className="text-xs text-slate-200 mt-0.5">RW / RT</p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {data.lpmk.length + data.kader.length}
                </p>
                <p className="text-xs text-slate-200 mt-0.5">LPMK &amp; Kader</p>
              </div>
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-center">
                <p className="font-display text-2xl font-extrabold text-amber-300 tabular-nums">
                  {(data.sekolah || []).length} / {(data.guru || []).length}
                </p>
                <p className="text-xs text-slate-200 mt-0.5">Sekolah / Guru</p>
              </div>
            </div>
          )}
        </div>

        {data?.displaySettings.pengumumanBeranda && (
          <div className="mt-6 rounded-xl bg-white/10 border border-[#D4AF37]/50 px-4 py-3 flex items-start gap-3 text-sm sm:text-base text-amber-100">
            <Megaphone className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{data.displaySettings.pengumumanBeranda}</span>
          </div>
        )}
      </section>

      {/* Dedicated Organization Menu (Tahap 2 + TP PKK + Sekolah/Guru & Balai RW) */}
      <nav
        aria-label="Navigasi Struktur Organisasi"
        className="bg-white rounded-2xl border border-slate-200 p-2.5 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'beranda', label: 'Beranda' },
              { id: 'kelurahan', label: 'Pemerintahan Kelurahan' },
              { id: 'tp_pkk', label: 'TP PKK Ampel' },
              { id: 'lpmk', label: 'LPMK' },
              { id: 'rw', label: 'Daftar RW' },
              { id: 'rt', label: 'Daftar RT' },
              { id: 'kader', label: 'Data Kader' },
              { id: 'sekolah_guru', label: 'Sekolah & Guru' },
              { id: 'balai_rw', label: 'Balai RW' },
            ] as Array<{ id: OrgMenuTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMenuClick(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-colors cursor-pointer ${
                activeMenu === tab.id && !hasActiveFilter
                  ? 'bg-[#0F2942] text-amber-300 border border-[#D4AF37]'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-[#0F2942]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Search & Filter Controls (Tahap 2) */}
      <section
        aria-label="Pencarian dan Filter Pengurus"
        className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#0F2942]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-[#0F2942]">
              Cari Pengurus, Guru, Sekolah &amp; Balai RW
            </h2>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-bold text-rose-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <XCircle className="w-4 h-4" aria-hidden="true" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label htmlFor="org-search-name" className="block text-xs font-bold text-slate-600 mb-1">
              Cari Nama / Lokasi
            </label>
            <input
              id="org-search-name"
              type="search"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Nama pengurus, guru, sekolah..."
              className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div>
            <label htmlFor="org-search-role" className="block text-xs font-bold text-slate-600 mb-1">
              Cari Jabatan / Mapel
            </label>
            <input
              id="org-search-role"
              type="search"
              value={queryRole}
              onChange={(e) => setQueryRole(e.target.value)}
              placeholder="Mis. Lurah, Guru Kelas, Balai..."
              className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl focus:outline-none focus:border-[#0F2942]"
            />
          </div>

          <div>
            <label htmlFor="org-filter-category" className="block text-xs font-bold text-slate-600 mb-1">
              Kategori
            </label>
            <select
              id="org-filter-category"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value as
                    | 'ALL'
                    | 'KELURAHAN'
                    | 'TP_PKK'
                    | 'LPMK'
                    | 'RW'
                    | 'RT'
                    | 'KADER'
                    | 'SEKOLAH'
                    | 'GURU'
                    | 'BALAI_RW'
                )
              }
              className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0F2942]"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="KELURAHAN">Pemerintahan Kelurahan</option>
              <option value="TP_PKK">TP PKK Kelurahan Ampel</option>
              <option value="LPMK">LPMK</option>
              <option value="RW">Pengurus RW</option>
              <option value="RT">Pengurus RT</option>
              <option value="KADER">Kader</option>
              <option value="SEKOLAH">Lokasi Sekolahan</option>
              <option value="GURU">Guru / Pengajar</option>
              <option value="BALAI_RW">Balai RW</option>
            </select>
          </div>

          <div>
            <label htmlFor="org-filter-rw" className="block text-xs font-bold text-slate-600 mb-1">
              Filter RW
            </label>
            <select
              id="org-filter-rw"
              value={rwFilter}
              onChange={(e) => {
                setRwFilter(e.target.value);
                setRtFilter('');
              }}
              className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0F2942]"
            >
              <option value="">Semua RW</option>
              {data?.rw.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nomorRw} — {r.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="org-filter-rt" className="block text-xs font-bold text-slate-600 mb-1">
              Filter RT
            </label>
            <select
              id="org-filter-rt"
              value={rtFilter}
              onChange={(e) => setRtFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-base border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-[#0F2942]"
            >
              <option value="">Semua RT</option>
              {rtOptionsForSelectedRw.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nomorRw} / {t.nomorRt} — {t.nama}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-base text-slate-600">
          Memuat data struktur organisasi Warga Ampel...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-300 rounded-2xl p-6 text-rose-900">
          <p className="font-bold">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-3 px-4 py-2 rounded-lg bg-[#0F2942] text-white text-sm font-bold cursor-pointer"
          >
            Coba Muat Ulang
          </button>
        </div>
      ) : hasActiveFilter ? (
        <section aria-label="Hasil Pencarian Struktur Organisasi" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#0F2942]">
              Hasil Pencarian ({filteredProfiles.length} data ditemukan)
            </h2>
          </div>
          {filteredProfiles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <p className="text-base text-slate-700">
                Tidak ada data pengurus, guru, sekolah, atau Balai RW yang sesuai kata kunci Anda.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 rounded-xl bg-[#0F2942] text-white text-sm font-bold cursor-pointer"
              >
                Tampilkan Semua Struktur
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((p) => (
                <OrgProfileCard
                  key={`${p.kategori}-${p.id}`}
                  profile={p}
                  onSelectDetail={setSelectedProfile}
                />
              ))}
            </div>
          )}
        </section>
      ) : activeMenu === 'kelurahan' ? (
        renderBagianKelurahan(false)
      ) : activeMenu === 'tp_pkk' ? (
        renderBagianTpPkk(false)
      ) : activeMenu === 'lpmk' ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
          {renderBagianLpmk()}
        </section>
      ) : activeMenu === 'rw' ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-2xl font-extrabold text-[#0F2942]">Daftar Pengurus RW</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.rw.map((rwItem) => (
              <OrgProfileCard
                key={rwItem.id}
                profile={rwItem}
                onSelectDetail={setSelectedProfile}
                highlightGold
              />
            ))}
          </div>
        </section>
      ) : activeMenu === 'rt' ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
          {renderBagianRwRt()}
        </section>
      ) : activeMenu === 'kader' ? (
        renderBagianKader()
      ) : activeMenu === 'sekolah_guru' ? (
        renderBagianSekolahGuru()
      ) : activeMenu === 'balai_rw' ? (
        renderBagianBalaiRw()
      ) : (
        <div className="space-y-8">
          {(() => {
            const order = data?.displaySettings.urutanBagian || [];
            const vis = data?.displaySettings.tampilkanBagian;
            const showKel = Boolean(vis?.kelurahan);
            const showPkk = vis?.tpPkk !== false;
            const renderedTopPair =
              showKel &&
              showPkk &&
              Math.abs(order.indexOf('KELURAHAN') - order.indexOf('TP_PKK')) === 1;
            let topPairEmitted = false;

            return order.map((sectionKey) => {
              if (renderedTopPair && (sectionKey === 'KELURAHAN' || sectionKey === 'TP_PKK')) {
                if (topPairEmitted) return null;
                topPairEmitted = true;
                const isKelFirst = order.indexOf('KELURAHAN') < order.indexOf('TP_PKK');
                return (
                  <div
                    key="TOP_PARALLEL_KELURAHAN_TP_PKK"
                    className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start"
                  >
                    {isKelFirst ? (
                      <>
                        {renderBagianKelurahan(true)}
                        {renderBagianTpPkk(true)}
                      </>
                    ) : (
                      <>
                        {renderBagianTpPkk(true)}
                        {renderBagianKelurahan(true)}
                      </>
                    )}
                  </div>
                );
              }
              if (sectionKey === 'KELURAHAN' && showKel) {
                return <React.Fragment key="KELURAHAN">{renderBagianKelurahan(false)}</React.Fragment>;
              }
              if (sectionKey === 'TP_PKK' && showPkk) {
                return <React.Fragment key="TP_PKK">{renderBagianTpPkk(false)}</React.Fragment>;
              }
              if (
                sectionKey === 'LPMK_RW_RT' &&
                (data?.displaySettings.tampilkanBagian.lpmk || data?.displaySettings.tampilkanBagian.rwRt)
              ) {
                return (
                  <section
                    key="LPMK_RW_RT"
                    aria-labelledby="bagian-b-heading"
                    className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-8"
                  >
                    <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#0F2942] text-amber-300 border border-[#D4AF37] flex items-center justify-center shrink-0">
                        <Home className="w-6 h-6" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Bagian B</span>
                        <h2 id="bagian-b-heading" className="font-display text-2xl font-extrabold text-[#0F2942]">
                          Lembaga Kemasyarakatan (LPMK, RW &amp; RT)
                        </h2>
                      </div>
                    </div>
                    {data.displaySettings.tampilkanBagian.lpmk && renderBagianLpmk()}
                    {data.displaySettings.tampilkanBagian.rwRt && renderBagianRwRt()}
                  </section>
                );
              }
              if (sectionKey === 'KADER' && data?.displaySettings.tampilkanBagian.kader) {
                return <React.Fragment key="KADER">{renderBagianKader()}</React.Fragment>;
              }
              if (sectionKey === 'SEKOLAH_GURU' && data?.displaySettings.tampilkanBagian.sekolahGuru !== false) {
                return <React.Fragment key="SEKOLAH_GURU">{renderBagianSekolahGuru()}</React.Fragment>;
              }
              if (sectionKey === 'BALAI_RW' && data?.displaySettings.tampilkanBagian.balaiRw !== false) {
                return <React.Fragment key="BALAI_RW">{renderBagianBalaiRw()}</React.Fragment>;
              }
              return null;
            });
          })()}
        </div>
      )}

      <OrgProfileDetailModal
        profile={selectedProfile}
        onClose={() => setSelectedProfile(null)}
      />
    </main>
  );
};
