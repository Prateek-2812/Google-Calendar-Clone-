import { useState } from 'react';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import DraftBanner from '@/components/calendar/DraftBanner';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * AppShell — the outer chrome of the authenticated calendar view.
 *
 * Structure:
 *   ┌─────────────────────────────────┐ ← fixed header (h-16)
 *   ├───────────┬─────────────────────┤
 *   │  Sidebar  │   main content      │ ← fills remaining viewport height
 *   │  (fixed)  │   (scrollable)      │
 *   └───────────┴─────────────────────┘
 *
 * The sidebar is collapsible via the hamburger button in the header.
 * On desktop (md+) the sidebar is open by default; on mobile it overlays.
 */
export default function AppShell({ children }: AppShellProps) {
  // Sidebar starts open on md+ screens.
  // We detect by reading innerWidth at mount — simple and avoids SSR issues.
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev);
  }

  return (
    <div className="h-screen-safe flex flex-col bg-white overflow-hidden">
      {/* ── Fixed top header ── */}
      <AppHeader sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      {/* ── Body below the header ── */}
      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Sidebar (fixed position, slides in/out) */}
        <Sidebar open={sidebarOpen} />

        {/* Main content area — shifts right when sidebar is open on md+ */}
        <main
          id="calendar-main"
          className={cn(
            'flex-1 overflow-hidden flex flex-col',
            'transition-[margin] duration-200 ease-in-out',
            // On desktop, indent by sidebar width when open
            sidebarOpen ? 'md:ml-64' : 'md:ml-0',
          )}
        >
          <DraftBanner />
          {children}
        </main>
      </div>
    </div>
  );
}
