import React from 'react';
import { BlogQuickJumpItem } from './blogPostNavigation';

interface BlogQuickJumpNavProps {
  items: BlogQuickJumpItem[];
  activeAnchorId?: string;
}

export function BlogQuickJumpNav({ items, activeAnchorId }: BlogQuickJumpNavProps) {
  if (!items.length) {
    return null;
  }

  return (
    <nav aria-label="Blog quick jump" className="mb-10 border-b border-black/10 pb-5">
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-black/35">Quick Jump</div>
      <div className="flex flex-wrap gap-2.5">
        {items.map((item) => {
          const isActive = item.anchorId === activeAnchorId;
          return (
            <a
              key={item.anchorId}
              href={`#${item.anchorId}`}
              aria-current={isActive ? 'true' : undefined}
              className={
                isActive
                  ? 'rounded-full border border-black bg-black px-3 py-1.5 text-xs font-semibold text-white transition-colors'
                  : 'rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/65 transition-colors hover:border-black/20 hover:text-black'
              }
            >
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
