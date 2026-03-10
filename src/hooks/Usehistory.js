// import { useState, useEffect, useCallback } from "react";

// const DB_NAME    = "droplink-v1";
// const STORE_NAME = "transfers";
// const DB_VERSION = 1;
// const MAX_RECORDS = 200;

// function openDB() {
//   return new Promise((resolve, reject) => {
//     const req = indexedDB.open(DB_NAME, DB_VERSION);
//     req.onupgradeneeded = (e) => {
//       const db    = e.target.result;
//       if (!db.objectStoreNames.contains(STORE_NAME)) {
//         const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
//         store.createIndex("timestamp", "timestamp", { unique: false });
//       }
//     };
//     req.onsuccess = () => resolve(req.result);
//     req.onerror   = () => reject(req.error);
//   });
// }

// async function idbAdd(record) {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx    = db.transaction(STORE_NAME, "readwrite");
//     const store = tx.objectStore(STORE_NAME);
//     store.put(record);
//     tx.oncomplete = () => resolve();
//     tx.onerror    = () => reject(tx.error);
//   });
// }

// async function idbGetAll() {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx    = db.transaction(STORE_NAME, "readonly");
//     const store = tx.objectStore(STORE_NAME);
//     const idx   = store.index("timestamp");
//     const req   = idx.openCursor(null, "prev"); // newest first
//     const results = [];
//     req.onsuccess = (e) => {
//       const cursor = e.target.result;
//       if (cursor && results.length < MAX_RECORDS) {
//         results.push(cursor.value);
//         cursor.continue();
//       } else {
//         resolve(results);
//       }
//     };
//     req.onerror = () => reject(req.error);
//   });
// }

// async function idbClear() {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx    = db.transaction(STORE_NAME, "readwrite");
//     tx.objectStore(STORE_NAME).clear();
//     tx.oncomplete = () => resolve();
//     tx.onerror    = () => reject(tx.error);
//   });
// }

// async function idbDelete(id) {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx = db.transaction(STORE_NAME, "readwrite");
//     tx.objectStore(STORE_NAME).delete(id);
//     tx.oncomplete = () => resolve();
//     tx.onerror    = () => reject(tx.error);
//   });
// }

// // ─── Hook ─────────────────────────────────────────────────────────────────────
// export function useHistory() {
//   const [history, setHistory]   = useState([]);
//   const [loading, setLoading]   = useState(true);

//   // Load on mount
//   useEffect(() => {
//     idbGetAll()
//       .then((records) => { setHistory(records); setLoading(false); })
//       .catch(() => setLoading(false));
//   }, []);

//   // Add a completed transfer record
//   const addRecord = useCallback(async (transfer) => {
//     const record = {
//       id:        transfer.id,
//       name:      transfer.name,
//       size:      transfer.size,
//       direction: transfer.direction,
//       status:    transfer.status,        // "done" | "error" | "cancelled"
//       timestamp: Date.now(),
//       duration:  transfer.duration ?? null,
//       avgSpeed:  transfer.avgSpeed  ?? null,
//       peer:      transfer.peer      ?? null,
//     };
//     try {
//       await idbAdd(record);
//       setHistory((prev) => [record, ...prev].slice(0, MAX_RECORDS));
//     } catch (e) {
//       console.warn("History write failed:", e);
//     }
//   }, []);

//   const removeRecord = useCallback(async (id) => {
//     try {
//       await idbDelete(id);
//       setHistory((prev) => prev.filter((r) => r.id !== id));
//     } catch (e) {
//       console.warn("History delete failed:", e);
//     }
//   }, []);

//   const clearHistory = useCallback(async () => {
//     try {
//       await idbClear();
//       setHistory([]);
//     } catch (e) {
//       console.warn("History clear failed:", e);
//     }
//   }, []);

//   return { history, loading, addRecord, removeRecord, clearHistory };
// }

import { useState, useEffect, useCallback } from "react";

const DB_NAME     = "droplink-v1";
const STORE_NAME  = "transfers";
const DB_VERSION  = 2;          // bumped to 2 so onupgradeneeded adds the new "room" index
const MAX_RECORDS = 200;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // Create store fresh on v1→v2 upgrade (or first time)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("room",      "room",      { unique: false });
      } else {
        // Store already exists — just add the "room" index if missing
        const store = e.target.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains("room")) {
          store.createIndex("room", "room", { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbAdd(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(STORE_NAME, "readonly");
    const store   = tx.objectStore(STORE_NAME);
    const idx     = store.index("timestamp");
    const req     = idx.openCursor(null, "prev"); // newest first
    const results = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor && results.length < MAX_RECORDS) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbClearByRoom(room) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const idx   = store.index("room");
    const req   = idx.openCursor(IDBKeyRange.only(room));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

async function idbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useHistory() {
  const [history,  setHistory]  = useState([]);   // all records
  const [loading,  setLoading]  = useState(true);

  // Load all records on mount
  useEffect(() => {
    idbGetAll()
      .then((records) => { setHistory(records); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Add a completed transfer — caller must pass roomCode
  const addRecord = useCallback(async (transfer) => {
    const record = {
      id:        transfer.id,
      name:      transfer.name,
      size:      transfer.size,
      direction: transfer.direction,
      status:    transfer.status,
      timestamp: Date.now(),
      duration:  transfer.duration  ?? null,
      avgSpeed:  transfer.avgSpeed  ?? null,
      peer:      transfer.peer      ?? null,
      room:      transfer.roomCode  ?? "unknown",  // ← new field
    };
    try {
      await idbAdd(record);
      setHistory((prev) => [record, ...prev].slice(0, MAX_RECORDS));
    } catch (e) {
      console.warn("History write failed:", e);
    }
  }, []);

  const removeRecord = useCallback(async (id) => {
    try {
      await idbDelete(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.warn("History delete failed:", e);
    }
  }, []);

  // Clear all history across all rooms
  const clearHistory = useCallback(async () => {
    try {
      await idbClear();
      setHistory([]);
    } catch (e) {
      console.warn("History clear failed:", e);
    }
  }, []);

  // Clear history only for a specific room code
  const clearRoomHistory = useCallback(async (room) => {
    try {
      await idbClearByRoom(room);
      setHistory((prev) => prev.filter((r) => r.room !== room));
    } catch (e) {
      console.warn("History clear (room) failed:", e);
    }
  }, []);

  // Derive unique room list from all records (newest room first)
  const rooms = [...new Set(
    [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((r) => r.room)
      .filter(Boolean)
  )];

  return { history, loading, rooms, addRecord, removeRecord, clearHistory, clearRoomHistory };
}