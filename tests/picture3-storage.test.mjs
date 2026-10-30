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

test("count and aggregate-byte limits reject new rows but permit bounded overwrites and recovery after deletion",async()=>{
  const db=database(),store=new PictureStore(db);
  const save=async value=>{const result=store.save(value);await Promise.resolve();db.tx.complete();await result;};
  for(let i=0;i<10;i++)await save(record(`set-${i}`));
  await assert.rejects(store.save(record("eleven")),/library limit/);assert.equal(db.rows.size,10);
  await save({...record("set-0"),name:"Updated existing"});assert.equal(db.rows.size,10);assert.equal(db.rows.get("set-0").name,"Updated existing");
  const removal=store.delete("set-1");db.tx.complete();await removal;await save(record("eleven"));assert.equal(db.rows.size,10);
  const bigDb=database(),bigStore=new PictureStore(bigDb),large=new Blob([new Uint8Array(4*1024*1024)],{type:"image/png"});
  const largeRecord=id=>({...record(id),faces:Object.fromEntries(FACE_FRAMES.map(f=>[f.face,{blob:large,crop:{zoom:1,x:0,y:0}}]))});
  for(const id of ["a","b"]){const op=bigStore.save(largeRecord(id));await Promise.resolve();bigDb.tx.complete();await op;}
  await assert.rejects(bigStore.save(largeRecord("c")),/library limit/);assert.equal(bigDb.rows.size,2);
});
test("blocked storage rejects promptly and closes any late successful open",async()=>{
  const request={},database={closed:0,close(){this.closed++;}};
  const pending=openPictureDatabase({open(){return request;}});request.onblocked();await assert.rejects(pending,/Close other/);
  request.result=database;request.onsuccess();assert.equal(database.closed,1);
});
