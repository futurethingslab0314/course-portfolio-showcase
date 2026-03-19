import React from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Users,
  X,
} from 'lucide-react';
import { StudentWork } from '../../types';
import { cn } from '../../lib/utils';

export function ActivityEventCardContent({ work }: { work: StudentWork }) {
  return (
    <>
      <div className="relative aspect-video overflow-hidden">
        <img
          src={work.mainImage}
          alt={work.assignmentName}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute left-4 top-4">
          <span className="rounded-full bg-black/80 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-white backdrop-blur-md">
            {work.themeTag || work.tags?.[0] || 'Activity'}
          </span>
        </div>
      </div>

      <div className="flex flex-grow flex-col p-6">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-black/40">
          <Calendar size={12} />
          <span>{work.year || 'Undated'}</span>
          <span className="mx-1">•</span>
          <Globe size={12} />
          <span>{work.city || 'Global'}{work.country ? `, ${work.country}` : ''}</span>
        </div>

        <h3 className="mb-3 line-clamp-2 text-xl font-bold tracking-tight transition-colors group-hover:text-black/60">
          {work.assignmentName}
        </h3>

        <p className="mb-6 flex-grow line-clamp-3 text-sm font-medium leading-relaxed text-black/50">
          {work.description}
        </p>

        <div className="flex items-center justify-between border-t border-black/5 pt-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/5">
              <Award size={12} className="text-black/40" />
            </div>
            <span className="max-w-[150px] truncate text-[10px] font-bold uppercase tracking-widest text-black/60">
              {work.grant || 'Self-funded'}
            </span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/30">
            View Details
          </div>
        </div>
      </div>
    </>
  );
}

export function ActivityEventDetailContent({
  work,
  currentImageIndex,
  setCurrentImageIndex,
  onClose,
}: {
  work: StudentWork;
  currentImageIndex: number;
  setCurrentImageIndex: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}) {
  const allImages = [work.mainImage, ...(work.moreImages || [])].filter(Boolean);

  const showPrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const showNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
  };

  return (
    <div className="relative z-10 flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:flex-row">
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-50 rounded-full bg-black/5 p-2 text-black transition-colors hover:bg-black/10"
        aria-label="Close activity details"
      >
        <X size={20} />
      </button>

      <div className="relative flex h-[40vh] w-full items-center justify-center overflow-hidden bg-neutral-100 md:h-auto md:w-3/5">
        <img
          src={allImages[currentImageIndex]}
          alt={`${work.assignmentName} image ${currentImageIndex + 1}`}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />

        {allImages.length > 1 ? (
          <>
            <button
              onClick={showPrevious}
              className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-4 text-white backdrop-blur-md transition-all hover:bg-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={showNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 p-4 text-white backdrop-blur-md transition-all hover:bg-white/20"
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>
            <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 gap-3">
              {allImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(idx);
                  }}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    idx === currentImageIndex ? 'w-8 bg-white' : 'w-2 bg-white/40',
                  )}
                  aria-label={`View image ${idx + 1}`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="w-full overflow-y-auto bg-white p-8 md:w-2/5 md:p-12">
        <div className="mb-10">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-full bg-black px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
              {work.themeTag || work.tags?.[0] || 'Activity'}
            </span>
            {work.year ? <span className="text-[10px] font-bold uppercase tracking-widest text-black/30">{work.year}</span> : null}
          </div>

          <h2 className="mb-6 text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
            {work.assignmentName}
          </h2>

          <div className="mb-8 space-y-4">
            {(work.startDate || work.endDate) ? (
              <div className="flex items-center gap-3 text-black/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5">
                  <Calendar size={14} />
                </div>
                <span className="text-sm font-semibold">
                  {work.startDate} {work.endDate ? `— ${work.endDate}` : ''}
                </span>
              </div>
            ) : null}
            {(work.city || work.country) ? (
              <div className="flex items-center gap-3 text-black/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5">
                  <Globe size={14} />
                </div>
                <span className="text-sm font-semibold">
                  {work.city}{work.city && work.country ? ', ' : ''}{work.country}
                </span>
              </div>
            ) : null}
          </div>

          <p className="text-base font-medium leading-relaxed text-black/60">
            {work.description}
          </p>
        </div>

        <div className="space-y-8 border-t border-black/5 pt-10">
          {work.grant ? (
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-neutral-50">
                <Award size={20} className="text-black/40" />
              </div>
              <div>
                <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-black/30">Grant / Sponsor</h4>
                <p className="text-sm font-bold text-black/80">{work.grant}</p>
              </div>
            </div>
          ) : null}

          {work.publicationName ? (
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-neutral-50">
                <BookOpen size={20} className="text-black/40" />
              </div>
              <div>
                <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-black/30">Publication</h4>
                <p className="text-sm font-bold text-black/80">{work.publicationName}</p>
              </div>
            </div>
          ) : null}

          {work.members.length ? (
            <div className="flex gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-black/5 bg-neutral-50">
                <Users size={20} className="text-black/40" />
              </div>
              <div>
                <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-black/30">Members / Authors</h4>
                <div className="flex flex-wrap gap-2">
                  {work.members.map((member) => (
                    <span key={member} className="rounded-md bg-black/5 px-3 py-1 text-xs font-bold text-black/70">
                      {member}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {work.url ? (
            <a
              href={work.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-black transition-opacity hover:opacity-60"
            >
              Visit related link
              <ExternalLink size={16} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
