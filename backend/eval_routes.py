from flask import Blueprint, request, jsonify
from eval import traces, golden_dataset, runner

eval_bp = Blueprint('eval', __name__, url_prefix='/api/eval')


# --- Traces ---

@eval_bp.route('/traces', methods=['GET'])
def list_traces():
    limit = request.args.get('limit', 50, type=int)
    offset = request.args.get('offset', 0, type=int)
    trace_list, total = traces.get_traces(limit=limit, offset=offset)
    return jsonify({'traces': trace_list, 'total': total})


@eval_bp.route('/traces/<trace_id>', methods=['GET'])
def get_trace(trace_id):
    trace = traces.get_trace(trace_id)
    if not trace:
        return jsonify({'error': 'Trace not found'}), 404
    return jsonify(trace)


@eval_bp.route('/traces/<trace_id>', methods=['DELETE'])
def delete_trace(trace_id):
    traces.delete_trace(trace_id)
    return jsonify({'success': True})


@eval_bp.route('/traces/<trace_id>/annotate', methods=['PUT'])
def annotate_trace(trace_id):
    data = request.json
    verdict = data.get('verdict')
    notes = data.get('notes', '')

    if verdict not in ('correct', 'incorrect', 'partial'):
        return jsonify({'error': 'Invalid verdict. Must be correct, incorrect, or partial'}), 400

    result = traces.annotate_trace(trace_id, verdict, notes)
    if not result:
        return jsonify({'error': 'Trace not found'}), 404
    return jsonify(result)


# --- Grading ---

@eval_bp.route('/traces/<trace_id>/grade', methods=['POST'])
def grade_trace(trace_id):
    data = request.json
    grader_name = data.get('grader', 'schema')

    trace = traces.get_trace(trace_id)
    if not trace:
        return jsonify({'error': 'Trace not found'}), 404

    result = runner.run_grader(grader_name, trace)
    return jsonify(result.to_dict())


@eval_bp.route('/run', methods=['POST'])
def run_eval():
    data = request.json or {}
    graders = data.get('graders', ['schema'])
    limit = data.get('limit', 50)

    results = runner.run_eval(graders, limit=limit)
    return jsonify(results)


# --- Goldens ---

@eval_bp.route('/goldens', methods=['GET'])
def list_goldens():
    tags = request.args.getlist('tags')
    goldens = golden_dataset.get_goldens(tags=tags if tags else None)
    return jsonify({'goldens': goldens, 'total': len(goldens)})


@eval_bp.route('/goldens', methods=['POST'])
def create_golden():
    data = request.json
    user_message = data.get('user_message')
    expected_workflow = data.get('expected_workflow')

    if not user_message or not expected_workflow:
        return jsonify({'error': 'user_message and expected_workflow are required'}), 400

    golden = golden_dataset.add_golden(
        user_message=user_message,
        expected_workflow=expected_workflow,
        tags=data.get('tags', []),
        notes=data.get('notes', '')
    )
    return jsonify(golden), 201


@eval_bp.route('/goldens/<golden_id>', methods=['PUT'])
def update_golden(golden_id):
    data = request.json
    result = golden_dataset.update_golden(golden_id, data)
    if not result:
        return jsonify({'error': 'Golden not found'}), 404
    return jsonify(result)


@eval_bp.route('/goldens/<golden_id>', methods=['DELETE'])
def delete_golden(golden_id):
    golden_dataset.delete_golden(golden_id)
    return jsonify({'success': True})


@eval_bp.route('/goldens/from-trace', methods=['POST'])
def promote_trace():
    data = request.json
    trace_id = data.get('trace_id')
    if not trace_id:
        return jsonify({'error': 'trace_id is required'}), 400

    result = golden_dataset.promote_trace_to_golden(
        trace_id,
        tags=data.get('tags', []),
        notes=data.get('notes', '')
    )
    if not result:
        return jsonify({'error': 'Trace not found or has no parsed workflow'}), 404
    return jsonify(result), 201


@eval_bp.route('/goldens/generate', methods=['POST'])
def generate_synthetic():
    data = request.json or {}
    count = data.get('count', 5)
    categories = data.get('categories')

    import os
    api_key = data.get('apiKey') or os.environ.get('GROQ_API_KEY')
    if not api_key:
        return jsonify({'error': 'No API key available'}), 400

    result = golden_dataset.generate_synthetic(count, api_key, categories)
    if isinstance(result, dict) and 'error' in result:
        return jsonify(result), 500
    return jsonify({'generated': result})


# --- Advanced ---

@eval_bp.route('/run-goldens', methods=['POST'])
def run_golden_eval():
    data = request.json or {}
    graders = data.get('graders', ['schema', 'intent'])
    golden_ids = data.get('golden_ids')

    results = runner.run_golden_eval(graders, golden_ids=golden_ids)
    if isinstance(results, dict) and 'error' in results:
        return jsonify(results), 500
    return jsonify(results)


@eval_bp.route('/pass-at-k', methods=['POST'])
def pass_at_k():
    data = request.json
    golden_id = data.get('golden_id')
    k = data.get('k', 5)

    if not golden_id:
        return jsonify({'error': 'golden_id is required'}), 400

    results = runner.run_pass_at_k(golden_id, k=k)
    if isinstance(results, dict) and 'error' in results:
        return jsonify(results), 500
    return jsonify(results)


@eval_bp.route('/compare', methods=['POST'])
def compare():
    data = request.json
    config_a = data.get('config_a', {})
    config_b = data.get('config_b', {})
    golden_ids = data.get('golden_ids')
    graders = data.get('graders')

    results = runner.run_comparison(config_a, config_b, golden_ids, graders)
    if isinstance(results, dict) and 'error' in results:
        return jsonify(results), 500
    return jsonify(results)
