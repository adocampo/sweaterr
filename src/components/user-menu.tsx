'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/hooks/use-i18n';
import { User, LogOut, Languages, Moon, Sun } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface UserMenuProps {
  user?: {
    id: string;
    email: string;
    role: string;
    language: string;
    theme: string;
  };
  onThemeChange?: (theme: 'light' | 'dark') => void;
  currentTheme?: 'light' | 'dark';
}

export function UserMenu({ user, onThemeChange, currentTheme = 'dark' }: UserMenuProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState(user?.language || 'es');
  const { t } = useI18n(language as 'es' | 'en');

  const handleLanguageChange = async (lang: 'es' | 'en') => {
    setLanguage(lang);
    try {
      await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang }),
      });
      // Refresh page to update i18n
      window.location.reload();
    } catch (error) {
      console.error('Failed to update language:', error);
    }
  };

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    try {
      await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      onThemeChange?.(theme);
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
      >
        <User className="h-5 w-5" />
      </Button>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-sm font-medium">{user.email}</span>
          <span className="text-xs text-slate-500">{user.role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Language submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Languages className="mr-2 h-4 w-4" />
            <span>{t('userMenu.language')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => handleLanguageChange('es')}
              className={language === 'es' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              Español
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleLanguageChange('en')}
              className={language === 'en' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              English
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Theme submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Moon className="mr-2 h-4 w-4" />
            <span>{t('userMenu.theme')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={() => handleThemeChange('light')}
              className={currentTheme === 'light' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              <Sun className="mr-2 h-4 w-4" />
              {t('userMenu.light')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleThemeChange('dark')}
              className={currentTheme === 'dark' ? 'bg-slate-100 dark:bg-slate-800' : ''}
            >
              <Moon className="mr-2 h-4 w-4" />
              {t('userMenu.dark')}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          disabled={isLoading}
          className="text-red-600 dark:text-red-400 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            <>
              <LogOut className="mr-2 h-4 w-4" />
              {t('userMenu.logout')}
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
