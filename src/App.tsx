import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { Project, StudentWork, Course } from './types';
import { filterWorksForProject, loadCoursePayloadBySlug, loadCoursesForHome } from './data/courseData';

// Components
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { CardSpec } from './components/projects/CardSpec';
import { GalleryStory } from './components/projects/GalleryStory';
import { GallerySlide } from './components/projects/GallerySlide';
import { GenericCard } from './components/projects/GenericCard';
import { DataMatrix } from './components/projects/DataMatrix';
import { BlogPost } from './components/projects/BlogPost';
import { ActivityEvent } from './components/projects/ActivityEvent';
import { CardCase } from './components/projects/CardCase';

// Templates
import { HomePageTemplate } from './components/templates/HomePageTemplate';
import { CourseDetailTemplate } from './components/templates/CourseDetailTemplate';
import { AdminSyncCourseTemplate } from './components/templates/AdminSyncCourseTemplate';

const StudentWorkItem = ({ work, style, courseTitle }: { work: StudentWork; style: Project['displayStyle']; courseTitle: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  switch (style) {
    case 'card-spec':
      return <CardSpec work={work} zoomedImage={zoomedImage} setZoomedImage={setZoomedImage} />;
    case 'gallery-story':
      return <GalleryStory work={work} courseTitle={courseTitle} isExpanded={isExpanded} setIsExpanded={setIsExpanded} zoomedImage={zoomedImage} setZoomedImage={setZoomedImage} />;
    case 'gallery-slide':
      return <GallerySlide work={work} courseTitle={courseTitle} />;
    case 'generic-card':
      return <GenericCard work={work} />;
    case 'blog-post':
      return <BlogPost work={work} />;
    case 'activity-event':
      return <ActivityEvent work={work} />;
    case 'card-case':
      return <CardCase work={work} />;
    default:
      return <GenericCard work={work} />;
  }
};

const HomePage = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    loadCoursesForHome()
      .then((next) => {
        if (!active) return;
        setCourses(next);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) return;
        setCourses([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load courses.');
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
      const next = await loadCoursesForHome({ refresh: true });
      setCourses(next);
      setLoadError(null);
    } catch (error) {
      setCourses([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to refresh courses.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {loadError ? (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700">
          Failed to load latest data: {loadError}
        </div>
      ) : null}
      <HomePageTemplate courses={courses} onSyncData={handleSyncData} isSyncing={isSyncing} />
    </>
  );
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [studentWorks, setStudentWorks] = useState<StudentWork[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadCourseData = async (slugOrId: string, options?: { refresh?: boolean }) => {
    const payload = await loadCoursePayloadBySlug(slugOrId, options);
    setCourse(payload.course);
    setProjects(payload.projects);
    setStudentWorks(payload.studentWorks);
    setLoadError(null);
    setActiveProjectId((prev) => {
      const exists = payload.projects.some((project) => project.id === prev);
      return exists ? prev : payload.projects[0]?.id;
    });
  };

  useEffect(() => {
    let active = true;
    if (!id) return;

    loadCoursePayloadBySlug(id)
      .then((payload) => {
        if (!active) return;
        setCourse(payload.course);
        setProjects(payload.projects);
        setStudentWorks(payload.studentWorks);
        setLoadError(null);
        setActiveProjectId(payload.projects[0]?.id);
      })
      .catch((error) => {
        if (!active) return;
        setCourse(null);
        setProjects([]);
        setStudentWorks([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to load course.');
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
      await loadCourseData(id, { refresh: true });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to refresh course.');
    } finally {
      setIsSyncing(false);
    }
  };

  const works = useMemo(() => 
    filterWorksForProject(studentWorks, projects, activeProjectId),
    [activeProjectId, projects, studentWorks]
  );

  if (loadError) {
    return <div className="p-6 text-red-700">Failed to load course data: {loadError}</div>;
  }

  if (!course) return <div>Loading course...</div>;

  return (
    <CourseDetailTemplate 
      course={course}
      projects={projects}
      activeProjectId={activeProjectId}
      setActiveProjectId={setActiveProjectId}
      works={works}
      StudentWorkItem={StudentWorkItem}
      courseTitle={course.courseName}
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
        <Route path="/admin/sync-course" element={<AdminSyncCourseTemplate />} />
      </Routes>
    </Router>
  );
}
