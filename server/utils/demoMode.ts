import dataSource from '@server/datasource';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { seedTestUsers } from '@server/utils/seedTestDb';
import type { Express } from 'express';
import fs from 'fs';
import path from 'path';

async function resetDemoData(): Promise<void> {
  try {
    // Drop all tables except users and sessions
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      if (['session', 'user'].includes(entity.tableName.toLowerCase())) {
        continue;
      }
      await dataSource.getRepository(entity.name).clear();
    }
    // Add the default users
    await seedTestUsers();
    // Re-seed discover sliders
    await DiscoverSlider.bootstrapSliders();
  } catch (error) {
    logger.error('Failed to reset demo data', { error });
  }
}

export async function initDemoData(server: Express): Promise<void> {
  // Check that no data exists in the database before seeding demo data
  if ((await dataSource.getRepository('user').count()) > 0) {
    logger.error('Database is not empty, cannot seed demo data. Aborting.');
    process.exit(1);
  }

  // Retrieve settings from Cypress tests
  try {
    fs.copyFileSync(
      path.join(__dirname, '../../cypress/config/settings.cypress.json'),
      path.join(__dirname, '../../config/settings.json')
    );
  } catch (error) {
    logger.error('Failed to copy settings from Cypress tests', { error });
    process.exit(1);
  }
  const settings = getSettings();
  await settings.load();
  settings.main.mediaServerLogin = false;
  await settings.save();
  // Seed the database with demo data
  await resetDemoData();
  // Resets the database every hour
  setInterval(resetDemoData, 60 * 60 * 1000);

  // Disable password sign-in for non-demo users
  server.post('/api/v1/auth/local', async (req, res, next) => {
    if (req.body?.email !== 'demo@seerr.dev') {
      return res.status(403).json({ error: 'Password sign-in is disabled.' });
    }
    next();
  });
  // Disable password change
  server.post('/api/v1/user/:id/settings/password', async (_, res) => {
    return res.status(204).send();
  });
  // Disable test user modification
  server.post('/api/v1/user/:id/settings/main', async (_, res) => {
    return res.status(200).json({});
  });
  // Disable unlinking media servers
  server.post(
    '/api/v1/user/:id/settings/linked-accounts/plex',
    async (_, res) => {
      return res.status(204).send();
    }
  );
}
