import { validateSources, type FaceSources } from "./images.ts";
export const STORE_LIMITS = Object.freeze({ sets: 10, bytes: 64 * 1024 * 1024 });
export interface PictureSet { readonly version: 1; readonly id: string; readonly name: string; readonly updatedAt: number; readonly faces: FaceSources }
export function validatePictureSet(value: PictureSet): PictureSet {
  if (!value || value.version !== 1 || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.id) || typeof value.name !== "string" ||
    !value.name.trim() || value.name.length > 64 || /[\x00-\x1f\x7f]/.test(value.name) || !Number.isFinite(value.updatedAt))
    throw Error("Invalid local picture set. Choose a name of 1–64 characters.");
  validateSources(value.faces); return value;
}
export function openPictureDatabase(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) { reject(Error("Local picture storage is unavailable. Your current pictures still work.")); return; }
    let settled = false;
    const fail = () => { if (!settled) { settled = true; clearTimeout(timer); reject(Error("Cannot open local picture storage. Close other Cubistry tabs or check browser storage settings.")); } };
    const timer = setTimeout(fail, 5000);
    let request: IDBOpenDBRequest;
    try { request = factory.open("cubistry-picture-sets", 1); } catch { fail(); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("sets")) request.result.createObjectStore("sets", { keyPath: "id" }); };
    request.onblocked = fail; request.onerror = fail;
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true; clearTimeout(timer); const database = request.result;
      database.onversionchange = () => database.close(); resolve(database);
    };
  });
}
/** Read and write outcomes are transaction outcomes, never individual request success. */
export class PictureStore {
  private readonly database: IDBDatabase;
  constructor(database: IDBDatabase) { this.database = database; }
  list(): Promise<PictureSet[]> {
    return new Promise((resolve, reject) => {
      let result: PictureSet[] = [], error: unknown;
      const tx = this.database.transaction("sets", "readonly"), request = tx.objectStore("sets").getAll();
      request.onsuccess = () => { try { result = request.result.map(validatePictureSet); } catch (e) { error = e; tx.abort(); } };
      tx.oncomplete = () => resolve(result.sort((a, b) => b.updatedAt - a.updatedAt));
      tx.onabort = tx.onerror = () => reject(error ?? Error("Cannot read local picture sets. Your current pictures are unchanged."));
    });
  }
  save(value: PictureSet): Promise<void> {
    validatePictureSet(value);
    return new Promise((resolve, reject) => {
      let error: unknown;
      const tx = this.database.transaction("sets", "readwrite"), store = tx.objectStore("sets"), request = store.getAll();
      request.onsuccess = () => {
        try {
          const rows: PictureSet[] = request.result.filter((row: PictureSet) => row.id !== value.id);
          if (rows.length >= STORE_LIMITS.sets || rows.reduce((sum, row) => sum + validateSources(row.faces), validateSources(value.faces)) > STORE_LIMITS.bytes)
            throw Error("Local library limit reached (10 sets / 64 MiB). Delete a saved set and try again.");
          store.put(value);
        } catch (e) { error = e; tx.abort(); }
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(error ?? Error("Picture set was not saved. Storage may be full; free space and retry. Your current pictures are unchanged."));
    });
  }
  delete(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.database.transaction("sets", "readwrite"); tx.objectStore("sets").delete(id);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(Error("Saved set was not deleted. Retry after checking browser storage."));
    });
  }
  close(): void { this.database.close(); }
}
