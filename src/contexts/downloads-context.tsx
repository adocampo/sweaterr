'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface JDownloaderStats {
  total: number;
  downloading: number;
  completed: number;
  failed: number;
  pending: number;
}

interface DownloadsContextValue {
  totalSpeed: number;
  activeDownloadsCount: number;
  jDownloaderStats: JDownloaderStats;
  jDownloaderDownloads: any[];
  dbDownloads: any[];
}

const DownloadsContext = createContext<DownloadsContextValue | undefined>(undefined);

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [totalSpeed, setTotalSpeed] = useState<number>(0);
  const [activeDownloadsCount, setActiveDownloadsCount] = useState<number>(0);
  const [jDownloaderStats, setJDownloaderStats] = useState<JDownloaderStats>({
    total: 0,
    downloading: 0,
    completed: 0,
    failed: 0,
    pending: 0
  });
  const [jDownloaderDownloads, setJDownloaderDownloads] = useState<any[]>([]);

  // Track downloads from DB separately
  const [dbDownloads, setDbDownloads] = useState<any[]>([]);
  
  // Fetch DB downloads periodically (only needed for historical stats)
  useEffect(() => {
    const fetchDbDownloads = async () => {
      try {
        const response = await fetch('/api/downloads');
        const data = await response.json();
        if (data.success && data.data) {
          setDbDownloads(data.data);
        }
      } catch (error) {
        console.error('Error fetching DB downloads:', error);
      }
    };
    
    fetchDbDownloads();
    // Fetch DB downloads every 30 seconds (less frequent since it's just for stats)
    const interval = setInterval(fetchDbDownloads, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const normalizeStatus = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s === 'finished' || s.includes('complete')) return 'completed';
      if (s === 'running' || s === 'downloading') return 'downloading';
      if (s === 'extracting') return 'extracting';
      if (s.includes('fail') || s.includes('error')) return 'failed';
      if (s === 'paused' || s === 'stopped') return 'pending';
      return 'pending';
    };

    const fetchDownloadSpeed = async () => {
      try {
        const response = await fetch('/api/downloads/status');
        const data = await response.json();
        if (data.success && data.data) {
          const normalizedDownloads = data.data.map((d: any) => {
            const normalizedStatus = normalizeStatus(d.status);
            const progressValue = typeof d.progress === 'number' ? d.progress : 0;
            const progressNormalized = normalizedStatus === 'completed' && progressValue < 99 ? 100 : progressValue;
            return { ...d, status: normalizedStatus, progress: progressNormalized };
          });

          const activeDownloading = normalizedDownloads.filter((d: any) => d.status === 'downloading' || d.status === 'extracting');
          const activePending = normalizedDownloads.filter((d: any) => d.status === 'pending');
          const activeCompleted = normalizedDownloads.filter((d: any) => d.status === 'completed').length;
          const activeFailed = normalizedDownloads.filter((d: any) => d.status === 'failed').length;

          const activeIds = new Set(normalizedDownloads.map((d: any) => d.uuid || d.jDownloaderId));
          const dbCompleted = dbDownloads.filter((d) => d.status === 'completed' && (!d.jDownloaderId || !activeIds.has(d.jDownloaderId))).length;
          const dbFailed = dbDownloads.filter((d) => d.status === 'failed' && (!d.jDownloaderId || !activeIds.has(d.jDownloaderId))).length;

          const speed = activeDownloading.reduce((sum: number, d: any) => sum + (d.speed || 0), 0);

          setTotalSpeed(speed);
          setActiveDownloadsCount(activeDownloading.length);
          setJDownloaderStats({
            total: normalizedDownloads.length + dbCompleted + dbFailed,
            downloading: activeDownloading.length,
            completed: activeCompleted + dbCompleted,
            failed: activeFailed + dbFailed,
            pending: activePending.length,
          });
          setJDownloaderDownloads(normalizedDownloads.sort((a: any, b: any) => {
            const statusOrder: Record<string, number> = {
              'running': 0,
              'downloading': 0,
              'extracting': 0,
              'pending': 1,
              'completed': 2,
              'failed': 3
            };
            const aOrder = statusOrder[a.status.toLowerCase()] ?? 4;
            const bOrder = statusOrder[b.status.toLowerCase()] ?? 4;
            return aOrder - bOrder;
          }));
        }
      } catch (error) {
        console.error('Error fetching download speed:', error);
      }
    };

    fetchDownloadSpeed();
    const interval = setInterval(fetchDownloadSpeed, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DownloadsContext.Provider value={{ totalSpeed, activeDownloadsCount, jDownloaderStats, jDownloaderDownloads, dbDownloads }}>
      {children}
    </DownloadsContext.Provider>
  );
}

export function useDownloadsContext() {
  const context = useContext(DownloadsContext);
  if (context === undefined) {
    throw new Error('useDownloadsContext must be used within a DownloadsProvider');
  }
  return context;
}
