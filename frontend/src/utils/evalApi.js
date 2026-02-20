const BASE_URL = 'https://workflow-builder-backend-xs8b.onrender.com/api/eval';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Traces
export const getTraces = (limit = 50, offset = 0) =>
  request(`/traces?limit=${limit}&offset=${offset}`);

export const getTrace = (id) =>
  request(`/traces/${id}`);

export const deleteTrace = (id) =>
  request(`/traces/${id}`, { method: 'DELETE' });

export const annotateTrace = (id, verdict, notes = '') =>
  request(`/traces/${id}/annotate`, {
    method: 'PUT',
    body: JSON.stringify({ verdict, notes }),
  });

// Grading
export const gradeTrace = (id, grader = 'schema') =>
  request(`/traces/${id}/grade`, {
    method: 'POST',
    body: JSON.stringify({ grader }),
  });

export const runEval = (graders = ['schema'], limit = 50) =>
  request('/run', {
    method: 'POST',
    body: JSON.stringify({ graders, limit }),
  });

// Goldens
export const getGoldens = () =>
  request('/goldens');

export const createGolden = (data) =>
  request('/goldens', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateGolden = (id, data) =>
  request(`/goldens/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteGolden = (id) =>
  request(`/goldens/${id}`, { method: 'DELETE' });

export const promoteTraceToGolden = (traceId, tags = [], notes = '') =>
  request('/goldens/from-trace', {
    method: 'POST',
    body: JSON.stringify({ trace_id: traceId, tags, notes }),
  });

export const generateSyntheticGoldens = (count = 5, categories = null) =>
  request('/goldens/generate', {
    method: 'POST',
    body: JSON.stringify({ count, categories }),
  });

// Advanced
export const runGoldenEval = (graders = ['schema', 'intent'], goldenIds = null) =>
  request('/run-goldens', {
    method: 'POST',
    body: JSON.stringify({ graders, golden_ids: goldenIds }),
  });

export const runPassAtK = (goldenId, k = 5) =>
  request('/pass-at-k', {
    method: 'POST',
    body: JSON.stringify({ golden_id: goldenId, k }),
  });

export const runComparison = (configA, configB, goldenIds = null, graders = null) =>
  request('/compare', {
    method: 'POST',
    body: JSON.stringify({ config_a: configA, config_b: configB, golden_ids: goldenIds, graders }),
  });
