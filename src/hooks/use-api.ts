'use client';

import { useState, useEffect } from 'react';
import { Forum, JDownloaderConfig, AIConfig, Download } from '@/lib/types';

// Custom hooks for API calls
export function useForums() {
  const [forums, setForums] = useState<Forum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForums = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/forums');
      const data = await response.json();

      if (data.success) {
        setForums(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch forums');
    } finally {
      setLoading(false);
    }
  };

  const createForum = async (forumData: any) => {
    try {
      const response = await fetch('/api/config/forums', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forumData),
      });

      const data = await response.json();

      if (data.success) {
        await fetchForums();
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to create forum');
      }
    } catch (err) {
      console.error('Error creating forum:', err);
      throw err instanceof Error ? err : new Error('Failed to create forum');
    }
  };

  const updateForum = async (id: string, forumData: any) => {
    try {
      const response = await fetch(`/api/config/forums/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forumData),
      });

      const data = await response.json();

      if (data.success) {
        await fetchForums();
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to update forum');
      }
    } catch (err) {
      console.error('Error updating forum:', err);
      throw err instanceof Error ? err : new Error('Failed to update forum');
    }
  };

  const deleteForum = async (id: string) => {
    try {
      const response = await fetch(`/api/config/forums/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchForums();
      } else {
        throw new Error(data.error || 'Failed to delete forum');
      }
    } catch (err) {
      console.error('Error deleting forum:', err);
      throw err instanceof Error ? err : new Error('Failed to delete forum');
    }
  };

  const testForumConnection = async (forumData: any) => {
    try {
      // Validate required fields
      if (!forumData.name || !forumData.baseUrl) {
        throw new Error('Nombre y URL base son requeridos');
      }

      // Call backend check endpoint
      const response = await fetch('/api/config/forums/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forumData),
      });

      const data = await response.json();

      if (!data.success && data.error) {
        throw new Error(data.error);
      }

      return data.success;
    } catch (err: any) {
      console.error('Forum connection test failed:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchForums();
  }, []);

  return {
    forums,
    loading,
    error,
    refetch: fetchForums,
    createForum,
    updateForum,
    deleteForum,
    testConnection: testForumConnection,
  };
}

export function useJDownloaderConfig() {
  const [config, setConfig] = useState<JDownloaderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/jdownloader');
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch JDownloader config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configData: any) => {
    try {
      const response = await fetch('/api/config/jdownloader', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      throw new Error('Failed to save JDownloader config');
    }
  };

  const testConnection = async (configData: any) => {
    try {
      const response = await fetch('/api/config/jdownloader/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      return false;
    }
  };

  const deleteConfig = async () => {
    try {
      const response = await fetch('/api/config/jdownloader', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to delete JDownloader config');
      }
    } catch (err) {
      console.error('Error deleting JDownloader config:', err);
      throw err instanceof Error ? err : new Error('Failed to delete JDownloader config');
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
    saveConfig,
    testConnection,
    deleteConfig,
  };
}

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/ai');
      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch AI config');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (configData: any) => {
    try {
      const response = await fetch('/api/config/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();

      if (data.success) {
        setConfig(data.data);
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      throw new Error('Failed to save AI config');
    }
  };

  const testConnection = async (configData: any) => {
    try {
      const response = await fetch('/api/config/ai/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData),
      });

      const data = await response.json();
      return data.success;
    } catch (err) {
      return false;
    }
  };

  const deleteConfig = async () => {
    try {
      const response = await fetch('/api/config/ai', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchConfig();
      } else {
        throw new Error(data.error || 'Failed to delete AI config');
      }
    } catch (err) {
      console.error('Error deleting AI config:', err);
      throw err instanceof Error ? err : new Error('Failed to delete AI config');
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  return {
    config,
    loading,
    error,
    refetch: fetchConfig,
    saveConfig,
    testConnection,
    deleteConfig,
  };
}

export function useDownloads() {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/downloads');
      const data = await response.json();

      if (data.success) {
        setDownloads(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch downloads');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    try {
      const response = await fetch('/api/downloads/status');
      const data = await response.json();

      if (data.success) {
        await fetchDownloads(); // Refresh downloads after updating status
      }
    } catch (err) {
      console.error('Failed to update download status:', err);
    }
  };

  const createDownload = async (postUrl: string, forumId: string) => {
    try {
      const response = await fetch('/api/downloads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postUrl, forumId }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchDownloads();
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      throw new Error('Failed to create download');
    }
  };

  useEffect(() => {
    fetchDownloads();

    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    downloads,
    loading,
    error,
    refetch: fetchDownloads,
    updateStatus,
    createDownload,
  };
}

// ARR services management
export function useArrServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/config/arr');
      const data = await res.json();
      if (data.success) setServices(data.data);
      else setError(data.error || 'Failed to fetch services');
    } catch (e) {
      setError('Failed to fetch services');
    } finally {
      setLoading(false);
    }
  };

  const createService = async (payload: { type: 'sonarr' | 'radarr' | 'lidarr' | 'readarr'; name: string; enabled?: boolean; }) => {
    const res = await fetch('/api/config/arr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to create service');
    await fetchServices();
    return data.data;
  };

  const deleteService = async (id: string) => {
    const res = await fetch(`/api/config/arr/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete');
    await fetchServices();
  };

  const toggleService = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/config/arr/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update');
    await fetchServices();
    return data.data;
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return { services, loading, error, refetch: fetchServices, createService, deleteService, toggleService };
}

export function useSearch() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string, forumId?: string) => {
    try {
      setSearching(true);
      setError(null);

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, forumId }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.data.results);
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError('Search failed');
      throw err;
    } finally {
      setSearching(false);
    }
  };

  return {
    results,
    loading,
    searching,
    error,
    search,
  };
}

// Multiple JDownloader instances
export function useJDownloaders() {
  const [instances, setInstances] = useState<JDownloaderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/jdownloader');
      const data = await response.json();

      if (data.success) {
        setInstances(data.instances || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch JDownloader instances');
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async (configData: any) => {
    try {
      const response = await fetch('/api/config/jdownloader', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      const data = await response.json();

      if (data.success) {
        await fetchInstances();
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create JDownloader instance');
    }
  };

  const deleteInstance = async (id: string) => {
    try {
      const response = await fetch(`/api/config/jdownloader?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchInstances();
      } else {
        throw new Error(data.error || 'Failed to delete JDownloader instance');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete JDownloader instance');
    }
  };

  const toggleInstance = async (id: string, enabled: boolean) => {
    try {
      console.log(`[JDownloader Hook] Toggling instance ${id} to ${enabled}`);
      const response = await fetch(`/api/config/jdownloader?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();
      console.log(`[JDownloader Hook] Toggle response:`, data);

      if (data.success) {
        await fetchInstances();
      } else {
        throw new Error(data.error || 'Failed to toggle JDownloader instance');
      }
    } catch (err) {
      console.error('[JDownloader Hook] Toggle error:', err);
      throw err instanceof Error ? err : new Error('Failed to toggle JDownloader instance');
    }
  };

  const testConnection = async (configData: any) => {
    try {
      const response = await fetch('/api/config/jdownloader/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      const data = await response.json();
      return data.success;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  return {
    instances,
    loading,
    error,
    refetch: fetchInstances,
    createInstance,
    deleteInstance,
    toggleInstance,
    testConnection,
  };
}

// Multiple AI Model instances
export function useAIModels() {
  const [models, setModels] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config/ai/list');
      const data = await response.json();

      if (data.success) {
        setModels(data.data || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch AI models');
    } finally {
      setLoading(false);
    }
  };

  const createModel = async (configData: any) => {
    try {
      const response = await fetch('/api/config/ai/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      const data = await response.json();

      if (data.success) {
        await fetchModels();
        return data.data;
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to create AI model');
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const response = await fetch(`/api/config/ai/list/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        await fetchModels();
      } else {
        throw new Error(data.error || 'Failed to delete AI model');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to delete AI model');
    }
  };

  const toggleModel = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/config/ai/list/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchModels();
      } else {
        throw new Error(data.error || 'Failed to toggle AI model');
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to toggle AI model');
    }
  };

  const testConnection = async (configData: any) => {
    try {
      const response = await fetch('/api/config/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData),
      });

      const data = await response.json();
      return data.success;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    loading,
    error,
    refetch: fetchModels,
    createModel,
    deleteModel,
    toggleModel,
    testConnection,
  };
}

// Testing settings hook
export function useTestingSettings() {
  const [bypassAxios, setBypassAxios] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/testing/settings');
      const data = await response.json();

      if (data.success) {
        setBypassAxios(data.data.bypassAxios);
      }
    } catch (err) {
      console.error('Error fetching testing settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newBypassAxios: boolean) => {
    try {
      const response = await fetch('/api/testing/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bypassAxios: newBypassAxios }),
      });

      const data = await response.json();

      if (data.success) {
        setBypassAxios(data.data.bypassAxios);
        return true;
      } else {
        throw new Error(data.error || 'Failed to update settings');
      }
    } catch (err) {
      console.error('Error updating testing settings:', err);
      throw err instanceof Error ? err : new Error('Failed to update settings');
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    bypassAxios,
    loading,
    updateSettings,
  };
}

// Bulk title resolution hook
export function useBulkTitles() {
  const [loading, setLoading] = useState(false);

  const resolveTitles = async (forumId: string, postUrls: string[]) => {
    try {
      setLoading(true);
      const response = await fetch('/api/testing/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forumId, postUrls }),
      });

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to resolve titles');
      }
    } catch (err) {
      console.error('Error resolving titles:', err);
      throw err instanceof Error ? err : new Error('Failed to resolve titles');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    resolveTitles,
  };
}