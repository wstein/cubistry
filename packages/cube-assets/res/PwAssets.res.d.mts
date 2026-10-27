import type {PrintDefinition,CubeState} from '@cubistry/cube-core';
import type {AssetManifest} from '../src/index.ts';
export const limits:Readonly<{count:64,bytesPerFile:262144,totalBytes:4194304,pixelsPerSide:1024,decodedPixels:8388608,textCodePoints:512,timeoutMs:10000}>;
export function safeAssetPath(value:unknown):string;
export function validateAssets(value:unknown,prints:readonly PrintDefinition[]):AssetManifest;
export function serializeDesignState(print:PrintDefinition,state:CubeState,assets:AssetManifest):string;
export function parseDesignState(text:string):{print:PrintDefinition,state:CubeState,assets:AssetManifest};
