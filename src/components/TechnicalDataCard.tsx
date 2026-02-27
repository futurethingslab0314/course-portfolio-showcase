import React from 'react';
import { StudentWork } from '../types';

export const TechnicalDataCard = ({ work }: { work: StudentWork }) => (
  <div className="bg-white border border-black/5 p-6 rounded-lg font-mono text-[13px] leading-relaxed shadow-sm">
    {work.dataSpecs?.map((spec, i) => (
      <div key={i} className="mb-1">
        <span className="text-black/40">[{spec.label}]</span>{' '}
        <span className="text-black/80">{spec.value}</span>
        {i === 0 && <span className="float-right text-black/20">{spec.timestamp}</span>}
      </div>
    ))}
  </div>
);
