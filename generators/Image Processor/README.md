# Plotter Art Workstation (Scaffold)

Local web app to turn images into plotter-friendly SVG lines. This scaffold wires a Flask backend and a Vite/React + Tailwind frontend with a simple margin→SVG proof-of-connection.

## Backend (Flask)
1. `cd backend`
2. `python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `PORT=5500 python app.py` (runs on `http://localhost:5500`)

### Endpoint
- `POST /generate` — body: `{ "margin": number, "mode": "A" | "B" }`, returns `{ svg, mode, margin }`.

## Frontend (React + Vite + Tailwind)
1. `cd frontend`
2. `npm install`
3. `npm run dev` (default `http://localhost:5173`)

Set `VITE_API_URL` in a `.env` file if the backend is not on `http://localhost:5500`.

## Proof-of-connection demo
- Use the UI slider/toggle, click **Generate SVG**. The backend returns a rectangle inset by the margin. Stroke color changes per mode (A = blue, B = orange).

## Next steps
- Implement flow-field density logic in `backend/generators/density_flow.py`.
- Add structure/edge logic in `backend/generators/structure_fill.py`.

