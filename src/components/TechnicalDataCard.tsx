import React from 'react';

export const TechnicalDataCard = ({ content }: { content: string }) => (
  <div className="bg-white border border-black/5 p-6 rounded-lg font-mono text-[13px] leading-relaxed shadow-sm">
    <p className="text-black/80 whitespace-pre-wrap">{content}</p>
  </div>
);
