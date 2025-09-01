export const keys = {};

export function setupInput(prevent = new Set()){
  function onDown(e){
    keys[e.code] = true;
    if (prevent.has(e.code)) e.preventDefault();
  }
  function onUp(e){
    keys[e.code] = false;
    if (prevent.has(e.code)) e.preventDefault();
  }
  document.addEventListener('keydown', onDown);
  document.addEventListener('keyup', onUp);
}

