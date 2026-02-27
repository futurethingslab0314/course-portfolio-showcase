import 'dotenv/config';
import { generateCourseWebsite } from '../services/generator';

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    throw new Error('Usage: npm run generate:course -- <slug>');
  }

  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const result = await generateCourseWebsite(slug, baseUrl);
  console.log(JSON.stringify(result, null, 2));

  if (result.status !== 'generated') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
