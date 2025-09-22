const API_BASE = import.meta.env.VITE_AI_API_BASE || '/ai-api';

export async function predictSeverity(crimeType) {
  const res = await fetch(`${API_BASE}/predict-severity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crime_type: crimeType })
  });
  if (!res.ok) throw new Error('Failed to predict severity');
  return res.json();
}

export async function dispatchUnit({ crimeType, latitude, longitude, severity }) {
  const res = await fetch(`${API_BASE}/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ crime_type: crimeType, latitude, longitude, severity })
  });
  if (!res.ok) throw new Error('Failed to dispatch');
  return res.json();
}


