// Simple generic object pool
export function createPool(factory){
  const free = [];
  return {
    acquire(){ return free.pop() || factory(); },
    release(obj){ free.push(obj); },
    size(){ return free.length; }
  };
}

