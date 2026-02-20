import json
import os
import requests
from .models import GoldenExample
from .traces import get_trace

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
GOLDENS_FILE = os.path.join(DATA_DIR, 'goldens.json')


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(GOLDENS_FILE):
        with open(GOLDENS_FILE, 'w') as f:
            json.dump([], f)


def _load_goldens():
    _ensure_data_dir()
    try:
        with open(GOLDENS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _save_goldens(goldens):
    _ensure_data_dir()
    with open(GOLDENS_FILE, 'w') as f:
        json.dump(goldens, f, indent=2)


def get_goldens(tags=None):
    goldens = _load_goldens()
    if tags:
        goldens = [g for g in goldens if any(t in g.get('tags', []) for t in tags)]
    return goldens


def get_golden(golden_id):
    goldens = _load_goldens()
    for g in goldens:
        if g['id'] == golden_id:
            return g
    return None


def add_golden(user_message, expected_workflow, tags=None, notes=""):
    golden = GoldenExample(
        user_message=user_message,
        expected_workflow=expected_workflow,
        tags=tags or [],
        notes=notes
    )
    goldens = _load_goldens()
    goldens.append(golden.to_dict())
    _save_goldens(goldens)
    return golden.to_dict()


def update_golden(golden_id, updates):
    goldens = _load_goldens()
    for i, g in enumerate(goldens):
        if g['id'] == golden_id:
            for key, value in updates.items():
                if key != 'id':
                    g[key] = value
            goldens[i] = g
            _save_goldens(goldens)
            return g
    return None


def delete_golden(golden_id):
    goldens = _load_goldens()
    goldens = [g for g in goldens if g['id'] != golden_id]
    _save_goldens(goldens)
    return True


def promote_trace_to_golden(trace_id, tags=None, notes=""):
    trace = get_trace(trace_id)
    if not trace:
        return None
    if not trace.get('parsed_workflow'):
        return None

    return add_golden(
        user_message=trace['user_message'],
        expected_workflow=trace['parsed_workflow'],
        tags=tags or [],
        notes=notes or f"Promoted from trace {trace_id}"
    )


def generate_synthetic(count, api_key, categories=None):
    """Use Groq to generate synthetic golden examples based on existing ones."""
    if not api_key:
        return {'error': 'No API key available'}

    existing = _load_goldens()
    examples_text = ""
    for g in existing[:3]:
        examples_text += f"\nPrompt: {g['user_message']}\nWorkflow: {json.dumps(g['expected_workflow'], indent=2)}\n---"

    category_hint = ""
    if categories:
        category_hint = f"\nFocus on these categories: {', '.join(categories)}"

    prompt = f"""Generate {count} new workflow examples for an AI workflow builder tool.
Each example should have a user prompt and the expected workflow JSON output.

Here are some existing examples for reference:
{examples_text}

{category_hint}

Valid step types: filter, slack_message, email, http_request, delay, sub_workflow
Valid trigger types: schedule, webhook, manual

Respond with ONLY valid JSON in this format:
{{"examples": [{{"user_message": "...", "expected_workflow": {{...}}, "tags": ["simple"|"complex"|"edge_case"|"sub_workflow"]}}]}}"""

    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [{'role': 'user', 'content': prompt}],
                'response_format': {'type': 'json_object'},
                'temperature': 0.7,
                'max_tokens': 4000
            }
        )
        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        data = json.loads(content)
        return data.get('examples', [])
    except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
        return {'error': str(e)}
