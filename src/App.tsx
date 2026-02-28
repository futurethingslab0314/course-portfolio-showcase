import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { Project, StudentWork, Course } from './types';
import { fallbackCourses, filterWorksForProject, loadCoursePayloadBySlug, loadCoursesForHome } from './data/courseData';

// Components
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CardSpec } from './components/projects/CardSpec';
import { GalleryStory } from './components/projects/GalleryStory';
import { GallerySlide } from './components/projects/GallerySlide';
import { GenericCard } from './components/projects/GenericCard';
import { DataMatrix } from './components/projects/DataMatrix';

// Templates
import { HomePageTemplate } from './components/templates/HomePageTemplate';
import { CourseDetailTemplate } from './components/templates/CourseDetailTemplate';

const StudentWorkItem = ({ work, style }: { work: StudentWork; style: Project['displayStyle'] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  switch (style) {
    case 'card-spec':
      return <CardSpec work={work} zoomedImage={zoomedImage} setZoomedImage={setZoomedImage} />;
    case 'gallery-story':
      return <GalleryStory work={work} isExpanded={isExpanded} setIsExpanded={setIsExpanded} zoomedImage={zoomedImage} setZoomedImage={setZoomedImage} />;
    case 'gallery-slide':
      return <GallerySlide work={work} />;
    case 'generic-card':
      return <GenericCard work={work} />;
    default:
      return <GenericCard work={work} />;
  }
};

const HomePage = () => {
  const [courses, setCourses] = useState<Course[]>(fallbackCourses());
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    loadCoursesForHome().then((next) => {
      if (active) setCourses(next);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.title = 'Course Portfolio Showcase';
  }, []);

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const next = await loadCoursesForHome();
      setCourses(next);
    } finally {
      setIsSyncing(false);
    }
  };

  return <HomePageTemplate courses={courses} onSyncData={handleSyncData} isSyncing={isSyncing} />;
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [studentWorks, setStudentWorks] = useState<StudentWork[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadCourseData = async (slugOrId: string) => {
    const payload = await loadCoursePayloadBySlug(slugOrId);
    setCourse(payload.course);
    setProjects(payload.projects);
    setStudentWorks(payload.studentWorks);
    setActiveProjectId((prev) => {
      const exists = payload.projects.some((project) => project.id === prev);
      return exists ? prev : payload.projects[0]?.id;
    });
  };

  useEffect(() => {
    let active = true;
    if (!id) return;

    loadCoursePayloadBySlug(id).then((payload) => {
      if (!active) return;
      setCourse(payload.course);
      setProjects(payload.projects);
      setStudentWorks(payload.studentWorks);
      setActiveProjectId(payload.projects[0]?.id);
    });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (course?.courseName) {
      document.title = course.courseName;
    }
  }, [course?.courseName]);

  const handleSyncData = async () => {
    if (!id) return;
    setIsSyncing(true);
    try {
      await loadCourseData(id);
    } finally {
      setIsSyncing(false);
    }
  };

  const works = useMemo(() => 
    filterWorksForProject(studentWorks, projects, activeProjectId),
    [activeProjectId, projects, studentWorks]
  );

  if (!course) return <div>Loading course...</div>;

  return (
    <CourseDetailTemplate 
      course={course}
      projects={projects}
      activeProjectId={activeProjectId}
      setActiveProjectId={setActiveProjectId}
      works={works}
      StudentWorkItem={StudentWorkItem}
      onSyncData={handleSyncData}
      isSyncing={isSyncing}
    />
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/course/:id" element={<CourseDetailPage />} />
      </Routes>
    </Router>
  );
}
