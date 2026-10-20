import { defineConfig, devices } from "@playwright/test";

// Tests talk to the real Supabase project with the same keys as the app.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Env may already be provided (e.g. CI).
}

// The tests create and delete users and data, so they must never run against
// production. List production project refs in E2E_FORBIDDEN_PROJECT_REFS.
const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://unset").hostname.split(".")[0];
const forbidden = (process.env.E2E_FORBIDDEN_PROJECT_REFS ?? "")
  .split(",")
  .map((ref) => ref.trim())
  .filter(Boolean);
if (forbidden.includes(projectRef)) {
  throw new Error(
    `Refusing to run e2e tests: NEXT_PUBLIC_SUPABASE_URL points at "${projectRef}", ` +
      "which is listed in E2E_FORBIDDEN_PROJECT_REFS (production). Use the development project.",
  );
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  // Supabase rate-limits auth emails, so run one test at a time.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: [/dashboard\.spec\.ts/, /products\.spec\.ts/, /suppliers\.spec\.ts/],
      grep: /dashboard home|@mobile|restock and expiry|add a product|add a supplier/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
