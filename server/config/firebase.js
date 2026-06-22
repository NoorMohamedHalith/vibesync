const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

/**
 * Mock Firestore database implementation to enable instant local test execution
 * if Firebase credentials have not been configured yet.
 */
class MockFirestore {
  constructor() {
    this.dbPath = path.join(__dirname, '../mock-db.json');
    this.initDb();
  }

  initDb() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.writeFileSync(this.dbPath, JSON.stringify({ rooms: {} }), 'utf8');
      }
    } catch (e) {
      console.error('[MockFirestore] Database init failed:', e.message);
    }
  }

  readDb() {
    try {
      this.initDb();
      if (!fs.existsSync(this.dbPath)) return { rooms: {} };
      const content = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('[MockFirestore] Read failed, returning empty:', e.message);
      return { rooms: {} };
    }
  }

  writeDb(data) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('[MockFirestore] Write failed:', e.message);
    }
  }

  collection(name) {
    return {
      doc: (docId) => {
        const getDocRef = () => {
          return {
            set: async (data) => {
              const db = this.readDb();
              if (!db[name]) db[name] = {};
              db[name][docId] = { ...data };
              this.writeDb(db);
            },
            get: async () => {
              const db = this.readDb();
              const data = db[name]?.[docId];
              return {
                exists: !!data,
                data: () => data ? { ...data } : null,
              };
            },
            update: async (data) => {
              const db = this.readDb();
              if (!db[name]) db[name] = {};
              const current = db[name][docId] || {};
              db[name][docId] = { ...current, ...data };
              this.writeDb(db);
            },
            delete: async () => {
              const db = this.readDb();
              if (db[name]) {
                delete db[name][docId];
                this.writeDb(db);
              }
            },
            collection: (subName) => {
              return {
                doc: (subDocId) => {
                  return {
                    set: async (subData) => {
                      const dbVal = this.readDb();
                      if (!dbVal[name]) dbVal[name] = {};
                      if (!dbVal[name][docId]) dbVal[name][docId] = {};
                      if (!dbVal[name][docId][subName]) dbVal[name][docId][subName] = {};
                      dbVal[name][docId][subName][subDocId] = { ...subData };
                      this.writeDb(dbVal);
                    },
                    get: async () => {
                      const dbVal = this.readDb();
                      const subData = dbVal[name]?.[docId]?.[subName]?.[subDocId];
                      return {
                        exists: !!subData,
                        data: () => subData ? { ...subData } : null,
                      };
                    }
                  };
                },
                get: async () => {
                  const dbVal = this.readDb();
                  const subColl = dbVal[name]?.[docId]?.[subName] || {};
                  const docs = Object.entries(subColl).map(([id, val]) => ({
                    id,
                    data: () => ({ ...val })
                  }));
                  return {
                    forEach: (cb) => docs.forEach(cb),
                    docs
                  };
                },
                orderBy: () => {
                  return {
                    get: async () => {
                      const dbVal = this.readDb();
                      const subColl = dbVal[name]?.[docId]?.[subName] || {};
                      const docs = Object.entries(subColl).map(([id, val]) => ({
                        id,
                        data: () => ({ ...val })
                      }));
                      return {
                        forEach: (cb) => docs.forEach(cb),
                        docs
                      };
                    }
                  };
                }
              };
            }
          };
        };
        return getDocRef();
      }
    };
  }

  batch() {
    const operations = [];
    return {
      delete: (docRef) => {
        operations.push(() => docRef.delete());
      },
      commit: async () => {
        for (const op of operations) {
          await op();
        }
      }
    };
  }

  settings(config) {}
}

/**
 * Initialize Firebase Admin SDK and return Firestore database instance.
 *
 * Resolves credentials in this order:
 *   1. Check if server/firebase-service-account.json is populated by user.
 *   2. Check if explicit env vars are present.
 *   3. Falls back to a MockFirestore in-memory client to prevent crashes.
 *
 * @returns {FirebaseFirestore.Firestore | MockFirestore} Firestore instance
 */
function initializeFirebase() {
  try {
    const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
    let serviceAccount = null;

    if (fs.existsSync(serviceAccountPath)) {
      try {
        const rawData = fs.readFileSync(serviceAccountPath, 'utf8');
        const parsed = JSON.parse(rawData);
        // Ensure it's not the default template
        if (parsed.project_id && parsed.project_id !== 'your-firebase-project-id') {
          serviceAccount = parsed;
        }
      } catch (e) {
        console.error('[VibeSync] Failed to parse firebase-service-account.json:', e.message);
      }
    }

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      console.log('[VibeSync] Firebase initialized with service account JSON file');
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      console.log('[VibeSync] Firestore connection established');
      return db;
    }

    // Fall back to Environment Variables
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId: FIREBASE_PROJECT_ID,
      });
      console.log('[VibeSync] Firebase initialized with service-account env vars');
      const db = admin.firestore();
      db.settings({ ignoreUndefinedProperties: true });
      console.log('[VibeSync] Firestore connection established');
      return db;
    }

    // Fall back to Mock In-Memory Firestore to prevent initialization crashes on localhost
    console.warn('[VibeSync] WARNING: No Firebase credentials configured. Falling back to Mock In-Memory Firestore.');
    const db = new MockFirestore();
    console.log('[VibeSync] Mock Firestore connection established');
    return db;

  } catch (error) {
    console.error('[VibeSync] Firebase initialization failed:', error.message);
    process.exit(1);
  }
}

module.exports = { initializeFirebase };
