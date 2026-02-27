import 'dotenv/config';
import express from 'express';
import { buildCoursePayloadBySlug, generateCourseWebsite } from './services/generator';
import { fetchAllCourses } from './services/notion';

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 8787);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/course/:slug', async (req, res) => {
  try {
    const payload = await buildCoursePayloadBySlug(req.params.slug);
    res.json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

app.get('/api/courses', async (_req, res) => {
  try {
    const courses = await fetchAllCourses();
    res.json({ courses });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown server error',
    });
  }
});

app.post('/api/generate', async (req, res) => {
  const slug = String(req.body?.slug || '').trim();
  if (!slug) {
    res.status(400).json({ error: 'slug is required' });
    return;
  }

  try {
    const result = await generateCourseWebsite(slug, baseUrl);
    const statusCode = result.status === 'generated' ? 200 : 500;
    res.status(statusCode).json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown generate failure' });
  }
});

app.listen(port, () => {
  console.log(`[server] listening on ${port}`);
});
