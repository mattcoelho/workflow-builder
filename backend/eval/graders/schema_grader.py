from ..models import EvalResult

VALID_TRIGGER_TYPES = {'schedule', 'webhook', 'manual'}
VALID_STEP_TYPES = {'filter', 'slack_message', 'email', 'http_request', 'delay', 'sub_workflow'}


def _collect_all_steps(steps, collected=None):
    """Recursively collect all steps from nested structure."""
    if collected is None:
        collected = []
    for step in steps:
        collected.append(step)
        if step.get('type') == 'sub_workflow' and isinstance(step.get('steps'), list):
            _collect_all_steps(step['steps'], collected)
    return collected


def grade(trace_id, workflow, golden_id=None):
    """Run 8 structural validation checks on a workflow."""
    checks = {}

    # Check 1: Valid JSON (parse succeeded - if we got here, it did)
    checks['valid_json'] = workflow is not None

    if not checks['valid_json']:
        # Can't run remaining checks
        for key in ['has_required_keys', 'valid_trigger_type', 'trigger_has_config',
                     'valid_step_types', 'steps_have_required_fields',
                     'sub_workflows_have_steps', 'has_at_least_one_step']:
            checks[key] = False
        passed_count = sum(1 for v in checks.values() if v)
        return EvalResult(
            trace_id=trace_id,
            grader_name='schema',
            passed=False,
            score=passed_count / len(checks),
            details={'checks': checks},
            golden_id=golden_id
        )

    # Check 2: Has required top-level keys
    checks['has_required_keys'] = (
        isinstance(workflow.get('name'), str) and
        isinstance(workflow.get('trigger'), dict) and
        isinstance(workflow.get('steps'), list)
    )

    # Check 3: Trigger type is valid
    trigger = workflow.get('trigger', {})
    checks['valid_trigger_type'] = trigger.get('type') in VALID_TRIGGER_TYPES

    # Check 4: Trigger has config object
    checks['trigger_has_config'] = isinstance(trigger.get('config'), dict)

    # Check 5: All step types are valid
    steps = workflow.get('steps', [])
    all_steps = _collect_all_steps(steps)

    if all_steps:
        checks['valid_step_types'] = all(
            s.get('type') in VALID_STEP_TYPES for s in all_steps
        )
    else:
        checks['valid_step_types'] = True  # No steps to validate

    # Check 6: All steps have required fields
    if all_steps:
        checks['steps_have_required_fields'] = all(
            isinstance(s.get('id'), str) and
            isinstance(s.get('type'), str) and
            isinstance(s.get('name'), str) and
            isinstance(s.get('config'), dict)
            for s in all_steps
        )
    else:
        checks['steps_have_required_fields'] = True

    # Check 7: sub_workflow steps have nested steps array
    sub_workflows = [s for s in all_steps if s.get('type') == 'sub_workflow']
    if sub_workflows:
        checks['sub_workflows_have_steps'] = all(
            isinstance(s.get('steps'), list) for s in sub_workflows
        )
    else:
        checks['sub_workflows_have_steps'] = True  # No sub_workflows to validate

    # Check 8: At least one step exists
    checks['has_at_least_one_step'] = len(steps) > 0

    passed_count = sum(1 for v in checks.values() if v)
    total = len(checks)

    return EvalResult(
        trace_id=trace_id,
        grader_name='schema',
        passed=passed_count == total,
        score=passed_count / total,
        details={'checks': checks},
        golden_id=golden_id
    )
