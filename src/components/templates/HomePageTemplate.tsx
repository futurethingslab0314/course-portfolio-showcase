import React from 'react';
import { CourseCard } from '../CourseCard';
import { Course } from '../../types';
import { Header } from '../Header';
import { Footer } from '../Footer';

interface HomePageTemplateProps {
  courses: Course[];
  onSyncData?: () => void;
  isSyncing?: boolean;
}

export const HomePageTemplate = ({ courses, onSyncData, isSyncing }: HomePageTemplateProps) => (
  <div className="min-h-screen bg-[#fcfcfc]">
    <Header onSyncData={onSyncData} isSyncing={isSyncing} />
    <main className="max-w-7xl mx-auto px-6 py-20">
      <div className="mb-20">
        <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold tracking-tighter mb-6 leading-[0.85]">
          COURSE<br />PORTFOLIO<br />SHOWCASE
        </h1>
        <p className="text-lg md:text-xl text-black/40 max-w-2xl font-medium">
          A curated collection of student projects from Dr. Yu-Ting Cheng's courses.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {courses.map(course => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </main>
    <Footer />
  </div>
);
