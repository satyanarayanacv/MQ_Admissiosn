# Here are your Instructions
Here's how to run this application locally on a desktop (Windows/macOS/Linux). It has three parts: **MongoDB**, the **FastAPI backend**, and the **Expo frontend**.

---

## 0. Prerequisites (install these first)
- **Python 3.11+** — https://www.python.org/downloads/
- **Node.js 18+ and Yarn** — https://nodejs.org + `npm install -g yarn`
- **MongoDB Community Server** (running locally) — https://www.mongodb.com/try/download/community
- Get the code first via **Save to GitHub** → clone/download the repo. You'll have an `/app` folder with `backend/` and `frontend/`.

---

## 1. Start MongoDB
- After installing, make sure the MongoDB service is running (default port `27017`).
  - macOS (Homebrew): `brew services start mongodb-community`
  - Windows: it runs as a service automatically, or launch **MongoDB Compass**.
  - Linux: `sudo systemctl start mongod`

---

## 2. Backend (FastAPI)

```bash
cd backend

# create & activate a virtual environment
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# install dependencies
pip install -r requirements.txt
```

> If `pip install` fails on the `emergentintegrations` line, you can safely delete that one line from `requirements.txt` and re-run — the app's code does not import it.

Create/verify **`backend/.env`**:
```dotenv
MONGO_URL="mongodb://localhost:27017"
DB_NAME="admissions_db"
JWT_SECRET="change-this-to-a-long-random-string"
JWT_EXPIRE_MINUTES="720"
ADMIN_USERNAME="admin"
ADMIN_EMAIL="admin@admissions.edu"
ADMIN_PASSWORD="Admin@123456"
```
> The `EMERGENT_LLM_KEY` / document-upload storage only works inside Emergent's hosted environment. Everything else (login, applicants, courses, reports, edit/delete, CSV import) works fully offline. Document **uploads** will simply return a "storage not configured" message locally.

Run the backend:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Backend is now at `http://localhost:8001` (API under `http://localhost:8001/api`). On first start it auto-seeds the 4 staff accounts and sample data.

---

## 3. Frontend (Expo)

Open a **new terminal**:
```bash
cd frontend
yarn install
```

Edit **`frontend/.env`** so the app points at your local backend:
```dotenv
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```
> In the cloud preview this is a public URL, but locally it must be your backend at port 8001.

Start it:
```bash
# run in the browser (easiest on desktop)
yarn web
# or the dev server with QR code for phone testing
yarn start
```
- **Web:** opens `http://localhost:8081` (or `http://localhost:3000` depending on config) in your browser.
- **Phone:** install **Expo Go**, scan the QR code — but your phone must reach your computer's IP, so replace `localhost` with your machine's LAN IP in `EXPO_PUBLIC_BACKEND_URL` (e.g. `http://192.168.1.20:8001`).

---

## 4. Log in
Use any seeded account (also listed on the login screen):

| Role     | Username | Password       |
|----------|----------|----------------|
| Admin    | admin    | Admin@123456   |
| Reviewer | reviewer | Review@123456  |
| Lecturer | lecturer | Lecture@12345  |
| Office   | office   | Office@123456  |

---

### Quick troubleshooting
- **Network/401 on login** → confirm backend is running and `EXPO_PUBLIC_BACKEND_URL` matches its address; restart Expo after editing `.env`.
- **Mongo connection error** → MongoDB isn't running / wrong `MONGO_URL`.
- **CORS/API 404** → make sure you're hitting port `8001` and the path includes `/api`.

Want me to add a short `README.md` with these exact commands into the project so it ships with the code?
