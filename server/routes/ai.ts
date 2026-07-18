import { getRepository } from '../datasource';
import { OpenAI } from 'openai';
import { User } from '../entity/User';
import { UserFeedback } from '../entity/UserFeedback';
import { AiRecommendation } from '../entity/AiRecommendation';
import Media from '../entity/Media';
import { MediaType } from '../constants/media';
import { getSettings } from '../lib/settings';
import { createLLMClient } from '../api/ai';
import { aiSearch, generateRecommendations } from '../lib/aiRecommendations';
import { mapSearchResults } from '../models/Search';
import logger from '../logger';
import { Router } from 'express';
import { z } from 'zod';

const aiRoutes = Router();

// GET /api/v1/ai/settings - Get AI settings (admin only)
aiRoutes.get('/settings', (req, res, next) => {
  try {
    const settings = getSettings();

    // Only expose non-sensitive settings
    const publicAiSettings = {
      enabled: settings.ai.enabled,
      provider: {
        type: settings.ai.provider.type,
        baseUrl: settings.ai.provider.baseUrl,
        model: settings.ai.provider.model,
      },
      recommendations: {
        enabled: settings.ai.recommendations.enabled,
        sliderTitle: settings.ai.recommendations.sliderTitle,
        maxResults: settings.ai.recommendations.maxResults,
        minScore: settings.ai.recommendations.minScore,
        ttlDays: settings.ai.recommendations.ttlDays,
      },
      search: {
        enabled: settings.ai.search.enabled,
      },
    };

    res.json(publicAiSettings);
  } catch (error) {
    logger.error('Get AI settings error:', error);
    next(error);
  }
});

// PUT /api/v1/ai/settings - Update AI settings (admin only)
aiRoutes.put('/settings', async (req, res, next) => {
  try {
    const settings = getSettings();

    // Update settings with request body
    if (req.body.enabled !== undefined) settings.ai.enabled = req.body.enabled;
    if (req.body.provider) {
      if (req.body.provider.type) settings.ai.provider.type = req.body.provider.type;
      if (req.body.provider.baseUrl) settings.ai.provider.baseUrl = req.body.provider.baseUrl;
      if (req.body.provider.model) settings.ai.provider.model = req.body.provider.model;
      if (req.body.provider.apiKey) settings.ai.provider.apiKey = req.body.provider.apiKey;
    }
    if (req.body.recommendations) {
      if (req.body.recommendations.enabled !== undefined)
        settings.ai.recommendations.enabled = req.body.recommendations.enabled;
      if (req.body.recommendations.sliderTitle)
        settings.ai.recommendations.sliderTitle = req.body.recommendations.sliderTitle;
      if (req.body.recommendations.maxResults)
        settings.ai.recommendations.maxResults = req.body.recommendations.maxResults;
      if (req.body.recommendations.minScore)
        settings.ai.recommendations.minScore = req.body.recommendations.minScore;
      if (req.body.recommendations.ttlDays !== undefined)
        settings.ai.recommendations.ttlDays = req.body.recommendations.ttlDays;
    }
    if (req.body.search) {
      if (req.body.search.enabled !== undefined) settings.ai.search.enabled = req.body.search.enabled;
    }

    await settings.save();

    res.json({
      message: 'Settings updated successfully',
      settings: {
        enabled: settings.ai.enabled,
        provider: {
          type: settings.ai.provider.type,
          baseUrl: settings.ai.provider.baseUrl,
          model: settings.ai.provider.model,
        },
        recommendations: {
          enabled: settings.ai.recommendations.enabled,
          sliderTitle: settings.ai.recommendations.sliderTitle,
          maxResults: settings.ai.recommendations.maxResults,
          minScore: settings.ai.recommendations.minScore,
          ttlDays: settings.ai.recommendations.ttlDays,
        },
        search: {
          enabled: settings.ai.search.enabled,
        },
      },
    });
  } catch (error) {
    logger.error('Update AI settings error:', error);
    next(error);
  }
});

// POST /api/v1/ai/test - Test AI provider connection
aiRoutes.post('/test', async (req, res, next) => {
  try {
    const { provider } = req.body;

    if (!provider) {
      return res.status(400).json({ message: 'Provider configuration required' });
    }

    // Build the client directly from the submitted form values so "Test Connection"
    // validates what the user entered, regardless of what's saved globally.
    // For local providers (Ollama/LM Studio) an API key is not required, so we
    // fall back to a harmless placeholder to satisfy the OpenAI SDK.
    const client = new OpenAI({
      apiKey: provider.apiKey || 'sk-not-required',
      baseURL: provider.baseUrl || 'https://api.openai.com/v1',
    });
    const model = provider.model || 'gpt-4o-mini';

    const startTime = Date.now();

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say "ok"' }],
        max_tokens: 5,
      });

      const success =
        response.choices[0]?.message?.content?.toLowerCase().includes('ok') ||
        false;
      const latency = Date.now() - startTime;

      res.json({
        success,
        latency: success ? latency : undefined,
        error: success ? undefined : 'Connection test failed (no valid response)',
      });
    } catch (error) {
      res.json({
        success: false,
        error: error.message,
      });
    }
  } catch (error) {
    logger.error('Test AI connection error:', error);
    next(error);
  }
});

// POST /api/v1/ai/search - AI search endpoint
aiRoutes.post('/search', async (req, res, next) => {
  try {
    const user = req.user?.id;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { query, options } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ message: 'Query is required' });
    }

    const { results: rawResults, interpretation } = await aiSearch(
      user,
      query,
      options
    );

    // Map raw TMDb results to the same shape as the regular search endpoint
    // (camelCase + media status) so the frontend can reuse TitleCard/ListView.
    const media = await Media.getRelatedMedia(
      req.user,
      rawResults.map((r: any) => ({
        tmdbId: r.id,
        mediaType: r.media_type,
      }))
    );

    const results = mapSearchResults(rawResults as any, media);

    res.json({
      page: 1,
      totalPages: 1,
      totalResults: results.length,
      results,
      query,
      interpretation,
    });
  } catch (error) {
    logger.error('AI search error:', error);
    next(error);
  }
});

// POST /api/v1/ai/feedback - Submit user feedback
const feedbackSchema = z.object({
  tmdbId: z.number(),
  mediaType: z.enum(['movie', 'tv']),
  feedbackType: z.enum(['like', 'dislike', 'seen']),
});

aiRoutes.post('/feedback', async (req, res, next) => {
  try {
    const user = req.user?.id;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { tmdbId, mediaType, feedbackType } = feedbackSchema.parse(req.body);
    const mediaTypeEnum = mediaType as MediaType;

    const feedbackRepository = getRepository(UserFeedback);

    // Check if feedback already exists
    const existing = await feedbackRepository.findOne({
      where: {
        userId: user,
        tmdbId,
        mediaType: mediaTypeEnum,
      },
    });

    if (existing) {
      // Update existing feedback
      existing.feedbackType = feedbackType;
      existing.createdAt = new Date();
      await feedbackRepository.save(existing);
    } else {
      // Create new feedback
      const feedback = feedbackRepository.create({
        userId: user,
        tmdbId,
        mediaType: mediaTypeEnum,
        feedbackType,
        createdAt: new Date(),
      });
      await feedbackRepository.save(feedback);
    }

    res.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    next(error);
  }
});

// GET /api/v1/ai/feedback/stats - Get user feedback statistics
aiRoutes.get('/feedback/stats', async (req, res, next) => {
  try {
    const user = req.user?.id;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const feedbackRepository = getRepository(UserFeedback);

    const [likeCount, dislikeCount, seenCount, recentFeedback] = await Promise.all([
      feedbackRepository.count({ where: { userId: user, feedbackType: 'like' } }),
      feedbackRepository.count({ where: { userId: user, feedbackType: 'dislike' } }),
      feedbackRepository.count({ where: { userId: user, feedbackType: 'seen' } }),
      feedbackRepository.find({
        where: { userId: user },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
    ]);

    res.json({
      likeCount,
      dislikeCount,
      seenCount,
      recentFeedback: recentFeedback.map((fb) => ({
        tmdbId: fb.tmdbId,
        mediaType: fb.mediaType,
        feedbackType: fb.feedbackType,
        createdAt: fb.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Get feedback stats error:', error);
    next(error);
  }
});

// DELETE /api/v1/ai/feedback/:tmdbId - Delete user feedback
aiRoutes.delete('/feedback/:tmdbId', async (req, res, next) => {
  try {
    const user = req.user?.id;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const tmdbId = parseInt(req.params.tmdbId);
    const mediaType = req.query.mediaType as string;

    if (!mediaType || !['movie', 'tv'].includes(mediaType)) {
      return res.status(400).json({ message: 'Invalid mediaType' });
    }

    const feedbackRepository = getRepository(UserFeedback);

    const result = await feedbackRepository.delete({
      userId: user,
      tmdbId,
      mediaType: mediaType as MediaType,
    });

    if (result.affected === 0) {
      return res.status(404).json({ message: 'Feedback not found' });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    logger.error('Delete feedback error:', error);
    next(error);
  }
});

// POST /api/v1/ai/regenerate - Manually trigger recommendation regeneration
aiRoutes.post('/regenerate', async (req, res, next) => {
  try {
    const user = req.user?.id;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const settings = getSettings();

    if (!settings.ai.enabled || !settings.ai.recommendations.enabled) {
      return res.status(400).json({ message: 'AI recommendations are disabled' });
    }

    // Trigger recommendation generation
    const recommendations = await generateRecommendations(user);

    res.json({
      success: true,
      message: 'Recommendations regenerated successfully',
      count: recommendations.length,
    });
  } catch (error) {
    logger.error('Regenerate recommendations error:', error);
    next(error);
  }
});

export default aiRoutes;
