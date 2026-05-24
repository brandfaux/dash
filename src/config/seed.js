/**
 * config/seed.js — Demo data seeder for empty stores
 */

import { getCourses, writeCourseBundle } from '../store/content.js';
import { PLATFORM } from './platform.js';

function generateSampleCourse() {
  const videoIds = [
    'dQw4w9WgXcQ',  // Sample video 1
    '9bZkp7q19f0',  // Sample video 2
    'OPf0YbXqDm0',  // Sample video 3
  ];
  
  const lessons = videoIds.map((videoId, i) => ({
    id: crypto.randomUUID(),
    title: `Sample Lesson ${i + 1}`,
    videoId: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    position: i,
    description: `This is a sample lesson to get you started with ${PLATFORM.name}.`
  }));
  
  return {
    course: {
      id: crypto.randomUUID(),
      title: `Welcome to ${PLATFORM.name}`,
      level: 'Beginner',
      label: 'Sample Course',
      accent: '#e94560',
      source: 'sample',
      description: 'This sample course demonstrates how LearnEngine works. Import your own content to get started!'
    },
    modules: [{
      mod: {
        id: crypto.randomUUID(),
        title: 'Introduction',
        position: 1
      },
      lessons: lessons
    }]
  };
}

export function seedIfEmpty() {
  const courses = getCourses();
  if (courses.length === 0 && PLATFORM.features.import) {
    const bundle = generateSampleCourse();
    writeCourseBundle(bundle);
    console.log('🌱 Seeded sample course');
  }
}