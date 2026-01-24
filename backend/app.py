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
    try:
        data = request.json
        user_message = data.get('message')
        api_key = data.get('apiKey')
        
        if not api_key:
            return jsonify({'error': 'API key required'}), 400
        
        # Call Groq API
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [
                    {
                        'role': 'system',
                        'content': '''You are a workflow automation expert. Convert user requests into structured workflows with triggers and actions. 

Always respond with valid JSON in this exact format:
{
  "name": "Workflow Name",
  "trigger": {
    "type": "schedule|webhook|manual",
    "config": {"interval": "daily"} or {"url": "..."} or {}
  },
  "steps": [
    {
      "id": "step1",
      "type": "filter|slack_message|email|http_request|delay",
      "name": "Step Name",
      "config": {
        "condition": "age > 4 days",
        "source": "support tickets",
        "channel": "#support",
        "message": "Alert message"
      }
    }
  ]
}

Available trigger types: schedule, webhook, manual
Available step types: filter, slack_message, email, http_request, delay
Keep it simple and practical.'''
                    },
                    {
                        'role': 'user',
                        'content': user_message
                    }
                ],
                'temperature': 0.7,
                'max_tokens': 1000
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