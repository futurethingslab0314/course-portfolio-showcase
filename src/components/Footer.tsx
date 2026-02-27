import React from 'react';

export const Footer = () => (
  <footer className="bg-white border-t border-black/5 py-24 px-6 mt-20">
    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-16">
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-black/30 mb-6">Laboratory</h4>
        <h3 className="text-2xl font-bold mb-6">Future Things Lab</h3>
        <p className="text-xs text-black/40 leading-relaxed max-w-xs font-medium">
          A research-driven creative computing collective at National Taiwan University of Science and Technology.
        </p>
      </div>
      
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-black/30 mb-6">Instruction</h4>
        <p className="text-lg font-bold mb-6">
          授課 by <a href="#" className="underline underline-offset-8 decoration-1 hover:text-blue-600 transition-colors">dr. Yu-Ting Cheng</a>
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/30 leading-relaxed">
          © 2024-PRESENT DATA-ENABLED CREATIVE DESIGN. ALL PROJECTS CREATED BY STUDENTS.
        </p>
      </div>
      
      <div className="md:text-right flex flex-col md:items-end">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.3em] text-black/30 mb-6">Design Philosophy</h4>
        <h3 className="text-4xl font-bold mb-8 tracking-tighter">DESIGN x DATA x INSIGHT</h3>
        <div className="w-32 h-[1px] bg-black/10 mb-8" />
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-black/30 md:text-right max-w-[240px]">
          NATIONAL TAIWAN UNIVERSITY OF SCIENCE AND TECHNOLOGY
        </p>
      </div>
    </div>
  </footer>
);
