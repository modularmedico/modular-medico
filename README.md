# Modular Medico
A React + TypeScript + Vite + Tailwind MCQ practice app for MBBS students, with a real Firebase backend, a block-based content system (Block 1–15 per module), and a Premium paywall wired for PayFast.

## Stack
- **React 19 + TypeScript + Vite**, **React Router v7**, **Tailwind CSS v3**, **Zustand** for local UI state
- **Firebase Auth** (email/password) + **Firestore** (profiles, streaks, attempts, bookmarks, content, payments)
- **recharts** for the weak-topic accuracy chart, **lucide-react** for icons
Fonts: **Baloo 2** (display), **Plus Jakarta Sans** (body), **JetBrains Mono** (scores/stats).

---

## 1. Run the app locally
```bash
npm install
npm run dev        # http://localhost:3000
```
Create a `.env` file based on `.env.example` and put your Firebase configuration variables in it (prefixed with `VITE_`).

---

## 2. Firebase console setup (one-time)
1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication** → Sign-in method → enable **Email/Password**.
3. **Firestore Database** → Create database (production mode).
4. Deploy the security rules and indexes:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

---

## 3. Make yourself an admin
The admin panel (`/admin-gate` → `/admin`) requires the `admin` custom claim.
1. Firebase Console → Project settings → Service accounts → **Generate new private key**. Save as `scripts/serviceAccountKey.json`.
2. Run:
   ```bash
   node scripts/setAdminClaim.mjs you@example.com
   ```
3. Log out and back in on that account.

---

## 4. Vercel Deployment

You can easily deploy this frontend to Vercel:
1. Push this repository to GitHub.
2. Go to Vercel and import the repository.
3. In the Vercel project settings, add the following Environment Variables (found in your Firebase Console Project Settings):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`
   - `VITE_ADMIN_GATE_PASSWORD`
4. The build command (`npm run build`) and output directory (`dist`) will be automatically detected by Vercel for Vite.
5. Deploy!

---

## 5. Premium paywall (PayFast)

Payments are wired for **PayFast**. You will need to integrate the PayFast API logic into a Cloud Function or your Vercel API routes to generate the checkout URLs and handle the success webhooks securely without exposing your PayFast secrets to the client.

Currently, the `handleActivateSubscription` function inside `src/pages/Paywall.tsx` provides a mock success implementation. You can update this function to redirect to the actual PayFast checkout portal once you've set up your merchant account.
