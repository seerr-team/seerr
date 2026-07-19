import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export interface WatchHistoryItem {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year?: number;
  rating?: number;
  playCount?: number;
  genres?: string[];
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
}

export interface TasteProfile {
  profile: string;
  keywords: string[];
  preferredGenres?: string[];
  preferredThemes?: string[];
  avoidedGenres?: string[];
  preferredEra?: {
    from: number;
    to: number;
  };
}

export interface AIRecommendationItem {
  title: string;
  year: number;
  tmdbId?: number;
  type: 'movie' | 'tv';
  rationale: string;
}

export interface RecommendationFilters {
  genres?: number[];
  yearRange?: [number, number];
  languages?: string[];
  minRating?: number;
  excludeKeywords?: string[];
  includeKeywords?: string[];
  minRuntime?: number;
  studios?: number[];
  networks?: number[];
  mediaType?: 'movie' | 'tv' | 'both';
  vibePrompt?: string;
}

export interface SearchInterpretation {
  discoverParams: {
    genres?: string[];
    year_from?: number;
    year_to?: number;
    original_language?: string;
    sort_by?: string;
    min_rating?: number;
    keywords?: string[];
  };
  suggestedTitles: {
    title: string;
    year?: number;
    type: 'movie' | 'tv';
    rationale: string;
  }[];
}

export interface LLMClient {
  generateTasteProfile(history: WatchHistoryItem[]): Promise<TasteProfile>;
  generateRecommendations(
    profile: TasteProfile,
    history: WatchHistoryItem[],
    filters: RecommendationFilters,
    maxResults: number,
    likedTitles?: { title: string; mediaType: 'movie' | 'tv' }[]
  ): Promise<AIRecommendationItem[]>;
  interpretSearchQuery(
    query: string,
    history?: WatchHistoryItem[]
  ): Promise<SearchInterpretation>;
  testConnection(): Promise<boolean>;
}

export class OpenAICompatibleClient implements LLMClient {
  private client: OpenAI;
  private model: string;

  constructor() {
    const settings = getSettings();
    const aiConfig = settings.ai;

    this.client = new OpenAI({
      apiKey:
        aiConfig.provider.apiKey ||
        process.env.OPENAI_API_KEY ||
        'sk-placeholder',
      baseURL: aiConfig.provider.baseUrl || 'https://api.openai.com/v1',
    });
    this.model = aiConfig.provider.model;
  }

  private async callLLM(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages as ChatCompletionMessageParam[],
        temperature: 0.7,
        max_tokens: 4000,
      });

      // Reasoning models (e.g. GLM, o-series) may return their answer in
      // `reasoning_content` with an empty `content`. Prefer `content`, fall
      // back to `reasoning_content`.
      const message = response.choices[0]?.message as any;
      const content = message?.content ?? message?.reasoning_content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      return content;
    } catch (error) {
      logger.error('LLM API call failed:', error);
      throw error;
    }
  }

  /**
   * Tolerant JSON repair for LLM output. Small local models frequently produce
   * trailing commas, truncated output (cut off by max_tokens), or unescaped
   * quotes. This rewrites the most common defects before parsing.
   */
  private repairJSON(raw: string): string {
    let s = raw;
    // Strip markdown fences
    s = s.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    // Trim trailing commas before } or ]
    s = s.replace(/,\s*([}\]])/g, '$1');
    // Remove stray control characters
    // eslint-disable-next-line no-control-regex -- stripping stray control chars from LLM output is intentional
    s = s.replace(/[\x00-\x1f]/g, (ch) =>
      ch === '\n' || ch === '\t' ? ch : ''
    );
    return s;
  }

  private extractJSON(content: string): any {
    const cleaned = this.repairJSON(content);

    // Find the first complete JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON found in response');
    }

    const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(jsonStr);
    } catch {
      // Last resort: the output was likely truncated. Try to close any
      // unbalanced brackets/braces so we can salvage partial data.
      const salvaged = this.closeUnbalanced(jsonStr);
      return JSON.parse(salvaged);
    }
  }

  /**
   * Best-effort truncation repair: counts open vs. closed brackets/braces and
   * appends the missing closers. Used when max_tokens cuts the response short.
   */
  private closeUnbalanced(s: string): string {
    let openObjects = 0;
    let openArrays = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') openObjects++;
      else if (ch === '}') openObjects--;
      else if (ch === '[') openArrays++;
      else if (ch === ']') openArrays--;
    }

    // Remove a dangling trailing comma so the closers are valid
    const result = s.replace(/,\s*$/, '');
    // Close any open array then object, from innermost out
    let suffix = '';
    for (let i = 0; i < openArrays; i++) suffix += ']';
    for (let i = 0; i < openObjects; i++) suffix += '}';
    return result + suffix;
  }

  /**
   * Call the LLM and parse structured JSON, retrying once with a corrective
   * system message if the first attempt yields invalid JSON.
   */
  private async callForJSON(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
  ): Promise<any> {
    const maxAttempts = 2;
    let lastError: Error | null = null;
    let currentMessages = messages;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const raw = await this.callLLM(currentMessages);
      try {
        return this.extractJSON(raw);
      } catch (err) {
        lastError = err as Error;
        logger.warn(
          `JSON parse failed on attempt ${attempt}/${maxAttempts}: ${lastError.message}. Retrying with corrective prompt.`
        );
        // Inject the broken output and ask the model to fix it
        currentMessages = [
          ...messages,
          { role: 'assistant', content: raw },
          {
            role: 'system',
            content:
              'Your previous response was not valid JSON — it was likely truncated or contained a syntax error. ' +
              'Reply with ONLY a single valid JSON object, no markdown, no commentary. ' +
              'If you cannot fit all items, return fewer items rather than cutting off mid-object.',
          },
        ];
      }
    }
    throw new Error(
      `LLM did not return valid JSON after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  async generateTasteProfile(
    history: WatchHistoryItem[]
  ): Promise<TasteProfile> {
    const prompt = this.buildTasteProfilePrompt(history);

    try {
      const parsed = await this.callForJSON([
        {
          role: 'system',
          content:
            'You are a psychological film and television analyst. You analyze viewing history and output structured taste profiles in valid JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return {
        profile: parsed.profile || '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        preferredGenres: parsed.preferredGenres || [],
        preferredThemes: parsed.preferredThemes || [],
        avoidedGenres: parsed.avoidedGenres || [],
        preferredEra: parsed.preferredEra || undefined,
      };
    } catch (error) {
      logger.error('Failed to generate taste profile:', error);
      throw new Error(`Taste profile generation failed: ${error.message}`);
    }
  }

  async generateRecommendations(
    profile: TasteProfile,
    history: WatchHistoryItem[],
    filters: RecommendationFilters,
    maxResults: number,
    likedTitles?: { title: string; mediaType: 'movie' | 'tv' }[]
  ): Promise<AIRecommendationItem[]> {
    const prompt = this.buildRecommendationsPrompt(
      profile,
      history,
      filters,
      maxResults,
      likedTitles
    );

    try {
      const parsed = await this.callForJSON([
        {
          role: 'system',
          content:
            'You are an expert film and television recommendation engine. You generate personalized recommendations based on taste profiles and viewing history. Output must be valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);
      const recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [];

      return recommendations.slice(0, maxResults);
    } catch (error) {
      logger.error('Failed to generate recommendations:', error);
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }

  async interpretSearchQuery(
    query: string,
    history?: WatchHistoryItem[]
  ): Promise<SearchInterpretation> {
    const prompt = this.buildSearchPrompt(query, history);

    try {
      const parsed = await this.callForJSON([
        {
          role: 'system',
          content:
            'You are a media search interpreter. You translate natural language queries into structured TMDB search parameters and suggest specific titles. Output must be valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return {
        discoverParams: parsed.discover_params || {},
        suggestedTitles: Array.isArray(parsed.suggested_titles)
          ? parsed.suggested_titles
          : [],
      };
    } catch (error) {
      logger.error('Failed to interpret search query:', error);
      throw new Error(`Search interpretation failed: ${error.message}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      });

      return (
        response.choices[0]?.message?.content?.toLowerCase().includes('ok') ||
        false
      );
    } catch (error) {
      logger.error('LLM connection test failed:', error);
      return false;
    }
  }

  private buildTasteProfilePrompt(history: WatchHistoryItem[]): string {
    const historyText = history
      .map(
        (item) =>
          `- ${item.title} (${item.year || 'N/A'}) - ${item.mediaType} - Rating: ${item.rating || 'N/A'} - Plays: ${item.playCount || 0} - Genres: ${item.genres?.join(', ') || 'N/A'}`
      )
      .join('\n');

    return `Analyze this viewing history and create a psychological taste profile:

Watch History:
${historyText}

Response MUST be valid JSON in this exact format:
{
  "profile": "A detailed paragraph explaining the user's taste, including pacing preferences, thematic interests, preferred genres, and common tropes they enjoy",
  "keywords": ["specific_keyword1", "specific_keyword2", "specific_keyword3"],
  "preferredGenres": ["genre1", "genre2"],
  "preferredThemes": ["theme1", "theme2"],
  "avoidedGenres": ["genre1"],
  "preferredEra": {"from": 1990, "to": 2000}
}

Keywords should be highly specific niche terms (e.g., "cyberpunk", "time-loop", "noir") that capture the essence of their taste.`;
  }

  private buildRecommendationsPrompt(
    profile: TasteProfile,
    history: WatchHistoryItem[],
    filters: RecommendationFilters,
    maxResults: number,
    likedTitles?: { title: string; mediaType: 'movie' | 'tv' }[]
  ): string {
    const historyTitles = history
      .map((h) => `- ${h.title} (${h.year || 'N/A'})`)
      .join('\n');
    const filtersText = this.formatFilters(filters);
    const likedText =
      likedTitles && likedTitles.length > 0
        ? `TITLES THE USER EXPLICITLY LIKED (lean toward content similar to these):\n${likedTitles
            .map((l) => `- ${l.title} (${l.mediaType})`)
            .join('\n')}\n\n`
        : '';

    return `Generate personalized recommendations based on this taste profile and viewing history.

TASTE PROFILE:
${JSON.stringify(profile, null, 2)}

${likedText}VIEWING HISTORY (DO NOT recommend these exact titles):
${historyTitles}

${filtersText ? `FILTER CONSTRAINTS:\n${filtersText}\n` : ''}

Return exactly ${maxResults} recommendations (the configured amount). Focus on the accurate title and release year — these are used to look the title up, so get them right. Do NOT invent tmdb_id values; omit the field if you are not certain. If you genuinely cannot reach ${maxResults} distinct, relevant titles, return as many as you can rather than padding with weak guesses.

Response MUST be valid JSON in this exact format:
{
  "recommendations": [
    {
      "title": "Movie Title",
      "year": 2024,
      "type": "movie" | "tv",
      "rationale": "Why this matches their taste based on profile and history..."
    }
  ]
}`;
  }

  private buildSearchPrompt(
    query: string,
    history?: WatchHistoryItem[]
  ): string {
    const historyText =
      history && history.length > 0
        ? `USER'S VIEWING HISTORY (for personalization):\n${history.map((h) => `- ${h.title}`).join('\n')}\n`
        : '';

    return `Translate this natural language query into structured TMDB search parameters and suggest specific titles.

${historyText}USER QUERY: "${query}"

Response MUST be valid JSON in this exact format:
{
  "discover_params": {
    "genres": ["Action", "Thriller"],
    "year_from": 1990,
    "year_to": 1999,
    "original_language": "en",
    "sort_by": "vote_average.desc",
    "min_rating": 7.0,
    "keywords": ["keyword1", "keyword2"]
  },
  "suggested_titles": [
    {
      "title": "The Matrix",
      "year": 1999,
      "type": "movie",
      "rationale": "Matches the sci-fi action theme from the query"
    }
  ]
}

If the query doesn't specify a parameter, set it to null or omit it. "sort_by" should be inferred from intent:
- "best" → "vote_average.desc"
- "popular" → "popularity.desc"
- "latest" → "release_date.desc"
- "oldest" → "release_date.asc"`;
  }

  private formatFilters(filters: RecommendationFilters): string {
    const parts: string[] = [];

    if (filters.genres && filters.genres.length > 0) {
      parts.push(`- MUST be in genres: ${filters.genres.join(', ')}`);
    }

    if (filters.mediaType && filters.mediaType !== 'both') {
      parts.push(`- ONLY ${filters.mediaType} content`);
    }

    if (filters.yearRange) {
      parts.push(
        `- MUST be released between ${filters.yearRange[0]} and ${filters.yearRange[1]}`
      );
    }

    if (filters.minRating) {
      parts.push(`- MUST have rating >= ${filters.minRating}`);
    }

    if (filters.languages && filters.languages.length > 0) {
      parts.push(`- MUST be in languages: ${filters.languages.join(', ')}`);
    }

    if (filters.vibePrompt) {
      parts.push(`- VIBE/MOOD: ${filters.vibePrompt}`);
    }

    return parts.join('\n');
  }
}

export function createLLMClient(): LLMClient {
  return new OpenAICompatibleClient();
}
