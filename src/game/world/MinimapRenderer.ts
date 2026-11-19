import Phaser from 'phaser';
import type { Simulation } from '../../simulation/Simulation';
interface MinimapRenderOptions {
 map: Phaser.Tilemaps.Tilemap; staticGraphics: Phaser.GameObjects.Graphics; graphics: Phaser.GameObjects.Graphics;
 camera: Phaser.Cameras.Scene2D.Camera; worldWidth: number; worldHeight: number;
 bounds: {x:number;y:number;width:number;height:number};
 civilians: ReturnType<Simulation['getCivilians']>; officers: ReturnType<Simulation['getOfficers']>;
 infected: ReturnType<Simulation['getInfected']>;
 visibility: {officers:boolean;civilians:boolean;infected:boolean}; selectedOfficerIds: ReadonlySet<number>;
 safeZone: {x:number;y:number};
}
const C={paper:0xe8e3d8,muted:0xc0c5bd,officer:0x5c9be6,civilian:0xe7c66a,infected:0xc33a36} as const;
const T=[0x46583a,0x414749,0x796346,0x77796f,0x806849,0x8a887d,0x344b31,0x555b58,0x4b5b3b,0x3d5036,0x555a3d,0x394b35,0x3c4446,0x484e4e,0x4d5552,0x625c4e];
/** Draws static terrain once per graphics instance and refreshes moving overlays per frame. */
export class MinimapRenderer {
 private readonly rendered=new WeakSet<Phaser.GameObjects.Graphics>();
 render(o:MinimapRenderOptions):void {
  const {map,staticGraphics:sg,graphics:g,camera,worldWidth:ww,worldHeight:wh,bounds:b}=o;
  const scale=Math.min(b.width/map.width,b.height/map.height), mw=map.width*scale,mh=map.height*scale;
  const mx=b.x+(b.width-mw)/2,my=b.y+(b.height-mh)/2;
  if(!this.rendered.has(sg)){
   sg.clear();sg.fillStyle(0x080c0d,1);sg.fillRect(b.x,b.y,b.width,b.height);
   for(const name of ['Ground','Terrain','Structures']){const layer=map.getLayer(name);if(!layer)continue;
    for(let r=0;r<layer.data.length;r++){const row=layer.data[r]??[];for(let c=0;c<row.length;c++){const tile=row[c];if(!tile||tile.index<0)continue;sg.fillStyle(T[tile.index]??0x555b58,1);sg.fillRect(mx+c*scale,my+r*scale,scale+0.15,scale+0.15);}}
   }this.rendered.add(sg);
  }
  g.clear();const p=(v:{x:number;y:number})=>({x:mx+Phaser.Math.Clamp(v.x/ww,0,1)*mw,y:my+Phaser.Math.Clamp(v.y/wh,0,1)*mh});
  if(o.visibility.civilians)for(const v of o.civilians){if(v.state==='extracted')continue;const q=p(v.position);g.fillStyle(C.civilian,1);g.fillCircle(q.x,q.y,3.5);}
  if(o.visibility.infected)for(const v of o.infected){const q=p(v.position);g.fillStyle(C.infected,1);g.fillCircle(q.x,q.y,3.5);}
  if(o.visibility.officers)for(const v of o.officers){const q=p(v.position),sel=o.selectedOfficerIds.has(v.id);g.fillStyle(v.isIncapacitated?C.muted:C.officer,1);g.fillCircle(q.x,q.y,sel?5:4);if(sel){g.lineStyle(1,C.paper,0.95);g.strokeCircle(q.x,q.y,7);}}
  const safe=p(o.safeZone);g.lineStyle(1.5,0x55c878,0.95);g.strokeCircle(safe.x,safe.y,5);g.fillStyle(0x55c878,1);g.fillCircle(safe.x,safe.y,2);
  const vx=mx+Phaser.Math.Clamp(camera.scrollX/ww,0,1)*mw,vy=my+Phaser.Math.Clamp(camera.scrollY/wh,0,1)*mh;
  const vw=Phaser.Math.Clamp(camera.width/camera.zoom/ww*mw,2,mw),vh=Phaser.Math.Clamp(camera.height/camera.zoom/wh*mh,2,mh);
  g.lineStyle(1,C.paper,0.9);g.strokeRect(Phaser.Math.Clamp(vx,mx,mx+mw-vw),Phaser.Math.Clamp(vy,my,my+mh-vh),vw,vh);
 }
}
