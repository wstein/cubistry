import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Euler, Vector3, PerspectiveCamera } from 'three';
import { clockCubeRadius, clockCenters, clockDefaultQuaternion, clockCameraRadius,
  clockPresentationScale, clockWorldCenters } from '../src/apps/clock/framing.ts';

test('horizontal default fills wide aspect better while every rotated legal-turn sphere fits',()=>{
  for(const aspect of [.25,.5,1,1.5,2.3,3]) {
    const distance=clockCameraRadius(aspect);
    const camera=new PerspectiveCamera(28,aspect,.1,1000);
    camera.position.z=distance;camera.updateMatrixWorld();
    assert.equal(clockPresentationScale(aspect,clockDefaultQuaternion),1);
    if(aspect===2.3) assert(distance<12,`default distance ${distance} versus old 21.4`);
    for(let yaw=-Math.PI;yaw<=Math.PI;yaw+=.2)for(let pitch=-Math.PI;pitch<=Math.PI;pitch+=.3){
      const q=new Quaternion().setFromEuler(new Euler(pitch,yaw,.3));
      const scale=clockPresentationScale(aspect,q);
      const centers=[new Vector3(),new Vector3(),new Vector3()];clockWorldCenters(q,scale,centers);
      assert(scale>0&&scale<=1);
      for(const c of centers)for(let i=0;i<100;i++){
        const a=i*2.399963229728653,z=1-2*(i+.5)/100,r=Math.sqrt(1-z*z);
        const p=new Vector3(r*Math.cos(a),r*Math.sin(a),z).multiplyScalar(clockCubeRadius*scale).add(c).project(camera);
        assert(Math.abs(p.x)<=.941&&Math.abs(p.y)<=.941&&p.z>-1&&p.z<1);
      }
      assert(Math.abs(centers[0].distanceTo(centers[2])/scale-5.6)<1e-12);
      const next=new Quaternion().setFromEuler(new Euler(pitch,yaw+.000001,.3));
      assert(Math.abs(clockPresentationScale(aspect,next)-scale)<.00001);
    }
  }
});
test('camera envelope rejects invalid projection and non-unit quaternion inputs',()=>{
  for(const args of [[0],[-1],[1,NaN],[1,0,0,180]])assert.throws(()=>clockCameraRadius(...args));
  for(const q of [new Quaternion(0,0,0,0),new Quaternion(1,1,1,1),new Quaternion(NaN,0,0,1)])
    assert.throws(()=>clockPresentationScale(2.3,q));
  assert.equal(clockCenters.length,3);
});
