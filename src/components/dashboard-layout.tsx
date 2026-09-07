import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {children}
    </div>
  );
}
