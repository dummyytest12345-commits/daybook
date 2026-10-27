import { defineConfig } from '@playwright/test'

// The browser tests run against a real API on MongoDB Atlas, but in a separate database ("daybook_e2e",
// dropped afterwards) and on port 4100, so they never touch your development data.
const API_PORT = '4100'

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  use: { baseURL: 'http://localhost:4173' },
  globalTeardown: './e2e/teardown.js',
  webServer: [
    {
      command: 'npm --prefix ../backend start',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60000,
      env: { PORT: API_PORT, MONGODB_DB: 'daybook_e2e', NODE_ENV: 'development', APP_URL: 'http://localhost:4173', SMTP_HOST: '' },
    },
    {
      command: 'npm run build && npm run preview -- --port 4173',
      port: 4173,
      reuseExistingServer: true,
      timeout: 120000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
})
