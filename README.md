# Marigo

Marigo — Django + React e-commerce site (Albanian heritage souvenirs and apparel).

## Tech stack

- **Backend:** Django 5.2 + Django REST Framework, JWT auth (`djangorestframework-simplejwt`)
- **Frontend:** React 19 + Vite, Tailwind CSS 4, React Router, Axios
- **Database:** SQLite out of the box; PostgreSQL via Neon/Supabase (set `DATABASE_URL`)
- **Images:** uploaded to local `media/` (Cloudinary optional later via `CLOUDINARY_URL`)

## Prerequisites

- Python 3.12+ (developed on 3.14)
- Node.js 20+
- Free accounts if you want production-like services:
  - [Neon](https://neon.tech) or [Supabase](https://supabase.com) — free Postgres
  - [Cloudinary](https://cloudinary.com) — free image hosting (optional; not required for local dev)

## Setup

### 1. Clone the repo

```bash
git clone <your-repo-url>.git
cd Marigo
```

### 2. Backend

```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows — or: cp .env.example .env
# Edit .env: set a real SECRET_KEY (keep DEBUG=True for local dev)

python manage.py migrate
python manage.py seed_data
python manage.py createsuperuser
python manage.py runserver
```

API: `http://127.0.0.1:8000/`

Leave `DATABASE_URL` empty to use SQLite (`db.sqlite3`). For Postgres, set `DATABASE_URL` in `.env` to your Neon/Supabase connection string (requires `psycopg2-binary`, already in `requirements.txt`).

### 3. Frontend

```bash
cd frontend
npm install
copy .env.example .env   # Windows — or: cp .env.example .env
npm run dev
```

App: `http://localhost:5173` (Vite proxies `/api` and `/media` to `http://127.0.0.1:8000`).

### 4. Admin

Django admin login is **not** included in the repo. Create your own superuser:

```bash
python manage.py createsuperuser
```

Then open `http://127.0.0.1:8000/admin/`.

## Project layout

```
Marigo/
  manage.py
  ecommerce_backend/   # Django project (settings, urls)
  store/               # API app (models, views, seed_data)
  frontend/            # React + Vite app
  .env.example         # backend env template (copy to .env)
  requirements.txt
```

## Notes

- Never commit `.env`, `db.sqlite3`, `media/` uploads, `node_modules/`, or `dist/` — covered by `.gitignore`.
- Seed images are copied from `frontend/src/assets/` into `media/` by `python manage.py seed_data`.
