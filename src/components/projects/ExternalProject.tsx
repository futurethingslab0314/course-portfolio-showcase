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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-black/50">
        <p>若網頁無法顯示，可直接開啟外部網站。</p>
        <a href={externalUrl} className="font-medium text-black underline underline-offset-4">開啟外部網站 ↗</a>
      </div>
      <iframe
        key={externalUrl}
        src={externalUrl}
        title={title}
        className="w-full h-[75vh] min-h-[480px] rounded-xl border border-black/10 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        allowFullScreen
      />
    </section>
  );
}
