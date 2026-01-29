/**
 * Transform custom workflow format to n8n import format
 * 
 * Input format:
 * {
 *   name: string,
 *   trigger: { type: "webhook|schedule|manual", config: {} },
 *   steps: [{ id, type, name, config, steps }]
 * }
 * 
 * Output format (n8n):
 * {
 *   name: string,
 *   nodes: [{ id, name, type, typeVersion, position, parameters }],
 *   connections: { "NodeName": { main: [[{ node, type, index }]] } },
 *   settings: {},
 *   staticData: null,
 *   tags: []
 * }
 */

/**
 * Generate UUID using crypto.randomUUID() with fallback
 */
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Map trigger type to n8n node type
 */
function mapTriggerTypeToN8n(triggerType) {
  const triggerMap = {
    'webhook': 'n8n-nodes-base.webhook',
    'schedule': 'n8n-nodes-base.scheduleTrigger',
    'manual': 'n8n-nodes-base.manualTrigger'
  };
  return triggerMap[triggerType] || 'n8n-nodes-base.manualTrigger';
}

/**
 * Map step type to n8n node type
 */
function mapStepTypeToN8n(stepType) {
  const typeMap = {
    'slack_message': 'n8n-nodes-base.slack',
    'email': 'n8n-nodes-base.emailSend',
    'http_request': 'n8n-nodes-base.httpRequest',
    'filter': 'n8n-nodes-base.filter',
    'delay': 'n8n-nodes-base.wait',
    'sub_workflow': 'n8n-nodes-base.executeWorkflow'
  };
  return typeMap[stepType] || 'n8n-nodes-base.noOp';
}

/**
 * Create trigger node from trigger object
 */
function createTriggerNode(trigger, yPosition) {
  const nodeId = generateUUID();
  const nodeType = mapTriggerTypeToN8n(trigger.type);
  
  return {
    id: nodeId,
    name: 'Trigger',
    type: nodeType,
    typeVersion: 1,
    position: [250, yPosition],
    parameters: trigger.config || {}
  };
}

/**
 * Recursively flatten steps into nodes array
 * Handles sub_workflows by creating container node, then processing nested steps
 */
function flattenSteps(steps, nodes, nodeMap, startY) {
  if (!Array.isArray(steps)) {
    return startY;
  }

  let currentY = startY;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nodeId = generateUUID();
    const nodeName = step.name || `Step ${i + 1}`;
    
    // Create node for this step
    const node = {
      id: nodeId,
      name: nodeName,
      type: mapStepTypeToN8n(step.type),
      typeVersion: 1,
      position: [250, currentY],
      parameters: step.config || {}
    };

    nodes.push(node);
    nodeMap.push({ id: nodeId, name: nodeName });
    currentY += 150;

    // If it's a sub_workflow, recursively process nested steps
    if (step.type === 'sub_workflow' && step.steps && Array.isArray(step.steps) && step.steps.length > 0) {
      currentY = flattenSteps(step.steps, nodes, nodeMap, currentY);
    }
  }

  return currentY;
}

/**
 * Build connections object for linear node chaining
 */
function buildConnections(nodeMap, connections) {
  // Create linear chain: each node connects to the next
  for (let i = 0; i < nodeMap.length - 1; i++) {
    const currentNode = nodeMap[i];
    const nextNode = nodeMap[i + 1];
    
    connections[currentNode.name] = {
      main: [[{
        node: nextNode.name,
        type: 'main',
        index: 0
      }]]
    };
  }
}

/**
 * Transform custom workflow format to n8n import format
 * 
 * @param {Object} workflow - Custom workflow object
 * @returns {Object} n8n workflow format
 */
export function transformToN8n(workflow) {
  if (!workflow || typeof workflow !== 'object') {
    throw new Error('Invalid workflow: workflow must be an object');
  }

  const nodes = [];
  const connections = {};
  const nodeMap = []; // Track nodes for connection building
  let yPosition = 250; // Starting Y position

  // 1. Create trigger node
  if (workflow.trigger) {
    const triggerNode = createTriggerNode(workflow.trigger, yPosition);
    nodes.push(triggerNode);
    nodeMap.push({ id: triggerNode.id, name: triggerNode.name });
    yPosition += 150;
  }

  // 2. Flatten and process steps recursively
  if (workflow.steps && Array.isArray(workflow.steps)) {
    yPosition = flattenSteps(workflow.steps, nodes, nodeMap, yPosition);
  }

  // 3. Build connections (linear chain)
  buildConnections(nodeMap, connections);

  // 4. Return n8n format
  return {
    name: workflow.name || 'Generated Workflow',
    nodes: nodes,
    connections: connections,
    settings: {},
    staticData: null,
    tags: []
  };
}
