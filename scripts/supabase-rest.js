const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = require('./supabase-config');

async function fetchAll(table, orderBy = 'id') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${orderBy}.asc`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase fetchAll(${table}) failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function upsert(table, rows, onConflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert(${table}) failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

module.exports = { fetchAll, upsert, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY };
