// Common types used across the application

export interface Forum {
  id: string;
  name: string;
  baseUrl: string;
  searchPath: string;
  searchMode?: 'native' | 'google_site' | 'google_cse';
  searchForumLabel?: string | null;
  searchInChildForums?: boolean | null;
  sabnzbdCategory?: string;
  cseId?: string;
  enabled: boolean;
  thankButtonSelector?: string;
  linksContainerSelector?: string;
  postTitleSelector?: string;
  credentials?: ForumCredential;
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumCredential {
  id: string;
  forumId: string;
  username: string;
  password: string;
}

export interface JDownloaderConfig {
  id: string;
  deviceName: string;
  email: string;
  password: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIConfig {
  id: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchHistory {
  id: string;
  query: string;
  forumName: string;
  resultCount: number;
  success: boolean;
  createdAt: Date;
}

export interface Download {
  id: string;
  title: string;
  sourceUrl: string;
  forumName: string;
  jDownloaderId?: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  size?: string;
  createdAt: Date;
  updatedAt: Date;
  notifications?: ArrNotification[];
}

export interface ArrNotification {
  id: string;
  arrType: 'sonarr' | 'radarr' | 'lidarr';
  arrUrl: string;
  apiKey: string;
  downloadId: string;
  notified: boolean;
  createdAt: Date;
  download?: Download;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Configuration types
export interface ForumConfigForm {
  name: string;
  baseUrl: string;
  searchPath?: string;
  searchMode?: 'native' | 'google_site' | 'google_cse';
  searchForumLabel?: string;
  searchInChildForums?: boolean;
  searchTitleOnly?: boolean;
  cseId?: string;
  sabnzbdCategory?: string;
  qbittorrentUrlBase?: string;
  defaultLanguage?: string;
  thankButtonSelector?: string;
  linksContainerSelector?: string;
  postTitleSelector?: string;
  useFlaresolverr?: boolean;
  useFlaresolverr?: boolean;
  username?: string;
  password?: string;
  flaresolverrSessionTTL?: number;
}

export interface JDownloaderConfigForm {
  deviceName: string;
  email: string;
  password: string;
}

export interface AIConfigForm {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

// Search types
export interface SearchResult {
  title: string;
  url: string;
  forum: string;
  date?: string;
  author?: string;
  replies?: number;
  views?: number;
  hasLinks?: boolean;
  thankRequired?: boolean;
  relevanceScore?: number;
  sceneMapping?: SceneMapping;
}

export interface SceneMapping {
  originalTitle: string;
  sceneName: string;
  season?: number;
  episode?: number;
  quality?: string;
  source?: string;
  releaseGroup?: string;
}

// JDownloader types
export interface JDownloaderDevice {
  id: string;
  name: string;
  type: string;
  status: string;
}

export interface JDownloaderDownload {
  uuid: string;
  name: string;
  host: string;
  size: number;
  status: string;
  progress: number;
  speed: number;
  eta: number;
}

// Sonarr/Radarr types
export interface ArrConfig {
  type: 'sonarr' | 'radarr' | 'lidarr';
  url: string;
  apiKey: string;
  enabled: boolean;
}

export interface ArrRelease {
  guid: string;
  title: string;
  size: number;
  quality: string;
  indexer: string;
  downloadUrl?: string;
  seeders?: number;
  leechers?: number;
  protocol: 'torrent' | 'usenet' | 'direct';
  publishDate: string;
}

// UI State types
export interface ConfigState {
  forums: Forum[];
  jdownloader: JDownloaderConfig | null;
  ai: AIConfig | null;
  loading: boolean;
  error?: string;
}

export interface DownloadsState {
  downloads: Download[];
  jdownloaderDownloads: JDownloaderDownload[];
  loading: boolean;
  error?: string;
}

export interface SearchState {
  results: SearchResult[];
  loading: boolean;
  searching: boolean;
  query: string;
  selectedForum?: string;
  error?: string;
}

// Component props types
export interface ConfigCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting' | 'error';
  label?: string;
  className?: string;
}

export interface ProgressBarProps {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Form validation types
export interface FormErrors {
  [key: string]: string | undefined;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: any) => string | undefined;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'select' | 'textarea' | 'checkbox';
  placeholder?: string;
  options?: { value: string; label: string }[];
  validation?: ValidationRule;
  description?: string;
}

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

// Log types
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  metadata?: Record<string, any>;
}