import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(port = Number(process.env.PORT || 3010)) {
  const app = express();

  app.get('/api/proxy', async (req, res) => {
    const rawUrl = req.query.url;

    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      res.status(400).json({ error: 'Missing url query parameter.' });
      return;
    }

    try {
      const targetUrl = decodeURIComponent(rawUrl);
      const parsedTarget = new URL(targetUrl);

      if (!['http:', 'https:'].includes(parsedTarget.protocol)) {
        throw new Error('Only http and https targets are allowed.');
      }

      const response = await fetch(targetUrl, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; ScraperProxy/1.0)'
        },
        redirect: 'follow'
      });

      const responseText = await response.text();
      const contentType = response.headers.get('content-type') ?? 'application/json';
      res.status(response.status);
      res.setHeader('Content-Type', contentType);
      res.send(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown proxy error';
      console.error('Local proxy error:', message);
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const listenOnPort = (currentPort: number) => {
    const server = app.listen(currentPort, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${currentPort}`);
    });

    server.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        console.warn(`Port ${currentPort} is busy, trying ${currentPort + 1}...`);
        server.close();
        listenOnPort(currentPort + 1);
      } else {
        console.error(error);
        process.exit(1);
      }
    });
  };

  listenOnPort(port);
}

startServer();
