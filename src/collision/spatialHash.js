/**
 * Spatial hash grid for rough circle queries.
 * Cells store references to inserted objects; caller defines object shape.
 */
export class SpatialHash {
  constructor(cellSize=80){
    this.cellSize = cellSize;
    this.map = new Map();
  }
  clear(){ this.map.clear(); }
  _key(cx,cy){ return cx+","+cy; }
  _cellIndex(x){ return Math.floor(x / this.cellSize); }
  insertCircle(obj, r){
    const minX = this._cellIndex(obj.x - r);
    const maxX = this._cellIndex(obj.x + r);
    const minY = this._cellIndex(obj.y - r);
    const maxY = this._cellIndex(obj.y + r);
    for(let cy=minY; cy<=maxY; cy++){
      for(let cx=minX; cx<=maxX; cx++){
        const k = this._key(cx,cy);
        let arr = this.map.get(k);
        if (!arr){ arr=[]; this.map.set(k, arr); }
        arr.push(obj);
      }
    }
  }
  queryCircle(x,y,r){
    const minX = this._cellIndex(x - r);
    const maxX = this._cellIndex(x + r);
    const minY = this._cellIndex(y - r);
    const maxY = this._cellIndex(y + r);
    const out=[];
    for(let cy=minY; cy<=maxY; cy++){
      for(let cx=minX; cx<=maxX; cx++){
        const k = this._key(cx,cy);
        const arr = this.map.get(k);
        if (arr){ out.push(...arr); }
      }
    }
    return out;
  }
}
