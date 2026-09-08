import React from 'react';

export function ExternalProject({ title, url }: { title: string; url?: string }) {
  let externalUrl = '';
  try {
    const parsed = new URL(url || '');
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') externalUrl = parsed.href;
  } catch {
    // Missing or malformed URLs render an empty state.
  }

  if (!externalUrl) {
    return <p className="py-16 text-center text-black/50">尚未設定有效的外部連結。</p>;
  }

  return (
    <section className="relative flex-1 min-h-0 w-full">
      <div className="absolute right-4 bottom-4 z-10 rounded-full bg-white/90 px-4 py-2 text-xs shadow-sm">
        <a href={externalUrl} className="font-medium text-black underline underline-offset-4">開啟外部網站 ↗</a>
      </div>
      <iframe
        key={externalUrl}
        src={externalUrl}
        title={title}
        className="absolute inset-0 block h-full w-full border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        allowFullScreen
      />
    </section>
  );
}
