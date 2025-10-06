import { defineConfig } from 'cypress';

export default defineConfig({
  projectId: 'onnqy3',
  e2e: {
    baseUrl: 'http://localhost:5055',
    video: true,
  },
  env: {
    ADMIN_EMAIL: 'admin@seerr.dev',
    ADMIN_PASSWORD: 'test1234',
    USER_EMAIL: 'friend@seerr.dev',
    USER_PASSWORD: 'test1234',
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
});
