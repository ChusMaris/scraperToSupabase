import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'proxy-server',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (req.url?.startsWith('/api/data-fetcher')) {
              const urlParams = new URL(req.url, `http://${req.headers.host}`);
              const targetUrl = urlParams.searchParams.get('url');
              
              if (!targetUrl) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: "URL is required" }));
              }

              try {
                const response = await fetch(targetUrl, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Referer': 'https://www.basquetcatala.cat/',
                  }
                });
                
                const data = await response.text();
                res.setHeader('Content-Type', response.headers.get('content-type') || 'text/plain');
                res.end(data);
              } catch (error) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: "Failed to fetch" }));
              }
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      port: 3000,
    },
  };
});