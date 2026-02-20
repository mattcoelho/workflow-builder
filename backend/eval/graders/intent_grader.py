import json
import os
import requests
from ..models import EvalResult

JUDGE_PROMPT = """You are evaluating whether an AI-generated workflow correctly fulfills a user's request.

User Request: {user_message}

Generated Workflow:
{workflow_json}

{golden_section}

Score the workflow on these dimensions. Each dimension is binary (0 = fail, 1 = pass):

1. INTENT_MATCH: Does the workflow address what the user asked for?
2. STEP_COMPLETENESS: Does it include all necessary steps to fulfill the request?
3. STEP_TYPES: Are the step types appropriate (e.g., email for sending emails, slack_message for Slack notifications)?
4. TRIGGER_MATCH: Is the trigger type logical for the request (schedule for recurring tasks, webhook for event-driven, manual for one-time)?
5. STRUCTURE: Is the nesting/grouping of steps logical? Are related steps grouped into sub_workflows when appropriate?

Respond with ONLY valid JSON in this format:
{{"scores": {{"intent_match": 0 or 1, "step_completeness": 0 or 1, "step_types": 0 or 1, "trigger_match": 0 or 1, "structure": 0 or 1}}, "reasoning": "Brief explanation of your scoring"}}"""


def grade(trace_id, user_message, workflow, api_key, golden_workflow=None, golden_id=None):
    """Use LLM-as-Judge to evaluate workflow quality."""
    if not api_key:
        return EvalResult(
            trace_id=trace_id,
            grader_name='intent',
            passed=False,
            score=0.0,
            details={'error': 'No API key available for LLM judge'},
            golden_id=golden_id
        )

    golden_section = ""
    if golden_workflow:
        golden_section = f"Reference (expected) Workflow:\n{json.dumps(golden_workflow, indent=2)}"

    prompt = JUDGE_PROMPT.format(
        user_message=user_message,
        workflow_json=json.dumps(workflow, indent=2),
        golden_section=golden_section
    )

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
                'temperature': 0.1,
                'max_tokens': 500
            }
        )

        response.raise_for_status()
        result = response.json()
        content = result['choices'][0]['message']['content']
        judge_output = json.loads(content)

        scores = judge_output.get('scores', {})
        reasoning = judge_output.get('reasoning', '')

        score_values = list(scores.values())
        avg_score = sum(score_values) / len(score_values) if score_values else 0
        all_passed = all(v == 1 for v in score_values)

        return EvalResult(
            trace_id=trace_id,
            grader_name='intent',
            passed=all_passed,
            score=avg_score,
            details={
                'scores': scores,
                'reasoning': reasoning
            },
            golden_id=golden_id
        )

    except (requests.RequestException, json.JSONDecodeError, KeyError) as e:
        return EvalResult(
            trace_id=trace_id,
            grader_name='intent',
            passed=False,
            score=0.0,
            details={'error': str(e)},
            golden_id=golden_id
        )
