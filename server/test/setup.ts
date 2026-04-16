import logger from '@server/logger';
import { after, before } from 'node:test';

before(() => {
  if (process.env.VERBOSE != 'true') logger.silent = true;
});

after(() => {
  if (process.env.VERBOSE != 'true') logger.silent = false;
});
