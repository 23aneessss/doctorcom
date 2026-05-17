import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

const HOST = "127.0.0.1";
const WEB_ROOT = new URL("../../apps/web/", import.meta.url).pathname;

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let baseUrl = "";

async function getFreePort(): Promise<number> {
  const server = createServer();
  server.listen(0, HOST);
  await once(server, "listening");
  const address = server.address();
  server.close();
  await once(server, "close");

  if (!address || typeof address === "string") {
    throw new Error("Unable to allocate an e2e port.");
  }

  return address.port;
}

async function waitForHttp(url: string, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

beforeAll(async () => {
  const port = await getFreePort();
  baseUrl = `http://${HOST}:${port}`;
  serverProcess = spawn(
    "bun",
    ["run", "dev", "--host", HOST, "--port", String(port), "--strictPort"],
    {
      cwd: WEB_ROOT,
      env: {
        ...process.env,
        VITE_SERVER_URL: "http://127.0.0.1:3000",
      },
      stdio: "pipe",
    },
  );

  let logs = "";
  serverProcess.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });
  serverProcess.once("exit", (code) => {
    if (code !== null && code !== 0) {
      logs += `\nVite exited with code ${code}`;
    }
  });

  try {
    await waitForHttp(`${baseUrl}/`);
  } catch (error) {
    throw new Error(`${(error as Error).message}\n${logs}`);
  }
});

afterAll(() => {
  serverProcess?.kill("SIGTERM");
  serverProcess = null;
});

describe("web app delivery e2e", () => {
  test("serves the app shell for public and protected client routes", async () => {
    const root = await fetch(`${baseUrl}/`);
    const login = await fetch(`${baseUrl}/login`);
    const protectedRoute = await fetch(
      `${baseUrl}/patients/11111111-1111-4111-8111-111111111111/suivi`,
    );

    expect(root.status).toBe(200);
    expect(login.status).toBe(200);
    expect(protectedRoute.status).toBe(200);

    const loginHtml = await login.text();
    expect(loginHtml).toContain('<div id="app">');
    expect(loginHtml).toContain("/src/main.tsx");
  });

  test("serves runtime configuration and transformed app entry", async () => {
    const runtimeConfig = await fetch(`${baseUrl}/runtime-config.js`);
    expect(runtimeConfig.status).toBe(200);
    expect(await runtimeConfig.text()).toContain("__APP_CONFIG__");

    const appEntry = await fetch(`${baseUrl}/src/main.tsx`);
    expect(appEntry.status).toBe(200);
    expect(appEntry.headers.get("content-type") ?? "").toContain("javascript");
    expect(await appEntry.text()).toContain("ReactDOM");
  });

  test("falls back to the app shell for unknown client-side routes", async () => {
    const missingClientRoute = await fetch(`${baseUrl}/unknown/client/path`);
    expect(missingClientRoute.status).toBe(200);
    expect(await missingClientRoute.text()).toContain('<div id="app">');
  });
});
