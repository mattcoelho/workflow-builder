import os
import time
import json
import requests
from .models import Trace, EvalResult
from .traces import get_traces, get_trace, save_trace, parse_workflow_from_response
from .golden_dataset import get_goldens, get_golden
from .graders import schema_grader, intent_grader

SYSTEM_PROMPT = '''You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanations.

Convert user requests into workflow JSON with this structure:
{"name":"string","trigger":{"type":"schedule|webhook|manual","config":{}},"steps":[]}

Step types: filter, slack_message, email, http_request, delay, sub_workflow

IMPORTANT: For complex requests with multiple phases, ALWAYS use sub_workflow to group related steps. Each sub_workflow has its own "steps" array for nesting.

Every step must have: id (string), type (string), name (string), config (object).
For sub_workflow steps, include a "steps" array with nested steps.'''


def _get_api_key():
    return os.environ.get('GROQ_API_KEY')


def _generate_workflow(user_message, api_key, temperature=0.5):
    """Generate a workflow by calling the Groq API."""
    start = time.time()
    error = None
    response_data = None

    try:
        response = requests.post(
            'https://api.groq.com/openai/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'llama-3.3-70b-versatile',
                'messages': [
                    {'role': 'system', 'content': SYSTEM_PROMPT},
                    {'role': 'user', 'content': user_message}
                ],
                'response_format': {'type': 'json_object'},
                'temperature': temperature,
                'max_tokens': 2000
            }
        )
        response.raise_for_status()
        response_data = response.json()
    except requests.RequestException as e:
        error = str(e)

    latency_ms = int((time.time() - start) * 1000)
    parsed_workflow, parse_success = (
        parse_workflow_from_response(response_data)
        if response_data else (None, False)
    )

    trace = Trace(
        user_message=user_message,
        system_prompt=SYSTEM_PROMPT,
        model='llama-3.3-70b-versatile',
        temperature=temperature,
        raw_response=response_data or {},
        parsed_workflow=parsed_workflow,
        parse_success=parse_success,
        latency_ms=latency_ms,
        error=error
    )

    return trace


def run_grader(grader_name, trace_data, golden_data=None):
    """Run a specific grader on a trace."""
    api_key = _get_api_key()
    workflow = trace_data.get('parsed_workflow')

    if grader_name == 'schema':
        return schema_grader.grade(
            trace_id=trace_data['id'],
            workflow=workflow,
            golden_id=golden_data['id'] if golden_data else None
        )
    elif grader_name == 'intent':
        return intent_grader.grade(
            trace_id=trace_data['id'],
            user_message=trace_data['user_message'],
            workflow=workflow,
            api_key=api_key,
            golden_workflow=golden_data.get('expected_workflow') if golden_data else None,
            golden_id=golden_data['id'] if golden_data else None
        )
    else:
        return EvalResult(
            trace_id=trace_data['id'],
            grader_name=grader_name,
            passed=False,
            score=0.0,
            details={'error': f'Unknown grader: {grader_name}'}
        )


def run_eval(graders, limit=50):
    """Run specified graders against recent traces."""
    traces, total = get_traces(limit=limit)
    results = []

    for trace_data in traces:
        for grader_name in graders:
            result = run_grader(grader_name, trace_data)
            results.append(result.to_dict())

    summary = _compute_summary(results, graders)
    return {'results': results, 'summary': summary}


def run_golden_eval(graders, golden_ids=None):
    """Re-generate workflows for goldens and grade against expected."""
    api_key = _get_api_key()
    if not api_key:
        return {'error': 'No API key available'}

    goldens = get_goldens()
    if golden_ids:
        goldens = [g for g in goldens if g['id'] in golden_ids]

    results = []
    for golden_data in goldens:
        # Generate a new workflow
        trace = _generate_workflow(golden_data['user_message'], api_key)
        saved_trace = save_trace(trace)
        trace_data = saved_trace.to_dict()

        for grader_name in graders:
            result = run_grader(grader_name, trace_data, golden_data)
            results.append(result.to_dict())

    summary = _compute_summary(results, graders)
    return {'results': results, 'summary': summary}


def run_pass_at_k(golden_id, k=5):
    """Generate K times for same prompt, report pass rates."""
    api_key = _get_api_key()
    if not api_key:
        return {'error': 'No API key available'}

    golden_data = get_golden(golden_id)
    if not golden_data:
        return {'error': f'Golden {golden_id} not found'}

    attempts = []
    for i in range(k):
        trace = _generate_workflow(golden_data['user_message'], api_key)
        saved_trace = save_trace(trace)
        trace_data = saved_trace.to_dict()

        schema_result = run_grader('schema', trace_data, golden_data)
        intent_result = run_grader('intent', trace_data, golden_data)

        attempts.append({
            'attempt': i + 1,
            'trace_id': trace_data['id'],
            'schema': schema_result.to_dict(),
            'intent': intent_result.to_dict()
        })

    schema_passes = sum(1 for a in attempts if a['schema']['passed'])
    intent_passes = sum(1 for a in attempts if a['intent']['passed'])

    return {
        'golden_id': golden_id,
        'k': k,
        'attempts': attempts,
        'pass_at_k': {
            'schema': schema_passes / k,
            'intent': intent_passes / k
        },
        'pass_hat_at_k': {
            'schema': 1.0 if schema_passes == k else 0.0,
            'intent': 1.0 if intent_passes == k else 0.0
        }
    }


def run_comparison(config_a, config_b, golden_ids=None, graders=None):
    """A/B test two configs against goldens."""
    api_key = _get_api_key()
    if not api_key:
        return {'error': 'No API key available'}

    graders = graders or ['schema', 'intent']
    goldens = get_goldens()
    if golden_ids:
        goldens = [g for g in goldens if g['id'] in golden_ids]

    results_a = []
    results_b = []

    for golden_data in goldens:
        # Config A
        trace_a = _generate_workflow(
            golden_data['user_message'], api_key,
            temperature=config_a.get('temperature', 0.5)
        )
        saved_a = save_trace(trace_a)
        trace_a_data = saved_a.to_dict()

        # Config B
        trace_b = _generate_workflow(
            golden_data['user_message'], api_key,
            temperature=config_b.get('temperature', 0.5)
        )
        saved_b = save_trace(trace_b)
        trace_b_data = saved_b.to_dict()

        for grader_name in graders:
            result_a = run_grader(grader_name, trace_a_data, golden_data)
            result_b = run_grader(grader_name, trace_b_data, golden_data)
            results_a.append(result_a.to_dict())
            results_b.append(result_b.to_dict())

    a_wins = sum(1 for a, b in zip(results_a, results_b) if a['score'] > b['score'])
    b_wins = sum(1 for a, b in zip(results_a, results_b) if b['score'] > a['score'])
    ties = len(results_a) - a_wins - b_wins

    return {
        'config_a': config_a,
        'config_b': config_b,
        'results_a': results_a,
        'results_b': results_b,
        'comparison': {
            'a_wins': a_wins,
            'b_wins': b_wins,
            'ties': ties
        }
    }


def _compute_summary(results, graders):
    """Compute aggregate statistics from eval results."""
    summary = {
        'total': len(results),
        'passed': sum(1 for r in results if r['passed']),
        'failed': sum(1 for r in results if not r['passed']),
        'avg_score': sum(r['score'] for r in results) / len(results) if results else 0,
        'by_grader': {}
    }

    for grader in graders:
        grader_results = [r for r in results if r['grader_name'] == grader]
        if grader_results:
            summary['by_grader'][grader] = {
                'total': len(grader_results),
                'passed': sum(1 for r in grader_results if r['passed']),
                'failed': sum(1 for r in grader_results if not r['passed']),
                'avg_score': sum(r['score'] for r in grader_results) / len(grader_results)
            }

    return summary
