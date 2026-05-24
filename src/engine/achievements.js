/**
 * engine/achievements.js — Badge unlock logic
 */

import { getStats, grantAchievement, hasAchievement } from '../store/user.js';
import { getAllProgress } from '../store/progress.js';
import { getAllLessonsForCourse, getCourses } from '../store/content.js';
import { ACHIEVEMENTS } from '../config/achievements.js';

export function evaluateAchievements() {
  const stats = getStats();
  const progress = getAllProgress();
  const courses = getCourses();
  
  const allLessons = courses.flatMap(c => getAllLessonsForCourse(c.id));
  const totalCompleted = allLessons.filter(l => progress[l.id]?.completed).length;
  const todayCompleted = allLessons.filter(l => {
    const p = progress[l.id];
    if (!p?.completed || !p.lastSeen) return false;
    const today = new Date().toISOString().slice(0, 10);
    return new Date(p.lastSeen).toISOString().slice(0, 10) === today;
  }).length;
  
  const unlocked = [];
  
  // Streak Master (7+ day streak)
  if (stats.streak >= 7 && !hasAchievement('streak_7')) {
    grantAchievement('streak_7');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'streak_7'));
  }
  
  // Focused (5 lessons in a day)
  if (todayCompleted >= 5 && !hasAchievement('lessons_5_day')) {
    grantAchievement('lessons_5_day');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'lessons_5_day'));
  }
  
  // Dedicated (50+ XP)
  if (stats.xp >= 50 && !hasAchievement('xp_50')) {
    grantAchievement('xp_50');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'xp_50'));
  }
  
  // Speed Runner (10+ lessons total)
  if (totalCompleted >= 10 && !hasAchievement('lessons_10')) {
    grantAchievement('lessons_10');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'lessons_10'));
  }
  
  // Knowledge Seeker (500+ XP)
  if (stats.xp >= 500 && !hasAchievement('xp_500')) {
    grantAchievement('xp_500');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'xp_500'));
  }
  
  // Quick Learner (first lesson completed)
  if (totalCompleted >= 1 && !hasAchievement('first_lesson_fast')) {
    grantAchievement('first_lesson_fast');
    unlocked.push(ACHIEVEMENTS.find(a => a.id === 'first_lesson_fast'));
  }
  
  return unlocked;
}