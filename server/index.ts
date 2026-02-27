import 'dotenv/config';
import express from 'express';
import { buildCoursePayloadBySlug, generateCourseWebsite } from './services/generator';
import { fetchAllCourses } from './services/notion';

const app = express();
app.use(express.json());

const port = Number(process.env.PORT || 8787);
const baseUrl = process.env.BASE_URL || `http://localhost:${port}`;

function parseNotionStatusCode(message: string): number | null {
  const match = message.match(/Notion API error \((\d+)\)/);
  if (!match) return null;
  const status = Number(match[1]);
  return Number.isFinite(status) ? status : null;
}

function buildCoursesDiagnostics(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown server error';
  const notionStatus = parseNotionStatusCode(message);

  let likelyCause = 'Unknown';
  let suggestion = 'Check server logs and verify Notion integration configuration.';

  if (message.includes('Missing required env var')) {
    likelyCause = 'Missing environment variable';
    suggestion = 'Set NOTION_TOKEN, NOTION_DB_COURSES_ID, NOTION_DB_PROJECTS_ID, BASE_URL in Railway and redeploy.';
  } else if (notionStatus === 401) {
    likelyCause = 'Invalid NOTION_TOKEN';
    suggestion = 'Use the correct Internal Integration Token (ntn_...) in NOTION_TOKEN.';
  } else if (notionStatus === 403) {
    likelyCause = 'Notion integration has no access';
    suggestion = 'Share Courses/Projects/Source databases with the integration.';
  } else if (notionStatus === 404) {
    likelyCause = 'Database ID is invalid or inaccessible';
    suggestion = 'Verify NOTION_DB_COURSES_ID and integration access to that database.';
  } else if (notionStatus === 429) {
    likelyCause = 'Notion rate limit';
    suggestion = 'Retry after a delay.';
  }

  return {
    endpoint: '/api/courses',
    message,
    notionStatus,
    likelyCause,
    suggestion,
    envCheck: {
      NOTION_TOKEN: Boolean(process.env.NOTION_TOKEN),
      NOTION_DB_COURSES_ID: Boolean(process.env.NOTION_DB_COURSES_ID),
      NOTION_DB_PROJECTS_ID: Boolean(process.env.NOTION_DB_PROJECTS_ID),
      NOTION_API_VERSION: process.env.NOTION_API_VERSION || '(default: 2022-06-28)',
      BASE_URL: process.env.BASE_URL || '(missing)',
    },
  };
}

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
    const diagnostics = buildCoursesDiagnostics(error);
    res.status(500).json({
      error: diagnostics.message,
      diagnostics,
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
