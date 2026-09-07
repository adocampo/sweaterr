'use client';

import { useEffect, useState } from 'react';
import { cn, APP_NAME, APP_VERSION } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard,
  Globe,
  FlaskConical,
  Download,
  Settings,
  ChevronDown,
  Plug,
  Users,
  FileText,
  HardDrive,
  Menu,
  X,
} from 'lucide-react';
import { useI18n } from '@/hooks/use-i18n';

interface NavItem {
  id: string;
  label: (t: any) => string;
  icon: React.ComponentType<{ className?: string }>;
  isAdmin?: boolean;
  children?: Array<{
    id: string;
    label: (t: any) => string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const navItems: NavItem[] = [
  { id: 'overview', label: (t) => t('dashboard.overview'), icon: LayoutDashboard },
  { id: 'testing', label: (t) => t('dashboard.testing'), icon: FlaskConical },
  { id: 'downloads', label: (t) => t('dashboard.downloads'), icon: Download },
  {
    id: 'settings',
    label: (t) => t('dashboard.configuration'),
    icon: Settings,
    isAdmin: true,
    children: [
      { id: 'settings-connections', label: (t) => t('dashboard.connections'), icon: Plug },
      { id: 'settings-forums', label: (t) => t('dashboard.forums'), icon: Globe },
      { id: 'settings-users', label: (t) => t('dashboard.userManagement'), icon: Users },
      { id: 'settings-logs', label: (t) => t('logs.title'), icon: FileText },
      { id: 'settings-backup', label: (t) => t('dashboard.backupRestore'), icon: HardDrive },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeSection: string;
  onSectionChange: (section: string) => void;
  isAdmin: boolean;
  language?: 'es' | 'en';
}

export function Sidebar({ collapsed, onToggle, activeSection, onSectionChange, isAdmin, language = 'es' }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useI18n(language);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Defer route check to client-side to avoid hydration mismatch
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const shouldShowSidebar = isHydrated && !(pathname?.includes('/api/') || pathname?.includes('/login') || pathname?.includes('/setup'));

  if (!shouldShowSidebar) {
    return null;
  }

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={onToggle}
        className="fixed left-4 top-4 z-50 rounded-md border bg-background p-2 shadow-md md:hidden"
        aria-label={collapsed ? t('sidebar.openMenu') : t('sidebar.closeMenu')}
      >
        {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-background transition-all duration-300',
          // Mobile: hidden off-canvas or full overlay; desktop: fixed width
          collapsed
            ? '-translate-x-full md:translate-x-0 md:w-16'
            : 'w-64 translate-x-0'
        )}
      >
      <div className="border-b p-2">
        <button
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-accent hover:text-accent-foreground'
          )}
          title={APP_NAME}
        >
          <div className="relative h-6 w-6 flex-shrink-0">
            <Image src="/logo.png" alt={APP_NAME} fill className="object-contain" />
          </div>
          {!collapsed && <span className="flex-1 text-left font-semibold">{APP_NAME}</span>}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navItems
          .filter((item) => !item.isAdmin || isAdmin)
          .map((item) => {
            const Icon = item.icon;
            const childIds = item.children?.map((c) => c.id) || [];
            const isChildActive = childIds.includes(activeSection);
            const isExpanded = expandedId === item.id || isChildActive;

            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => {
                    if (item.children) {
                      setExpandedId((prev) => (prev === item.id ? null : item.id));
                    } else {
                      onSectionChange(item.id);
                    }
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isChildActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                  title={collapsed ? item.label(t) : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{item.label(t)}</span>}
                  {!collapsed && item.children && (
                    <ChevronDown className={cn('h-4 w-4 flex-shrink-0 transition-transform', isExpanded ? 'rotate-180' : '')} />
                  )}
                </button>

                {collapsed && item.children && (
                  <div className="space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = activeSection === child.id;

                      return (
                        <button
                          key={child.id}
                          onClick={() => onSectionChange(child.id)}
                          className={cn(
                            'flex w-full items-center justify-center rounded-md px-3 py-2 transition-colors',
                            childActive
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/60 hover:text-accent-foreground'
                          )}
                          title={child.label(t)}
                        >
                          <ChildIcon className="h-4 w-4 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}

                {!collapsed && item.children && isExpanded && (
                  <div className="ml-4 space-y-1 border-l pl-2">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = activeSection === child.id;

                      return (
                        <button
                          key={child.id}
                          onClick={() => onSectionChange(child.id)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                            childActive
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-accent/60 hover:text-accent-foreground'
                          )}
                        >
                          <ChildIcon className="h-4 w-4 flex-shrink-0" />
                          <span>{child.label(t)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

        <div className="border-t p-2">
          {collapsed ? (
            <div className="flex justify-center">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            </div>
          ) : (
            <div className="p-2 text-center text-xs text-muted-foreground">
              {APP_NAME} v{APP_VERSION}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
