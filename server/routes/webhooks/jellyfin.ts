import type { WebhookProcessResult } from '@server/lib/scanners/jellyfin';
import { processJellyfinItemById } from '@server/lib/scanners/jellyfin';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import express, { Router } from 'express';

const jellyfinWebhookRoutes = Router();

// Notification types that warrant re-scanning an item.
// ItemAdded  = new file landed in library
// ItemUpdated = metadata refreshed (provider IDs may now be available)
const PROCESSABLE_TYPES = new Set(['ItemAdded', 'ItemUpdated']);

// The Jellyfin Webhook Plugin's Generic destination defaults to
// Content-Type: text/plain.  The global express.json() middleware only
// parses application/json, so text/plain bodies arrive as undefined.
// This local middleware catches text bodies and attempts JSON.parse so
// the handler works regardless of Content-Type configuration.
jellyfinWebhookRoutes.use(express.text({ type: 'text/*' }));

jellyfinWebhookRoutes.post('/', async (req, res) => {
  // If the body arrived as a plain-text string, attempt JSON parse.
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({
        status: 400,
        error: 'Invalid JSON in request body',
      });
    }
  }
  // ---- Auth (API key via query param or header) ----
  const settings = getSettings();
  const apiKey = (req.query.apiKey as string) ?? req.header('X-API-Key') ?? '';

  if (apiKey !== settings.main.apiKey) {
    return res.status(401).json({ status: 401, error: 'Unauthorized' });
  }

  // ---- Extract item IDs (single or batch) ----
  const itemIds: string[] = [];

  if (typeof req.body?.ItemId === 'string' && req.body.ItemId.trim()) {
    itemIds.push(req.body.ItemId.trim());
  }
  if (Array.isArray(req.body?.ItemIds)) {
    for (const id of req.body.ItemIds) {
      if (typeof id === 'string' && id.trim()) {
        itemIds.push(id.trim());
      }
    }
  }

  if (itemIds.length === 0) {
    return res.status(400).json({
      status: 400,
      error: 'Missing required field: ItemId (string) or ItemIds (string[])',
    });
  }

  // ---- Filter by notification type ----
  // When the Jellyfin Webhook Plugin sends an event, only ItemAdded and
  // ItemUpdated are relevant for library sync.  Everything else (playback,
  // auth, tasks, etc.) is acknowledged but not processed.
  // When NotificationType is absent (e.g. a manual curl) we process anyway.
  const notificationType: string | undefined = req.body?.NotificationType;
  if (notificationType && !PROCESSABLE_TYPES.has(notificationType)) {
    return res.status(200).json({
      status: 200,
      message: `Ignored event type: ${notificationType}`,
    });
  }

  const uniqueIds = [...new Set(itemIds)];

  logger.info(
    `Jellyfin webhook: ${uniqueIds.length} item(s) [${notificationType ?? 'manual'}]`,
    {
      label: 'Jellyfin Webhook',
      itemIds: uniqueIds,
    }
  );

  // ---- Process each item ----
  const results: {
    itemId: string;
    status: 'success' | 'skipped' | 'error';
    itemName?: string;
    itemType?: string;
    effectiveId?: string;
    message: string;
  }[] = [];

  for (const itemId of uniqueIds) {
    let result: WebhookProcessResult | undefined;

    try {
      result = await processJellyfinItemById(itemId);

      if (result.skipped) {
        results.push({
          itemId,
          status: 'skipped',
          itemName: result.itemName,
          itemType: result.itemType,
          effectiveId: result.effectiveId,
          message: 'Already processing — re-scan queued',
        });
      } else {
        results.push({
          itemId,
          status: 'success',
          itemName: result.itemName,
          itemType: result.itemType,
          effectiveId: result.effectiveId,
          message: 'Processed successfully',
        });
      }
    } catch (e) {
      logger.error(`Jellyfin webhook: Failed to process ${itemId}`, {
        label: 'Jellyfin Webhook',
        errorMessage: e.message,
      });
      results.push({
        itemId,
        status: 'error',
        message: e.message,
      });
    }
  }

  // Single item → flat response; batch → array
  if (uniqueIds.length === 1) {
    const r = results[0];
    const statusCode = r.status === 'error' ? 500 : 200;
    return res.status(statusCode).json(r);
  }

  const hasErrors = results.some((r) => r.status === 'error');
  return res.status(hasErrors ? 207 : 200).json({ results });
});

export default jellyfinWebhookRoutes;
