// Multi-provider AI service for mapping and ranking
export interface SceneMapping {
  originalTitle: string;
  sceneName: string;
  season?: number;
  episode?: number;
  quality?: string;
  source?: string;
  releaseGroup?: string;
}

export interface AISearchResult {
  title: string;
  url: string;
  forum: string;
  relevanceScore: number;
  sceneMapping?: SceneMapping;
}

export interface AudioTrack {
  language: string;
  codec?: string | null;
  channels?: string | null;
}

/** Facts resolved from an external movie database, used to ground the prompt. */
export interface TitleFacts {
  type: 'series' | 'movie';
  title: string;
  originalTitle: string;
  originalLanguage: string;
  year: number | null;
  genres: string[];
}

export interface MediaMetadata {
  type: 'series' | 'movie' | 'unknown';
  title?: string | null;
  cleanTitle?: string | null;
  year?: number | null;
  season?: number | null;
  quality?: string | null;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  episodesAvailable?: number | null;
  episodesTotal?: number | null;
  genres?: string[];
  size?: string | null;
  /** Whether subtitles exist, even when their languages are unknown. */
  subtitlesPresent?: 'yes' | 'no' | 'unknown';
  audioTracks?: AudioTrack[];
}

export interface AIProviderConfig {
  provider: string; // openai, openai-compatible, github-models, perplexity, deepseek, ollama
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export interface ProviderSpec {
  label: string;
  defaultBaseUrl?: string;
  chatPath: string;
  modelsPath?: string;
  requiresApiKey: boolean;
  requiresBaseUrl?: boolean;
  defaultModel?: string;
  fallbackModels: string[];
}

export const AI_PROVIDERS: Record<string, ProviderSpec> = {
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    requiresApiKey: true,
    defaultModel: 'gpt-4o-mini',
    fallbackModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
  },
  'openai-compatible': {
    label: 'OpenAI compatible (llama.cpp / LM Studio / vLLM)',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    requiresApiKey: false,
    requiresBaseUrl: true,
    fallbackModels: [],
  },
  openwebui: {
    // Open WebUI serves the OpenAI-compatible API under /api, not /v1.
    label: 'Open WebUI',
    chatPath: 'api/chat/completions',
    modelsPath: 'api/models',
    requiresApiKey: true,
    requiresBaseUrl: true,
    fallbackModels: [],
  },
  'github-models': {
    label: 'GitHub Models',
    defaultBaseUrl: 'https://models.github.ai/inference',
    chatPath: 'chat/completions',
    modelsPath: 'https://models.github.ai/catalog/models',
    requiresApiKey: true,
    defaultModel: 'openai/gpt-4o-mini',
    fallbackModels: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'meta/Llama-3.3-70B-Instruct'],
  },
  deepseek: {
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    chatPath: 'v1/chat/completions',
    modelsPath: 'v1/models',
    requiresApiKey: true,
    defaultModel: 'deepseek-chat',
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  perplexity: {
    label: 'Perplexity',
    defaultBaseUrl: 'https://api.perplexity.ai',
    chatPath: 'chat/completions',
    requiresApiKey: true,
    defaultModel: 'sonar',
    fallbackModels: ['sonar', 'sonar-pro'],
  },
  ollama: {
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434',
    chatPath: 'api/generate',
    modelsPath: 'api/tags',
    requiresApiKey: false,
    fallbackModels: ['llama3', 'mistral', 'gemma'],
  },
};

function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Users type the base URL with or without `/v1`, and sometimes the full endpoint. */
export function resolveEndpoint(rawBase: string | undefined, spec: ProviderSpec, path: string): string {
  const base = (rawBase?.trim() || spec.defaultBaseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Base URL is required for this provider');
  if (/\/(chat\/completions|completions|api\/generate|api\/tags|models)$/i.test(base)) return base;
  return joinUrl(base.replace(/\/(v1|api)$/i, ''), path);
}

/** Local models wrap JSON in code fences and qwen emits <think> blocks before it. */
export function extractJsonBlock(raw: string): string | null {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();

  const start = text.search(/[{[]/);
  if (start === -1) return null;
  const closer = text[start] === '{' ? '}' : ']';
  const end = text.lastIndexOf(closer);
  if (end <= start) return null;
  return text.slice(start, end + 1);
}

export function parseJsonLoose<T = any>(raw: string | null): T | null {
  if (!raw) return null;
  const candidate = extractJsonBlock(raw);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

/** Fields the deterministic pipeline could not resolve, so the model knows what to look for. */
function listMissingFields(known: MediaMetadata): string[] {
  const missing: string[] = [];
  if (known.type === 'unknown') missing.push('type');
  if (known.year == null) missing.push('year');
  if (!known.quality) missing.push('quality');
  if (!known.audioLanguages?.length) missing.push('audioLanguages');
  if (!known.audioTracks?.length) missing.push('audioTracks (codec and channels per track)');
  if (!known.subtitleLanguages?.length) missing.push('subtitleLanguages');
  if (known.subtitlesPresent !== 'yes' && known.subtitlesPresent !== 'no') missing.push('subtitlesPresent');
  if (!known.genres?.length) missing.push('genres');
  if (!known.size) missing.push('size');
  if (known.episodesAvailable == null) missing.push('episodesAvailable');
  if (known.episodesTotal == null) missing.push('episodesTotal');
  return missing;
}

function stripEmpty(metadata: MediaMetadata): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => {
      if (value == null || value === 'unknown') return false;
      return !(Array.isArray(value) && value.length === 0);
    })
  );
}

export class AIService {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    // Keys pasted from a web UI often carry stray whitespace, which servers reject as invalid.
    this.config = {
      ...config,
      apiKey: config.apiKey?.trim() || undefined,
      baseUrl: config.baseUrl?.trim() || undefined,
      model: config.model?.trim() || undefined,
    };
  }

  /** Ask the provider which models it actually serves; falls back to the static list. */
  async listModels(): Promise<string[]> {
    const { provider, apiKey, baseUrl } = this.config;
    const spec = AI_PROVIDERS[provider];
    if (!spec) throw new Error(`Unknown AI provider: ${provider}`);
    if (!spec.modelsPath) return spec.fallbackModels;

    const endpoint = resolveEndpoint(baseUrl, spec, spec.modelsPath);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await this.fetchWithTimeout(endpoint, { method: 'GET', headers }, 15000);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText || ''}`.trim());
    }

    const data = await response.json();
    const raw: any[] = Array.isArray(data) ? data : data?.data || data?.models || [];
    const models = raw
      .map((item) => (typeof item === 'string' ? item : item?.id || item?.name || item?.model))
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    return Array.from(new Set(models)).sort();
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs}ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Map pretty forum titles to scene names using AI
  async mapToSceneName(forumTitle: string, searchQuery: string): Promise<SceneMapping | null> {
    try {
      const prompt = `You are a media metadata expert. Given a forum post title and a search query, extract structured information.

Forum Title: "${forumTitle}"
Search Query: "${searchQuery}"

Extract:
- Scene-style name
- Season (if TV show)
- Episode (if TV show)
- Quality (e.g., 1080p, 720p, 4K)
- Source (e.g., WEB-DL, BluRay, HDRip)
- Release group (if present)

Return JSON only, no explanations.`;

      const response = await this.callAI(prompt, { json: true });
      const parsed = parseJsonLoose<any>(response);
      if (!parsed) return null;

      return {
        originalTitle: forumTitle,
        sceneName: parsed.sceneName || forumTitle,
        season: parsed.season ? parseInt(parsed.season) : undefined,
        episode: parsed.episode ? parseInt(parsed.episode) : undefined,
        quality: parsed.quality,
        source: parsed.source,
        releaseGroup: parsed.releaseGroup,
      };
    } catch (error) {
      console.error('AI mapping error:', error);
      return null;
    }
  }

  // Rank search results by relevance
  async rankResults(results: AISearchResult[], searchQuery: string): Promise<AISearchResult[]> {
    if (results.length === 0) return [];

    try {
      const prompt = `You are a search ranking expert. Given a search query and a list of forum post titles, rank them by relevance (0-1 score).

Search Query: "${searchQuery}"

Posts:
${results.map((r, i) => `${i + 1}. ${r.title} [${r.forum}]`).join('\n')}

Return JSON array with indices and scores: [{"index": 0, "score": 0.95}, ...]`;

      const response = await this.callAI(prompt, { json: true });
      const rankings = parseJsonLoose<any[]>(response);
      if (!Array.isArray(rankings)) return results;

      return results
        .map((r, i) => ({
          ...r,
          relevanceScore: rankings.find((rank: any) => rank.index === i)?.score || 0.5,
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('AI ranking error:', error);
      return results;
    }
  }

  // Extract quality information from title
  async extractQualityInfo(title: string): Promise<{
    quality?: string;
    source?: string;
    codec?: string;
    releaseGroup?: string;
  }> {
    try {
      const prompt = `Extract video quality metadata from this title:

"${title}"

Return JSON: {"quality": "1080p", "source": "WEB-DL", "codec": "x264", "releaseGroup": "..."} or empty object if none found.`;

      const response = await this.callAI(prompt, { json: true });
      return parseJsonLoose<any>(response) || {};
    } catch (error) {
      console.error('Quality extraction error:', error);
      return {};
    }
  }

  // Generate search suggestions
  async generateSearchSuggestions(partialQuery: string): Promise<string[]> {
    try {
      const prompt = `Given this partial search query: "${partialQuery}"

Generate 5 relevant search completions for movies/TV shows. Return JSON array of strings.`;

      const response = await this.callAI(prompt);

      if (!response) return [];

      try {
        return JSON.parse(response);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Suggestions error:', error);
      return [];
    }
  }

  // Extract structured metadata (series/movie) from page context
  async extractMediaMetadata(context: {
    title: string;
    breadcrumbs?: string;
    contentSnippet?: string;
    searchQuery?: string;
    forumDefaultLanguage?: string;
    /** Opening post of the thread: synopsis, year and technical sheet. */
    postText?: string;
    reference?: TitleFacts | null;
    /** What the deterministic pipeline already resolved; the model only fills the gaps. */
    known?: MediaMetadata | null;
  }): Promise<MediaMetadata | null> {
    const { title, breadcrumbs, contentSnippet, searchQuery, forumDefaultLanguage, postText, reference, known } = context;
    const forumLang = forumDefaultLanguage || 'es-ES';

    const referenceBlock = reference
      ? `Verified facts from a movie database (trust these over your own recollection):
- Canonical title: ${reference.title}${reference.originalTitle && reference.originalTitle !== reference.title ? ` (original: ${reference.originalTitle})` : ''}
- Type: ${reference.type}
- Original language: ${reference.originalLanguage || 'unknown'}
- Year: ${reference.year ?? 'unknown'}
- Genres: ${reference.genres.length ? reference.genres.join(', ') : 'unknown'}`
      : '(no external reference available)';

    const missing = known ? listMissingFields(known) : [];
    const knownBlock = known
      ? `Already resolved without you (keep these values, do not contradict them):
${JSON.stringify(stripEmpty(known), null, 2)}

Fields still MISSING that you must resolve: ${missing.length ? missing.join(', ') : '(none, just confirm)'}`
      : '(nothing resolved yet, fill every field you can)';

    const prompt = `You are a media librarian parsing releases from a Spanish download forum.

Forum Title: ${title}
Breadcrumbs: ${breadcrumbs || '(none)'}
Search Query: ${searchQuery || '(none)'}
Content Snippet (may be truncated): ${contentSnippet || '(empty)'}

Opening Post (complete) — this is the release's own datasheet, it is the most reliable
source for every missing field. Read it in full. Look for sections titled "DATOS TÉCNICOS",
"FICHA TÉCNICA" or "MEDIAINFO", and for lines like "Audio: ...", "Idioma: ...", "Subtítulos: ...",
"Calidad: ...", "Tamaño: ...", "Género: ...". A MEDIAINFO block lists one entry per track ("Audio #1 ... Idioma: Castellano"):
--- BEGIN POST ---
${postText || '(empty)'}
--- END POST ---

${referenceBlock}

${knownBlock}

The forum's default media language is "${forumLang}".

Rules for audio and subtitles:
- Prefer the opening post over the title: the post lists every track explicitly.
- Language names and tags are Spanish: "Cas"/"Castellano"/"Esp" = es-ES, "Lat"/"Latino" = es-LA,
  "Ing"/"Inglés"/"VO" = en, "Fra"/"Francés" = fr, "Ale"/"Alemán" = de, "Ita"/"Italiano" = it.
- In both the title and the post, tracks are separated by "/", "|" or "·".
  "Castellano E-AC3 DDP 5.1 · Inglés E-AC3 DDP 5.1" is TWO tracks.
  "[Ing eAC3+Atmos 5.1 / Cas eAC3 5.1]" is TWO tracks: en (eAC3+Atmos, 5.1) and es-ES (eAC3, 5.1).
  Inside one track, "+" joins codec features, it does NOT separate languages.
- "Subtítulos: Castellano [Completos] · Inglés [Completos]" means subtitleLanguages ["es-ES", "en"].
- "Subs Cas/Ing" means subtitle tracks in es-ES and en.
- "+Sub", "+Subs" or a bare "Subs" means subtitles EXIST but the language is unstated:
  return "subtitleLanguages": [] and "subtitlesPresent": "yes".
- "Dual" means two audio tracks: the work's ORIGINAL language plus the forum language "${forumLang}".
  ${reference?.originalLanguage
        ? `For this title the original language is "${reference.originalLanguage}", so "Dual" = ["${reference.originalLanguage}", "${forumLang}"].`
        : 'Infer the original language from the production country of the title.'}
- "VOSE" means original-language audio with es-ES subtitles.
- Never invent a language that neither the title nor the post supports. Use "subtitlesPresent": "unknown"
  when nothing suggests subtitles, and "no" only when the post explicitly says there are none.

Rules for year and genres:
- Take "year" and "genres" from the verified facts when available, otherwise from the opening post.
- When "genres" is listed among the missing fields and the opening post contains a "Género" section,
  you MUST copy every listed genre into the "genres" array.
- Genres must be plain nouns in Spanish (e.g. "Drama", "Ciencia ficción"), never tags or codecs.
- Leave "genres" empty rather than guessing.

Return JSON with keys:
{
  "type": "series|movie|unknown",
  "title": "clean name without tags",
  "year": 2024,
  "season": 1,
  "quality": "1080p WEB-DL",
  "audioLanguages": ["en", "es-ES"],
  "audioTracks": [{"language": "en", "codec": "eAC3+Atmos", "channels": "5.1"}],
  "subtitleLanguages": ["es-ES"],
  "subtitlesPresent": "yes|no|unknown",
  "episodesAvailable": 10,
  "episodesTotal": 10,
  "genres": ["Ciencia ficción"],
  "size": "14.3 GB"
}
Include every field listed as missing, using null, [], or "unknown" only when the opening post does not provide it. Only include numeric fields when present. Use ISO-like language codes. Return JSON only.`;

    const response = await this.callAIOrThrow(prompt, { json: true });
    const parsed = parseJsonLoose<any>(response);
    if (!parsed) return null;

    const audioTracks: AudioTrack[] = Array.isArray(parsed.audioTracks)
      ? parsed.audioTracks
          .filter((track: any) => track && typeof track.language === 'string')
          .map((track: any) => ({
            language: track.language,
            codec: track.codec ?? null,
            channels: track.channels ?? null,
          }))
      : [];

    const audioLanguages = Array.isArray(parsed.audioLanguages) && parsed.audioLanguages.length
      ? parsed.audioLanguages.filter((lang: any) => typeof lang === 'string')
      : audioTracks.map((track) => track.language);

    const subtitleLanguages = Array.isArray(parsed.subtitleLanguages)
      ? parsed.subtitleLanguages.filter((lang: any) => typeof lang === 'string')
      : [];

    const declaredPresence = ['yes', 'no', 'unknown'].includes(parsed.subtitlesPresent)
      ? parsed.subtitlesPresent
      : undefined;

    const genres = Array.isArray(parsed.genres) && parsed.genres.length
      ? parsed.genres.filter((genre: any) => typeof genre === 'string')
      : reference?.genres || [];

    return {
      type: parsed.type === 'series' || parsed.type === 'movie' ? parsed.type : reference?.type || 'unknown',
      title: parsed.title ?? title,
      cleanTitle: parsed.cleanTitle ?? reference?.title ?? null,
      year: parsed.year ? Number(parsed.year) : reference?.year ?? null,
      season: parsed.season ? Number(parsed.season) : null,
      quality: parsed.quality ?? null,
      audioLanguages: Array.from(new Set(audioLanguages)),
      audioTracks,
      subtitleLanguages: Array.from(new Set(subtitleLanguages)),
      subtitlesPresent: declaredPresence ?? (subtitleLanguages.length ? 'yes' : 'unknown'),
      episodesAvailable: parsed.episodesAvailable ? Number(parsed.episodesAvailable) : null,
      episodesTotal: parsed.episodesTotal ? Number(parsed.episodesTotal) : null,
      genres,
      size: parsed.size ?? null,
    };
  }

  /**
   * Calls the provider and returns raw text. Throws so callers can surface the real cause;
   * `callAI` keeps the previous null-on-failure behaviour for non-critical paths.
   */
  async callAIOrThrow(prompt: string, options?: { json?: boolean }): Promise<string> {
    const { provider, apiKey, baseUrl, model, timeoutMs } = this.config;
    const spec = AI_PROVIDERS[provider];
    if (!spec) throw new Error(`Unknown AI provider: ${provider}`);
    if (spec.requiresApiKey && !apiKey) throw new Error(`${spec.label} requires an API key`);
    if (spec.requiresBaseUrl && !baseUrl?.trim()) throw new Error(`${spec.label} requires a base URL`);

    const endpoint = resolveEndpoint(baseUrl, spec, spec.chatPath);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resolvedModel = model || spec.defaultModel;
    const body: any =
      provider === 'ollama'
        ? { model: resolvedModel || 'llama3', prompt, stream: false, format: options?.json ? 'json' : undefined }
        : {
            model: resolvedModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            ...(options?.json ? { response_format: { type: 'json_object' } } : {}),
          };

    let response = await this.fetchWithTimeout(
      endpoint,
      { method: 'POST', headers, body: JSON.stringify(body) },
      timeoutMs ?? 60000
    );

    // Not every OpenAI-compatible server implements response_format; retry plain.
    if (!response.ok && options?.json && provider !== 'ollama' && (response.status === 400 || response.status === 422)) {
      delete body.response_format;
      response = await this.fetchWithTimeout(
        endpoint,
        { method: 'POST', headers, body: JSON.stringify(body) },
        timeoutMs ?? 60000
      );
    }

    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 300);
      throw new Error(`AI API error ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const data = await response.json();
    const content = provider === 'ollama' ? data?.response : data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI returned an empty response');
    return content;
  }

  private async callAI(prompt: string, options?: { json?: boolean }): Promise<string | null> {
    try {
      return await this.callAIOrThrow(prompt, options);
    } catch (error) {
      console.error('AI call error:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}