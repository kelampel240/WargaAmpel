import React, { useEffect, useState } from 'react';
import { PublicUserSession, ServiceWithForm, SheetPengumuman } from './shared/types';
import { apiFetch, clearAuth, getStoredToken, getStoredUser } from './lib/api';
import { Navbar, PublicRoute } from './components/Navbar';
import { CitizenHome, WizardEntryMode } from './components/CitizenHome';
import { ReportWizard } from './components/ReportWizard';
import { TrackReportView } from './components/TrackReportView';
import { AuthModal } from './components/AuthModal';
import { CitizenDashboard } from './components/CitizenDashboard';
import { AdminDashboard, SidebarModule } from './components/AdminDashboard';
import { OrgPublicPortal } from './components/OrgPublicPortal';

export default function App() {
  const [route, setRoute] = useState<PublicRoute>('home');
  const [wizardState, setWizardState] = useState<{
    open: boolean;
    mode: WizardEntryMode;
    preselected?: ServiceWithForm;
  }>({ open: false, mode: 'pengaduan' });

  const [trackPrefill, setTrackPrefill] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<SidebarModule>('dashboard');

  const [user, setUser] = useState<PublicUserSession | null>(() => getStoredUser());
  const [services, setServices] = useState<ServiceWithForm[]>([]);
  const [announcements, setAnnouncements] = useState<SheetPengumuman[]>([]);

  const loadPublicData = async () => {
    try {
      const [svcRes, annRes] = await Promise.all([
        apiFetch<{ services: ServiceWithForm[] }>('/api/public/services'),
        apiFetch<{ announcements: SheetPengumuman[] }>('/api/public/announcements'),
      ]);
      setServices(svcRes.services);
      setAnnouncements(annRes.announcements);
    } catch (err) {
      console.error('Gagal memuat data publik WARGA AMPEL:', err);
    }
  };

  useEffect(() => {
    loadPublicData();
    if (getStoredToken()) {
      apiFetch<{ user: PublicUserSession }>('/api/auth/me')
        .then((res) => setUser(res.user))
        .catch(() => {
          clearAuth();
          setUser(null);
        });
    }
  }, []);

  const handleNavigate = (nextRoute: PublicRoute) => {
    setWizardState((w) => ({ ...w, open: false }));
    if (nextRoute === 'admin' && (!user || user.role === 'WARGA')) {
      setShowAuthModal(true);
      return;
    }
    if (nextRoute === 'admin') {
      setAdminInitialTab('dashboard');
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartWizard = (mode: WizardEntryMode, preselected?: ServiceWithForm) => {
    setWizardState({ open: true, mode, preselected });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthSuccess = (authedUser: PublicUserSession) => {
    setUser(authedUser);
    setShowAuthModal(false);
    setWizardState((w) => ({ ...w, open: false }));
    if (authedUser.role === 'WARGA') {
      setRoute('citizen-dashboard');
    } else {
      setRoute('admin');
    }
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setRoute('home');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeRoute={route}
        onNavigate={handleNavigate}
        user={user}
        onOpenAuth={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1">
        {wizardState.open ? (
          <ReportWizard
            mode={wizardState.mode}
            services={services}
            preselectedService={wizardState.preselected}
            user={user}
            onCancel={() => setWizardState((w) => ({ ...w, open: false }))}
            onTrackTicket={(ticketId) => {
              setWizardState((w) => ({ ...w, open: false }));
              setTrackPrefill(ticketId);
              setRoute('track');
            }}
          />
        ) : route === 'track' ? (
          <TrackReportView key={trackPrefill} initialTicketId={trackPrefill} />
        ) : route === 'struktur' ? (
          <OrgPublicPortal />
        ) : route === 'citizen-dashboard' && user ? (
          <CitizenDashboard
            user={user}
            onNewReport={() => handleStartWizard('pengaduan')}
          />
        ) : route === 'admin' && user && user.role !== 'WARGA' ? (
          <AdminDashboard
            user={user}
            initialTab={adminInitialTab}
            onServicesChanged={loadPublicData}
          />
        ) : (
          <CitizenHome
            services={services}
            announcements={announcements}
            activeSection={
              route === 'services'
                ? 'services'
                : route === 'announcements'
                ? 'announcements'
                : 'home'
            }
            onStartWizard={handleStartWizard}
            onGoTrack={() => handleNavigate('track')}
            onGoAllAnnouncements={() => handleNavigate('announcements')}
            onGoStruktur={() => handleNavigate('struktur')}
          />
        )}
      </div>

      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600">
          <p>WARGA AMPEL — Sistem Informasi Pelayanan Warga Desa Ampel</p>
        </div>
      </footer>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
