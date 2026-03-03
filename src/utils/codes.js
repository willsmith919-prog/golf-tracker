import { ref, get, set } from 'firebase/database';
import { database as db } from '../firebase';

// Generates a random 4-character alphanumeric suffix (e.g. "4X9K")
function generateSuffix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed ambiguous chars like 0/O, 1/I
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Prefix map — one prefix per activity type
const PREFIXES = {
  league: 'LG',
  series: 'SR',
  event: 'EV',
  game: 'GM',
};

// Generates a unique code for a given type, checks Firebase to make sure it doesn't already exist
export async function generateCode(type) {
  const prefix = PREFIXES[type];
  if (!prefix) throw new Error(`Unknown type: ${type}`);

  let code;
  let exists = true;

  // Keep trying until we land on a code that isn't already in use
  while (exists) {
    code = `${prefix}-${generateSuffix()}`;
    const snapshot = await get(ref(db, `codes/${code}`));
    exists = snapshot.exists();
  }

  return code;
}

// Saves a new code to Firebase
export async function createCode(type, targetId, expiresAt = null) {
  const code = await generateCode(type);

  await set(ref(db, `codes/${code}`), {
    type,
    targetId,
    status: 'active',
    createdAt: Date.now(),
    expiresAt, // null for leagues, a timestamp for everything else
  });

  return code;
}

// Looks up a code in Firebase and returns its data, or null if it doesn't exist
export async function lookupCode(code) {
  const snapshot = await get(ref(db, `codes/${code.toUpperCase()}`));
  if (!snapshot.exists()) return null;
  return snapshot.val();
}