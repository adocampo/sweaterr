'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Download, Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/hooks/use-i18n';

interface ConfigBackupProps {
  language?: 'es' | 'en';
}

export function ConfigBackup({ language = 'es' }: ConfigBackupProps) {
  const { t } = useI18n(language);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/config/export', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Export failed');
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `sweaterr-config-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: t('configBackup.exportSuccess') });
    } catch (error) {
      toast({
        title: t('configBackup.exportError'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setConfirmOpen(true);
    }
    e.target.value = '';
  };

  const handleImportConfirmed = async () => {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const text = await pendingFile.text();
      const json = JSON.parse(text);
      const res = await fetch('/api/config/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Import failed');
      }
      toast({ title: t('configBackup.importSuccess') });
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: t('configBackup.importError'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      setPendingFile(null);
      setConfirmOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          {t('configBackup.title')}
        </CardTitle>
        <CardDescription>{t('configBackup.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExport} disabled={exporting} variant="outline">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {t('configBackup.export')}
          </Button>

          <Button onClick={() => fileInputRef.current?.click()} disabled={importing} variant="outline">
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {t('configBackup.import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('configBackup.importConfirmTitle')}</AlertDialogTitle>
              <AlertDialogDescription>{t('configBackup.importConfirmDescription')}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingFile(null)}>{t('common.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleImportConfirmed}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('configBackup.importConfirmAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
