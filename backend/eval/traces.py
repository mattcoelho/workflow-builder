import json
import os
import re
from .models import Trace, Annotation

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
TRACES_FILE = os.path.join(DATA_DIR, 'traces.json')


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(TRACES_FILE):
        with open(TRACES_FILE, 'w') as f:
            json.dump([], f)


def _load_traces():
    _ensure_data_dir()
    try:
        with open(TRACES_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save_traces(traces):
    _ensure_data_dir()
    with open(TRACES_FILE, 'w') as f:
        json.dump(traces, f, indent=2)


def save_trace(trace: Trace):
    traces = _load_traces()
    traces.insert(0, trace.to_dict())
    _save_traces(traces)
    return trace


def get_traces(limit=50, offset=0):
    traces = _load_traces()
    return traces[offset:offset + limit], len(traces)


def get_trace(trace_id: str):
    traces = _load_traces()
    for t in traces:
        if t['id'] == trace_id:
            return t
    return None


def delete_trace(trace_id: str):
    traces = _load_traces()
    traces = [t for t in traces if t['id'] != trace_id]
    _save_traces(traces)
    return True


def annotate_trace(trace_id: str, verdict: str, notes: str = ""):
    traces = _load_traces()
    for t in traces:
        if t['id'] == trace_id:
            annotation = Annotation(verdict=verdict, notes=notes)
            if 'annotations' not in t:
                t['annotations'] = []
            t['annotations'].append(annotation.to_dict())
            _save_traces(traces)
            return t
    return None


def parse_workflow_from_response(response_data):
    """Extract and parse workflow JSON from the Groq API response."""
    try:
        content = response_data['choices'][0]['message']['content']
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            workflow = json.loads(json_match.group(0))
            return workflow, True
        return None, False
    except (KeyError, IndexError, json.JSONDecodeError):
        return None, False
