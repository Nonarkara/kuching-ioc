export function findNewsSummary(entries,item,lang) {
  const match = entries.find(entry=>entry.link === item.link && entry.title === item.title && entry.basis === 'headline-only');
  const text = match?.summaries?.[lang];
  return typeof text === 'string' && text.trim() ? text : null;
}
