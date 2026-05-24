/**
 * ingestion/autoGroup.js
 * Auto-organize lessons into modules by week or fixed group size.
 */

/**
 * Group lessons into modules.
 *
 * @param {Array} lessons - Array of lesson objects with optional `week` property
 * @param {Object} options
 *   - groupSize: default group size if no week field (default: 5)
 *   - groupByField: field name to group by (default: 'week')
 *   - moduleLabel: function to generate module title (default: n => `Week ${n}`)
 * @returns Array of { title, position, lessons } objects
 */
export function autoGroup(lessons, options = {}) {
  const {
    groupSize = 5,
    groupByField = 'week',
    moduleLabel = n => `Week ${n}`,
  } = options;

  if (!Array.isArray(lessons) || !lessons.length) return [];

  // Check if lessons have the groupByField
  const hasGroupField = lessons.some(l => l[groupByField] != null);

  if (hasGroupField) {
    // Group by explicit field (e.g., week)
    return groupByField(lessons, moduleLabel);
  }

  // Group by fixed size
  return groupBySize(lessons, groupSize, moduleLabel);
}

function groupByField(lessons, moduleLabel) {
  const groups = {};

  lessons.forEach(lesson => {
    const groupKey = lesson.week || 'ungrouped';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(lesson);
  });

  // Sort by week number or alphabetically
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const aNum = parseInt(a) || Infinity;
      const bNum = parseInt(b) || Infinity;
      return aNum - bNum;
    })
    .map(([groupKey, groupLessons], i) => ({
      title: moduleLabel(parseInt(groupKey) || groupKey),
      position: i + 1,
      lessons: groupLessons,
    }));
}

function groupBySize(lessons, size, moduleLabel) {
  const groups = [];

  for (let i = 0; i < lessons.length; i += size) {
    groups.push({
      title: moduleLabel(groups.length + 1),
      position: groups.length + 1,
      lessons: lessons.slice(i, i + size),
    });
  }

  return groups;
}
