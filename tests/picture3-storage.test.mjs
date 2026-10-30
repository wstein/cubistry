import test from "node:test";
import assert from "node:assert/strict";
import { PictureStore, validatePictureSet, openPictureDatabase } from "../src/apps/picture3/storage.ts";
import { FACE_FRAMES } from "../src/apps/picture3/model.ts";
const faces=()=>Object.fromEntries(FACE_FRAMES.map(f=>[f.face,{blob:new Blob(["photo"],{type:"image/png"}),crop:{zoom:1,x:0,y:0}}]));
const record=(id="one")=>({version:1,id,name:"My six pictures",updatedAt:1,faces:faces()});
function database() {
  const rows=new Map(); let tx, fail=false;
  return {rows,get tx(){return tx;},set fail(value){fail=value;},close(){},transaction(){
    const pending=[];tx={objectStore(){return {
      getAll(){const request={};queueMicrotask(()=>{request.result=[...rows.values()];request.onsuccess?.();});return request;},
      put(value){pending.push(()=>rows.set(value.id,structuredClone(value)));},delete(id){pending.push(()=>rows.delete(id));},
    };},abort(){queueMicrotask(()=>tx.onabort?.());},complete(){if(fail){tx.onabort?.();return;}pending.forEach(f=>f());tx.oncomplete?.();}};
    return tx;
  }};
}
test("local sets validate six bounded raster blobs and metadata",()=>{
  assert.equal(validatePictureSet(record()).version,1);
  assert.throws(()=>validatePictureSet({...record(),version:2}));
  assert.throws(()=>validatePictureSet({...record(),name:""}));
  assert.throws(()=>validatePictureSet({...record(),faces:{F:record().faces.F}}));
  const bad=record();bad.faces.U.blob=new Blob(["<svg/>"],{type:"image/svg+xml"});assert.throws(()=>validatePictureSet(bad));
});
test("save and delete resolve only on transaction completion; abort/quota preserves prior saved data",async()=>{
  const db=database(), store=new PictureStore(db);let settled=false;
  const save=store.save(record()).then(()=>settled=true);await Promise.resolve();await Promise.resolve();assert.equal(settled,false);assert.equal(db.rows.size,0);
  db.tx.complete();await save;assert.equal(db.rows.size,1);
  db.fail=true;const failure=store.save({...record(),name:"Changed"});await Promise.resolve();db.tx.complete();await assert.rejects(failure,/not saved/);
  assert.equal(db.rows.get("one").name,"My six pictures");
  const removal=store.delete("one");db.tx.complete();await assert.rejects(removal,/not deleted/);assert.equal(db.rows.size,1);
  db.fail=false;const deleted=store.delete("one");db.tx.complete();await deleted;assert.equal(db.rows.size,0);
});
test("saved blobs/crop metadata survive reopening and storage-unavailable errors are recoverable",async()=>{
  const db=database(), store=new PictureStore(db), data=record();data.faces.B.crop={zoom:2,x:.5,y:-.5};
  const saved=store.save(data);await Promise.resolve();db.tx.complete();await saved;
  const listing=new PictureStore(db).list();await Promise.resolve();db.tx.complete();const result=await listing;
  assert.deepEqual(result[0].faces.B.crop,data.faces.B.crop);assert.equal(await result[0].faces.B.blob.text(),"photo");
  await assert.rejects(openPictureDatabase(undefined),/unavailable/);
  await assert.rejects(openPictureDatabase({open(){throw Error("private mode");}}),/storage/);
});
