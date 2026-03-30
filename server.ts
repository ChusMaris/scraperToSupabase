import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing for API requests
  app.use(express.json());

  // SERVER-SIDE DATA FETCHER ENDPOINT
  // This bypasses IT filters because the request comes from the server, not the browser.
  app.get("/api/data-fetcher", async (req, res) => {
    const targetUrl = req.query.url as string;
    
    if (!targetUrl) {
      return res.status(400).json({ error: "URL is required" });
    }

    const userAgents = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    ];
    const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];

    try {
      console.log(`[Proxy] Fetching: ${targetUrl}`);
      
      // Small random delay to avoid being too "robotic"
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      const isApi = targetUrl.includes('optimalwayconsulting.com');
      
      const headers: any = {
        'User-Agent': randomUA,
        'Accept': isApi ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ca-ES,ca;q=0.9,es-ES;q=0.8,es;q=0.7,en;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.basquetcatala.cat/',
        'Origin': 'https://www.basquetcatala.cat',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua-Mobile': randomUA.includes('Mobile') ? '?1' : '?0',
        'Sec-Ch-Ua-Platform': randomUA.includes('iPhone') ? '"iOS"' : randomUA.includes('Android') ? '"Android"' : '"Windows"',
      };

      if (isApi) {
        headers['X-Requested-With'] = 'XMLHttpRequest';
        headers['Sec-Fetch-Dest'] = 'empty';
        headers['Sec-Fetch-Mode'] = 'cors';
        headers['Sec-Fetch-Site'] = 'cross-site';
        headers['Accept'] = 'application/json, text/plain, */*';
      } else {
        headers['Upgrade-Insecure-Requests'] = '1';
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-Site'] = 'none';
        headers['Sec-Fetch-User'] = '?1';
      }

      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: headers
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        console.error(`[Proxy Error] ${targetUrl} returned status ${response.status}. Body: ${errorText.substring(0, 200)}...`);
        return res.status(response.status).json({ 
          error: `Target returned status ${response.status}`,
          details: errorText.substring(0, 500)
        });
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const json = await response.json();
        res.json(json);
      } else {
        const text = await response.text();
        res.send(text);
      }
    } catch (error: any) {
      console.error(`[Proxy Error] ${targetUrl}:`, error);
      const status = error.name === 'AbortError' ? 504 : 500;
      const message = error.name === 'AbortError' ? "Timeout fetching target URL" : "Failed to fetch target URL";
      res.status(status).json({ error: message, details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
