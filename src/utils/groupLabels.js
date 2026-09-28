// ============================================================
// GROUP LABELS
// A "Series" (golf trip) is stored exactly like a League — same
// Firebase paths, same standings logic — with meta.type = 'series'.
// This helper returns the on-screen words for each, so the UI can
// say "Series" / "Organizer" instead of "League" / "Commissioner".
// ============================================================

export function isSeriesGroup(group) {
  return group?.meta?.type === 'series';
}

export function getGroupLabels(isSeries) {
  return isSeries
    ? { noun: 'Series', nounLower: 'series', organizer: 'Organizer', icon: '🧳' }
    : { noun: 'League', nounLower: 'league', organizer: 'Commissioner', icon: '🏆' };
}
