// Generate or retrieve device ID from localStorage
export const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Human-readable format names
export const formatNames = {
  scramble: "2-Man Scramble",
  shamble: "2-Man Shamble",
  bestball: "2-Man Best Ball",
  stableford: "Individual Stableford"
};

// Format descriptions for display
export const formatDescriptions = {
  scramble: "Both players hit, pick the best shot, both play from there. One team score per hole.",
  shamble: "Both players hit, pick the best drive, then each plays their own ball. Best individual score counts.",
  bestball: "Each player plays their own ball. Lower score of the two counts for the team.",
  stableford: "Individual scoring. Points awarded based on score vs par. Highest points wins."
};