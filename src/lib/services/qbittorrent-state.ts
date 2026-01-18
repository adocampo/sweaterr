/**
 * In-memory store for qBittorrent simulated state
 * This allows Sonarr to see categories it creates during the session
 */

let categories: Set<string> = new Set();

export function addCategory(category: string) {
  if (category && category.trim()) {
    categories.add(category.trim());
  }
}

export function getCategories() {
  const result: Record<string, any> = {};
  categories.forEach(cat => {
    result[cat] = {
      name: cat,
      savePath: '/downloads',
    };
  });
  return result;
}

export function getAllCategories() {
  return Array.from(categories);
}

export function resetCategories() {
  categories.clear();
}
