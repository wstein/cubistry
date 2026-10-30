import test from "node:test";
import assert from "node:assert/strict";
import { syncDurationControl, changeDurationControl } from "../src/apps/picture3/controls.ts";
test("production duration control preserves active-turn progress and selected/effective duration consistency",()=>{
 const control={value:"150",disabled:false},viewer={duration:150};
 syncDurationControl(control,viewer,true);assert.equal(control.disabled,true);
 const elapsed=75,progress=elapsed/viewer.duration;control.value="300";changeDurationControl(control,viewer,true);
 assert.equal(viewer.duration,150);assert.equal(elapsed/viewer.duration,progress);assert.equal(control.value,"150");
 syncDurationControl(control,viewer,false);assert.equal(control.disabled,false);
 control.value="300";changeDurationControl(control,viewer,false);assert.equal(viewer.duration,300);assert.equal(control.value,"300");
 control.value="invalid";changeDurationControl(control,viewer,false);assert.equal(viewer.duration,300);assert.equal(control.value,"300");
 syncDurationControl(control,undefined,false);assert.equal(control.disabled,true);
});
