import logger from '@server/logger';
import { after, before } from 'node:test';

before(() => {
  logger.silent = true;
});

after(() => {
  logger.silent = false;
});
