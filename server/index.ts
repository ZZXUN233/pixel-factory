import { getLLMProvider } from './lib/llm';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import generateRoutes from './routes/generate';
import galleryRoutes from './routes/gallery';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Report active LLM provider to frontend
app.get('/api/llm-provider', (_req, res) => {
  const provider = getLLMProvider();
  res.json({ provider: provider.name });
});

// Mount all API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api', generateRoutes);

// Setup development or production build static file serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer();