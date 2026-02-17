import { seedTestDb } from '@server/utils/seedTestDb';
import { copyFileSync } from 'fs';
import path from 'path';

const prepareDb = async () => {
  // Copy over test settings.json
  copyFileSync(
    path.join(__dirname, '../../cypress/config/settings.cypress.json'),
    path.join(__dirname, '../../config/settings.json')
  );

  await seedTestDb({
    preserveDb: process.env.PRESERVE_DB === 'true',
    withMigrations: process.env.WITH_MIGRATIONS === 'true',
  });
};

prepareDb();
