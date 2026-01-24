# AI Workflow Builder

An AI-powered workflow automation tool that converts natural language descriptions into executable workflows.

**Live Demo:** [agentsmith.teamdiogo.com](https://agentsmith.teamdiogo.com)

## Features

- **Natural Language Input** - Describe your workflow in plain English
- **Nested Sub-workflows** - Support for multi-level, complex workflows
- **Visual Workflow Editor** - Color-coded, collapsible workflow visualization
- **Workflow Execution** - Simulate running your workflows with detailed logs
- **Save & Load** - Store workflows locally for later use

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Flask + Flask-CORS
- **AI:** Groq API (Llama 3.3 70B)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.9+

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Backend runs on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

## Deployment

- **Frontend:** Deployed as static site on Render
- **Backend:** Deployed as web service on Render

### Environment Variables

Backend requires:
- `GROQ_API_KEY` - Default Groq API key (optional, users can provide their own)

## Usage

1. Open the app in your browser
2. Type a workflow description like: "Send a Slack alert when a support ticket is older than 4 days"
3. The AI generates a structured workflow with triggers and steps
4. Click "Run" to simulate execution
5. Click "Save" to store the workflow locally

## Example Prompts

- "Send daily email with analytics report"
- "Handle customer support tickets with categorization and resolution"
- "Monitor API health and alert on failures"

## License

MIT
