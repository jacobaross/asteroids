export const bosses = [
  { id: 'saucer', name: 'Saucer', baseHealth: 60 },
  { id: 'klingon', name: 'Raider', baseHealth: 80 },
  { id: 'sentinel', name: 'Sentinel', baseHealth: 70 },
];

export function pickBoss(level){
  return bosses[(level-1) % bosses.length];
}

