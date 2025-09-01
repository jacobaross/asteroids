export function startLoop(update, draw){
  function frame(){
    update();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

