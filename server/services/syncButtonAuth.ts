type AuthResult = {
  ok: boolean;
  method?: 'token' | 'secret';
  message?: string;
};

type Params = {
  slug: string;
  token: string;
  secret: string;
  validateCourseToken: (slug: string, token: string) => Promise<boolean>;
  validateGlobalSecret: (secret: string) => { ok: boolean; message?: string };
};

function looksLikeMissingTokenTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('course_sync_tokens');
}

export async function resolveSyncButtonAuth(params: Params): Promise<AuthResult> {
  const slug = String(params.slug || '').trim();
  const token = String(params.token || '').trim();
  const secret = String(params.secret || '').trim();

  if (!slug) {
    return { ok: false, message: 'Missing required query param: slug' };
  }

  if (token) {
    try {
      const pass = await params.validateCourseToken(slug, token);
      if (pass) return { ok: true, method: 'token' };
    } catch (error) {
      if (!looksLikeMissingTokenTableError(error)) {
        throw error;
      }
      // fallback to global secret path below if available
    }
  }

  if (secret) {
    const auth = params.validateGlobalSecret(secret);
    if (auth.ok) return { ok: true, method: 'secret' };
  }

  return {
    ok: false,
    message: 'Unauthorized: invalid course token/secret',
  };
}
