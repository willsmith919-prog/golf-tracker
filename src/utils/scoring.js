// Calculate Stableford points for a single hole
export const calculateStablefordPoints = (score, par) => {
  const diff = score - par;
  if (diff >= 2) return 0;
  if (diff === 1) return 1;
  if (diff === 0) return 2;
  if (diff === -1) return 3;
  if (diff === -2) return 4;
  if (diff <= -3) return 5;
  return 0;
};

// Calculate team statistics (total score, holes completed, to-par)
export const calculateTeamStats = (team, coursePars, format) => {
  const scores = team.scores || {};
  const scoresArray = Object.values(scores);
  const validScores = scoresArray.filter(s => s !== null && s !== -1 && s > 0);
  const holesCompleted = validScores.length;

  if (format === 'stableford') {
    let totalPoints = 0;
    scoresArray.forEach((score, i) => {
      if (score !== null && score !== -1 && score > 0 && coursePars[i]) {
        totalPoints += calculateStablefordPoints(score, coursePars[i]);
      }
    });
    return { total: totalPoints, holesCompleted, toPar: 0, isStableford: true };
  } else {
    const total = validScores.reduce((sum, s) => sum + s, 0);
    let parTotal = 0;
    scoresArray.forEach((score, i) => {
      if (score !== null && score !== -1 && score > 0 && coursePars[i]) {
        parTotal += coursePars[i];
      }
    });
    const toPar = total - parTotal;
    return { total, holesCompleted, toPar, isStableford: false };
  }
};