from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

@app.route('/', methods=['GET'])
def home():
    return jsonify({'message': 'Backend is running'})

@app.route('/api/generate-workflow', methods=['POST', 'OPTIONS'])
def generate_workflow():
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.json
        user_message = data.get('message')
        # Use provided API key, or fall back to environment variable
        api_key = data.get('apiKey') or os.environ.get('GROQ_API_KEY')

        if not api_key:
            return jsonify({'error': 'No API key available. Please provide your own Groq API key.'}), 400
        
        # Call Groq API
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
                    {
                        'role': 'system',
                        'content': '''You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanations.

Convert user requests into workflow JSON with this structure:
{"name":"string","trigger":{"type":"schedule|webhook|manual","config":{}},"steps":[]}

Step types: filter, slack_message, email, http_request, delay, sub_workflow

IMPORTANT: For complex requests with multiple phases, ALWAYS use sub_workflow to group related steps:
{"id":"step1","type":"sub_workflow","name":"Phase Name","config":{},"steps":[...nested steps...]}

Example for "handle customer support":
{"name":"Customer Support Handler","trigger":{"type":"webhook","config":{}},"steps":[{"id":"step1","type":"sub_workflow","name":"Categorize Issue","config":{},"steps":[{"id":"step1.1","type":"filter","name":"Check issue type","config":{"condition":"issue.type"},"steps":[]}]},{"id":"step2","type":"sub_workflow","name":"Resolve Issue","config":{},"steps":[{"id":"step2.1","type":"http_request","name":"Lookup order","config":{"url":"/api/orders"},"steps":[]},{"id":"step2.2","type":"email","name":"Send resolution","config":{"to":"customer"},"steps":[]}]},{"id":"step3","type":"slack_message","name":"Log resolution","config":{"channel":"#support"},"steps":[]}]}'''
                    },
                    {
                        'role': 'user',
                        'content': user_message
                    }
                ],
                'temperature': 0.5,
                'max_tokens': 2000
            }
        )
        
        if response.status_code != 200:
            return jsonify({'error': f'Groq API error: {response.text}'}), response.status_code
        
        return jsonify(response.json())
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)