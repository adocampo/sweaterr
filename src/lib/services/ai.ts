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

export interface AIProviderConfig {
  provider: string; // openai, perplexity, deepseek, ollama
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export class AIService {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
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

      const response = await this.callAI(prompt);

      if (!response) return null;

      // Parse response
      try {
        const parsed = JSON.parse(response);
        return {
          originalTitle: forumTitle,
          sceneName: parsed.sceneName || forumTitle,
          season: parsed.season ? parseInt(parsed.season) : undefined,
          episode: parsed.episode ? parseInt(parsed.episode) : undefined,
          quality: parsed.quality,
          source: parsed.source,
          releaseGroup: parsed.releaseGroup,
        };
      } catch {
        return null;
      }
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

      const response = await this.callAI(prompt);

      if (!response) return results;

      try {
        const rankings = JSON.parse(response);
        const rankedResults = results.map((r, i) => {
          const ranking = rankings.find((rank: any) => rank.index === i);
          return {
            ...r,
            relevanceScore: ranking?.score || 0.5,
          };
        });

        return rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
      } catch {
        return results;
      }
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

      const response = await this.callAI(prompt);

      if (!response) return {};

      try {
        return JSON.parse(response);
      } catch {
        return {};
      }
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

  // Call AI provider
  private async callAI(prompt: string): Promise<string | null> {
    const { provider, apiKey, baseUrl, model } = this.config;

    if (!apiKey && provider !== 'ollama') {
      console.warn('AI API key not configured');
      return null;
    }

    try {
      let endpoint = '';
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      let body: any = {};

      // Configure based on provider
      switch (provider) {
        case 'openai':
          endpoint = baseUrl || 'https://api.openai.com/v1/chat/completions';
          headers['Authorization'] = `Bearer ${apiKey}`;
          body = {
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
          };
          break;

        case 'perplexity':
          endpoint = baseUrl || 'https://api.perplexity.ai/chat/completions';
          headers['Authorization'] = `Bearer ${apiKey}`;
          body = {
            model: model || 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: prompt }],
          };
          break;

        case 'deepseek':
          endpoint = baseUrl || 'https://api.deepseek.com/v1/chat/completions';
          headers['Authorization'] = `Bearer ${apiKey}`;
          body = {
            model: model || 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
          };
          break;

        case 'ollama':
          endpoint = `${baseUrl || 'http://localhost:11434'}/api/generate`;
          body = {
            model: model || 'llama2',
            prompt,
            stream: false,
          };
          break;

        default:
          console.error(`Unknown AI provider: ${provider}`);
          return null;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract response based on provider
      if (provider === 'ollama') {
        return data.response || null;
      } else {
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (error) {
      console.error('AI call error:', error);
      return null;
    }
  }
}