from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os
import time

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Register eval blueprint
from eval_routes import eval_bp
app.register_blueprint(eval_bp)

# System prompt constant (shared with eval pipeline)
SYSTEM_PROMPT = '''You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanations.

Convert user requests into workflow JSON with this structure:
{"name":"string","trigger":{"type":"schedule|webhook|manual","config":{}},"steps":[]}

Step types: filter, slack_message, email, http_request, delay, sub_workflow

IMPORTANT: For complex requests with multiple phases, ALWAYS use sub_workflow to group related steps:
{"id":"step1","type":"sub_workflow","name":"Phase Name","config":{},"steps":[...nested steps...]}

Example for "handle customer support":
{"name":"Customer Support Handler","trigger":{"type":"webhook","config":{}},"steps":[{"id":"step1","type":"sub_workflow","name":"Categorize Issue","config":{},"steps":[{"id":"step1.1","type":"filter","name":"Check issue type","config":{"condition":"issue.type"},"steps":[]}]},{"id":"step2","type":"sub_workflow","name":"Resolve Issue","config":{},"steps":[{"id":"step2.1","type":"http_request","name":"Lookup order","config":{"url":"/api/orders"},"steps":[]},{"id":"step2.2","type":"email","name":"Send resolution","config":{"to":"customer"},"steps":[]}]},{"id":"step3","type":"slack_message","name":"Log resolution","config":{"channel":"#support"},"steps":[]}]}'''


@app.route('/', methods=['GET'])
def home():
    return jsonify({'message': 'Backend is running'})


@app.route('/api/generate-workflow', methods=['POST', 'OPTIONS'])
def generate_workflow():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.json
        user_message = data.get('message')
        api_key = data.get('apiKey') or os.environ.get('GROQ_API_KEY')

        if not api_key:
            return jsonify({'error': 'No API key available. Please provide your own Groq API key.'}), 400

        start = time.time()

        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'response_format': {'type': 'json_object'},
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': user_message}
                ],
                'temperature': 0.5,
                'max_tokens': 2000
            }
        )

        latency_ms = int((time.time() - start) * 1000)

        if response.status_code != 200:
            return jsonify({'error': f'Groq API error: {response.text}'}), response.status_code

        response_data = response.json()

        # Capture trace for eval pipeline
        try:
            from eval.traces import save_trace, parse_workflow_from_response
            from eval.models import Trace

            parsed_workflow, parse_success = parse_workflow_from_response(response_data)

            trace = Trace(
                user_message=user_message,
                system_prompt=SYSTEM_PROMPT,
                model='llama-3.3-70b-versatile',
                temperature=0.5,
                raw_response=response_data,
                parsed_workflow=parsed_workflow,
                parse_success=parse_success,
                latency_ms=latency_ms
            )
            save_trace(trace)
        except Exception:
            pass  # Don't let trace capture break the main endpoint

        return jsonify(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
