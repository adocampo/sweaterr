import { APP_NAME, APP_VERSION } from '@/lib/utils';

export function Footer() {
  return (
    <footer className="w-full py-3 text-center text-xs text-muted-foreground border-t border-border/50 mt-auto">
      <div className="flex items-center justify-center gap-1.5">
        <span>{APP_NAME}</span>
        <span className="text-muted-foreground/40">•</span>
        <span>v{APP_VERSION}</span>
      </div>
    </footer>
  );
}
