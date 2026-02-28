import { Course, Project, StudentWork } from './types';

export const COURSES: Course[] = [
  {
    id: 'course-1',
    slug: 'data-enabled-creative-design',
    courseName: 'Data-Enabled Creative Design',
    courseSummary: 'Exploring the intersection of data science and creative design methodologies at National Taiwan University of Science and Technology.',
    coverImage: 'https://picsum.photos/seed/course1/1200/600',
    projectIds: ['p1', 'p2', 'p3', 'p4', 'p5']
  },
  {
    id: 'course-2',
    slug: 'interaction-design-studio',
    courseName: 'Interaction Design Studio',
    courseSummary: 'Advanced studio course focusing on human-centered interaction patterns and digital product prototyping.',
    coverImage: 'https://picsum.photos/seed/course2/1200/600',
    projectIds: ['p5']
  }
];

export const PROJECTS: Project[] = [
  {
    id: 'p1',
    projectName: 'Seeing Like a Thing',
    projectDescription: 'Investigating how non-human objects perceive and interact with their environment through sensor data.',
    courseId: 'course-1',
    tabName: 'SEEING LIKE A THING',
    order: 1,
    sourceDatabaseId: 'db-seeing',
    displayStyle: 'card-spec'
  },
  {
    id: 'p2',
    projectName: 'Everyday Data Tracking',
    projectDescription: 'A collection of projects exploring the personal data we generate in our daily lives.',
    courseId: 'course-1',
    tabName: 'EVERYDAY TRACKING',
    order: 2,
    sourceDatabaseId: 'db-tracking',
    displayStyle: 'gallery-story'
  },
  {
    id: 'p3',
    projectName: 'Visual Narratives',
    projectDescription: 'Using data visualization to tell compelling stories about social and environmental issues.',
    courseId: 'course-1',
    tabName: 'VISUAL NARRATIVES',
    order: 3,
    sourceDatabaseId: 'db-narratives',
    displayStyle: 'gallery-slide'
  },
  {
    id: 'p4',
    projectName: 'Quick Prototypes',
    projectDescription: 'Rapid experimentation with various creative coding tools and physical computing.',
    courseId: 'course-1',
    tabName: 'QUICK PROTOTYPES',
    order: 4,
    sourceDatabaseId: 'db-prototypes',
    displayStyle: 'generic-card'
  },
  {
    id: 'p5',
    projectName: 'Data Matrix Collection',
    projectDescription: 'A systematic arrangement of student works mapped across a 16x30 coordinate grid.',
    courseId: 'course-1',
    tabName: 'DATA MATRIX',
    order: 5,
    sourceDatabaseId: 'db-matrix',
    displayStyle: 'data-matrix'
  }
];

export const STUDENT_WORKS: StudentWork[] = [
  // DB: Seeing Like a Thing (Technical Data Style)
  {
    id: 'sw-1',
    assignmentName: '主題一：Seeing Like a Thing',
    members: ['林志明', '陳大文'],
    description: '這個主題是關於物件如何透過感測器觀察世界。我們選擇了廚房門把作為研究對象。',
    mainImage: 'https://picsum.photos/seed/thing1/800/800',
    tags: ['DATA CHARADES'],
    year: '2026',
    isStarred: true,
    dataSpecs: [
      '[timestamp] 2026/02/02 10:00',
      '[location] 廚房門把',
      '[data type] 有無震動 (Y=1 ; N=0)',
      '[data value] 0'
    ],
    sourceDatabaseId: 'db-seeing'
  },
  {
    id: 'sw-2',
    assignmentName: '主題一：Seeing Like a Thing',
    members: ['林志明', '陳大文'],
    description: '當門把被觸碰時，數據產生了明顯的變化。',
    mainImage: 'https://picsum.photos/seed/thing2/800/800',
    tags: ['DATA CHARADES'],
    year: '2026',
    dataSpecs: [
      '[timestamp] 2026/02/02 10:10',
      '[location] 廚房門把',
      '[data type] 有無震動 (Y=1 ; N=0)',
      '[data value] 1'
    ],
    sourceDatabaseId: 'db-seeing'
  },

  // DB: Everyday Tracking (Grid Expandable Style)
  {
    id: 'sw-3',
    assignmentName: '聽見你的消費風景',
    members: ['鄭秀芳', '陳玉書'],
    description: '透過記錄每日的消費行為，我們試圖找出隱藏在金錢流動背後的個人情緒與生活節奏。',
    mainImage: 'https://picsum.photos/seed/track1/800/600',
    moreImages: [
      'https://picsum.photos/seed/track1-1/800/600',
      'https://picsum.photos/seed/track1-2/800/600',
      'https://picsum.photos/seed/track1-3/800/600'
    ],
    methodologies: ['DEAR DATA [SELF]'],
    year: '2024',
    sourceDatabaseId: 'db-tracking'
  },
  {
    id: 'sw-4',
    assignmentName: '咖啡因的律動',
    members: ['林小明'],
    description: '追蹤一個月內的咖啡攝取量，並將其轉化為視覺化的旋律。',
    mainImage: 'https://picsum.photos/seed/track2/800/600',
    methodologies: ['AUTO-ETHNOGRAPHY'],
    year: '2024',
    sourceDatabaseId: 'db-tracking'
  },

  // DB: Visual Narratives (Editorial Focus Style)
  {
    id: 'sw-5',
    assignmentName: '菸蒂的生命週期',
    members: ['許立琦', '楊凱雯'],
    description: '全球每年有超過 4.5 兆個菸蒂被丟棄在環境中。每一根菸減少約 5.5 分鐘的壽命。',
    mainImage: 'https://picsum.photos/seed/narrative1/1200/800',
    moreImages: [
      'https://picsum.photos/seed/narrative1-1/800/600',
      'https://picsum.photos/seed/narrative1-2/800/600'
    ],
    tags: ['ENVIRONMENTAL', 'DATA VIZ'],
    year: '2025',
    sourceDatabaseId: 'db-narratives'
  },

  // DB: Quick Prototypes (Simple Grid Style)
  {
    id: 'sw-6',
    assignmentName: 'P5.js Generative Art',
    members: ['張三'],
    description: 'A simple exploration of Perlin noise and particle systems.',
    mainImage: 'https://picsum.photos/seed/proto1/400/400',
    year: '2026',
    sourceDatabaseId: 'db-prototypes'
  },
  {
    id: 'sw-7',
    assignmentName: 'Arduino Sensor Test',
    members: ['李四'],
    description: 'Testing ultrasonic sensors for distance measurement.',
    mainImage: 'https://picsum.photos/seed/proto2/400/400',
    year: '2026',
    sourceDatabaseId: 'db-prototypes'
  },
  {
    id: 'sw-8',
    assignmentName: 'Web MIDI Controller',
    members: ['王五'],
    description: 'Connecting a physical slider to a web-based synthesizer.',
    mainImage: 'https://picsum.photos/seed/proto3/400/400',
    year: '2026',
    sourceDatabaseId: 'db-prototypes'
  },
  // DB: Data Matrix (Grid Matrix Style)
  {
    id: 'sw-9',
    assignmentName: 'Matrix Work A5',
    members: ['Student A'],
    description: 'A project located at A5 in the matrix.',
    mainImage: 'https://picsum.photos/seed/matrix1/400/400',
    year: '2026',
    sourceDatabaseId: 'db-matrix',
    gridLocation: 'A5'
  },
  {
    id: 'sw-10',
    assignmentName: 'Matrix Work C12',
    members: ['Student B'],
    description: 'A project located at C12 in the matrix.',
    mainImage: 'https://picsum.photos/seed/matrix2/400/400',
    year: '2026',
    sourceDatabaseId: 'db-matrix',
    gridLocation: 'C12'
  },
  {
    id: 'sw-11',
    assignmentName: 'Matrix Work P30',
    members: ['Student C'],
    description: 'A project located at P30 in the matrix.',
    mainImage: 'https://picsum.photos/seed/matrix3/400/400',
    year: '2026',
    sourceDatabaseId: 'db-matrix',
    gridLocation: 'P30'
  },
  {
    id: 'sw-12',
    assignmentName: 'Matrix Work H15',
    members: ['Student D'],
    description: 'A project located at H15 in the matrix.',
    mainImage: 'https://picsum.photos/seed/matrix4/400/400',
    year: '2026',
    sourceDatabaseId: 'db-matrix',
    gridLocation: 'H15'
  },
];
