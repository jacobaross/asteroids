/** @typedef {{x:number,y:number,vx:number,vy:number,color:string,life:number,size:number}} Particle */
/** @typedef {{x:number,y:number,vy:number,life:number,text:string,color:string}} FloatText */

export const game = {
  score: 0,
  lives: 3,
  level: 1,
  gameOver: false,
  slowTime: 0,
  /** @type {Particle[]} */
  particles: [],
  boss: null,
  /** @type {FloatText[]} */
  floatTexts: [],
};

export function updateUI(){
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const levelEl = document.getElementById('level');
  if (scoreEl) scoreEl.textContent = game.score;
  if (livesEl) livesEl.textContent = game.lives;
  if (levelEl) levelEl.textContent = game.level;
}
