// server/firebaseAdmin.ts
import * as fs from "fs";
import * as admin from "firebase-admin";

function loadServiceAccount() {
    // prefer inline JSON (works on Vercel)
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (inline) {
        return JSON.parse(inline);
    }

    // Otherwise read from GOOGLE_APPLICATION_CREDENTIALS path (great for local dev)
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credPath) {
        throw new Error(
        "Missing credentials: set FIREBASE_SERVICE_ACCOUNT_KEY (inline JSON) or GOOGLE_APPLICATION_CREDENTIALS (file path)."
        );
    }
    const raw = fs.readFileSync(credPath, "utf8");
    return JSON.parse(raw);
}

let app: admin.app.App;
if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
} else {
  app = admin.app();
}

export const db = admin.firestore();
export const auth = admin.auth();