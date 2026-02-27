import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Course } from '../types';

export const CourseCard = ({ course }: { course: Course; key?: React.Key }) => (
  <Link 
    to={`/course/${course.slug || course.id}`}
    className="group relative overflow-hidden rounded-2xl bg-white border border-black/5 shadow-sm hover:shadow-xl transition-all duration-500"
  >
    <div className="aspect-[16/9] overflow-hidden">
      <img 
        src={course.coverImage} 
        alt={course.courseName}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="p-6">
      <h3 className="text-2xl font-bold tracking-tight mb-2">{course.courseName}</h3>
      <p className="text-black/60 text-sm line-clamp-2 mb-4">{course.courseSummary}</p>
      <div className="flex items-center text-xs font-bold uppercase tracking-widest group-hover:gap-2 transition-all">
        View Portfolio <ArrowRight size={14} />
      </div>
    </div>
  </Link>
);
