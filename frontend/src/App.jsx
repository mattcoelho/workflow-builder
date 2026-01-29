import React, { useState, useEffect } from 'react';
import { Send, Play, Save, Loader, Zap, Clock, MessageSquare, Mail, Webhook, Settings, ChevronDown, ChevronRight, Layers, Filter, Globe, Hammer, Download } from 'lucide-react';
import { transformToN8n } from './utils/n8nTransformer';

const WorkflowBuilder = () => {
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I can help you build automated workflows. Try something like: "Send me a Slack alert for any support tickets older than 4 days"' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [workflow, setWorkflow] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Backend URL - use Render deployed backend
  const BACKEND_URL = 'https://workflow-builder-backend-xs8b.onrender.com/api/generate-workflow';

  // Load saved workflows on mount
  useEffect(() => {
    loadSavedWorkflows();
  }, []);

  const loadSavedWorkflows = () => {
    try {
      const saved = localStorage.getItem('workflows');
      if (saved) {
        setSavedWorkflows(JSON.parse(saved));
      }
    } catch (error) {
      console.log('No saved workflows yet');
    }
  };

  const generateWorkflow = async (userMessage) => {
    setIsGenerating(true);
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Only include apiKey if user has set one
      const requestBody = { message: userMessage };
      if (groqApiKey) {
        requestBody.apiKey = groqApiKey;
      }

      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Check for rate limit error
        if (response.status === 429) {
          throw new Error('Rate limit reached. Please set your own Groq API key to continue.');
        }
        throw new Error(`Backend error (${response.status}): ${errorData.error || 'Unknown error'}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0].message.content;
      
      // Try to extract JSON from the response
      let workflowData;
      try {
        // Remove markdown code blocks if present
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          workflowData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found');
        }
      } catch (e) {
        // If parsing fails, create a default workflow
        workflowData = {
          name: 'Custom Workflow',
          trigger: { type: 'manual', config: {} },
          steps: [
            { id: '1', type: 'action', name: 'Execute Action', config: { action: userMessage } }
          ]
        };
      }

      setWorkflow(workflowData);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `I've created a workflow: "${workflowData.name}". You can edit the steps on the right, or ask me to modify it!` 
      }]);
    } catch (error) {
      console.error('Full error:', error);
      let errorMessage = error.message;
      
      if (error.message.includes('Failed to fetch')) {
        errorMessage = `Cannot connect to backend. The Render free tier may be sleeping (takes 30-60s to wake up). Please wait a moment and try again. Error: ${error.message}`;
      }
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${errorMessage}` 
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    generateWorkflow(inputMessage);
    setInputMessage('');
  };

  const executeWorkflow = async () => {
    if (!workflow) return;

    setIsExecuting(true);
    setExecutionLog([]);

    const log = (message, status = 'info') => {
      setExecutionLog(prev => [...prev, { message, status, time: new Date().toLocaleTimeString() }]);
    };

    // Recursive function to execute steps at any depth
    const executeStep = async (step, depth = 0) => {
      const indent = '  '.repeat(depth);

      if (step.type === 'sub_workflow') {
        log(`${indent}▶ Starting: ${step.name}`, 'info');

        // Execute nested steps
        if (step.steps && step.steps.length > 0) {
          for (const nestedStep of step.steps) {
            await executeStep(nestedStep, depth + 1);
          }
        }

        log(`${indent}✓ Completed: ${step.name}`, 'success');
      } else if (step.type === 'filter') {
        log(`${indent}Checking condition: ${step.config?.condition || 'filter criteria'}`, 'info');
        log(`${indent}✓ Condition met, proceeding`, 'success');
      } else if (step.type === 'slack_message') {
        log(`${indent}Sending Slack message to ${step.config?.channel || '#general'}`, 'info');
        log(`${indent}✓ Message sent: "${step.config?.message || step.name}"`, 'success');
      } else if (step.type === 'email') {
        log(`${indent}Sending email to ${step.config?.to || 'recipient'}`, 'info');
        log(`${indent}✓ Email sent`, 'success');
      } else if (step.type === 'http_request') {
        log(`${indent}Making HTTP request to ${step.config?.url || 'API endpoint'}`, 'info');
        log(`${indent}✓ Request completed`, 'success');
      } else if (step.type === 'delay') {
        log(`${indent}Waiting for ${step.config?.duration || 'specified time'}`, 'info');
        log(`${indent}✓ Delay completed`, 'success');
      } else {
        log(`${indent}Executing: ${step.name}`, 'info');
        log(`${indent}✓ Step completed`, 'success');
      }

      await new Promise(resolve => setTimeout(resolve, 600));
    };

    log(`Starting workflow: ${workflow.name}`, 'success');

    // Simulate trigger
    await new Promise(resolve => setTimeout(resolve, 500));
    log(`Trigger activated: ${workflow.trigger.type}`, 'info');

    // Execute all top-level steps
    for (const step of workflow.steps) {
      await executeStep(step, 0);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    log(`Workflow completed successfully!`, 'success');
    setIsExecuting(false);
  };

  const saveWorkflow = () => {
    if (!workflow) return;
    
    const workflowData = { ...workflow, id: Date.now(), savedAt: new Date().toISOString() };
    const updated = [...savedWorkflows, workflowData];
    
    setSavedWorkflows(updated);
    localStorage.setItem('workflows', JSON.stringify(updated));
    
    setChatMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '✓ Workflow saved successfully!' 
    }]);
  };

  const loadWorkflow = (savedWorkflow) => {
    setWorkflow(savedWorkflow);
    setChatMessages(prev => [...prev, { 
      role: 'assistant', 
      content: `Loaded workflow: "${savedWorkflow.name}"` 
    }]);
  };

  const exportToN8n = () => {
    if (!workflow) {
      alert('No workflow to export. Please generate or load a workflow first.');
      return;
    }

    try {
      // Transform workflow to n8n format
      const n8nWorkflow = transformToN8n(workflow);
      
      // Create blob with pretty-printed JSON
      const blob = new Blob([JSON.stringify(n8nWorkflow, null, 2)], { 
        type: 'application/json' 
      });
      
      // Create download link and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workflow.name || 'workflow'}-n8n.json`;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Show success message
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `✓ Workflow exported to n8n format: ${workflow.name || 'workflow'}-n8n.json` 
      }]);
    } catch (error) {
      console.error('Export error:', error);
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error exporting workflow: ${error.message}` 
      }]);
    }
  };

  const getTriggerIcon = (type) => {
    switch(type) {
      case 'schedule': return <Clock className="w-4 h-4" />;
      case 'webhook': return <Webhook className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  const getStepIcon = (type) => {
    switch(type) {
      case 'slack_message': return <MessageSquare className="w-4 h-4" />;
      case 'email': return <Mail className="w-4 h-4" />;
      case 'sub_workflow': return <Layers className="w-4 h-4" />;
      case 'filter': return <Filter className="w-4 h-4" />;
      case 'http_request': return <Globe className="w-4 h-4" />;
      case 'delay': return <Clock className="w-4 h-4" />;
      default: return <Zap className="w-4 h-4" />;
    }
  };

  // Recursive component for rendering nested workflow steps
  const WorkflowStep = ({ step, index, depth = 0 }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasNestedSteps = step.steps && step.steps.length > 0;
    const isSubWorkflow = step.type === 'sub_workflow';

    // Color-coded borders by nesting level
    const borderColors = [
      'border-blue-300',
      'border-green-300',
      'border-orange-300',
      'border-purple-300',
      'border-pink-300'
    ];
    const bgColors = [
      'bg-blue-50',
      'bg-green-50',
      'bg-orange-50',
      'bg-purple-50',
      'bg-pink-50'
    ];
    const borderColor = borderColors[depth % borderColors.length];
    const bgColor = bgColors[depth % bgColors.length];

    return (
      <div className="relative" style={{ marginLeft: depth > 0 ? '24px' : '0' }}>
        {/* Connector line */}
        <div className="absolute left-1/2 -top-4 w-0.5 h-4 bg-gray-300"></div>

        <div className={`bg-white rounded-lg border-2 ${borderColor} p-4`}>
          {/* Step Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {hasNestedSteps && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              )}
              {getStepIcon(step.type)}
              <span className="font-semibold">
                {isSubWorkflow ? step.name : `Step ${index + 1}: ${step.name}`}
              </span>
            </div>
            <span className={`text-xs ${bgColor} px-2 py-1 rounded font-medium`}>
              {step.type.replace('_', ' ')}
            </span>
          </div>

          {/* Step Config */}
          {step.config && Object.keys(step.config).length > 0 && (
            <div className={`${bgColor} rounded p-3 text-sm space-y-1`}>
              {Object.entries(step.config).map(([key, value]) => (
                <div key={key}>
                  <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>{' '}
                  <span className="text-gray-700">{String(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Nested Steps */}
          {hasNestedSteps && isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-3 font-medium">Nested Steps:</p>
              <div className="space-y-4">
                {step.steps.map((nestedStep, nestedIdx) => (
                  <WorkflowStep
                    key={nestedStep.id || nestedIdx}
                    step={nestedStep}
                    index={nestedIdx}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Chat */}
      <div className="w-96 bg-white border-r flex flex-col">
        <div className="p-4 border-b bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Hammer className="w-6 h-6" />
            Agent Smith
          </h1>
          <p className="text-sm opacity-90 mt-1">Forge AI agent workflows in plain English</p>
        </div>

        {/* API Key Input */}
        {showApiKeyInput && (
          <div className="p-4 bg-yellow-50 border-b">
            <label className="block text-sm font-semibold mb-2">Groq API Key:</label>
            <input
              type="password"
              value={groqApiKey}
              onChange={(e) => setGroqApiKey(e.target.value)}
              placeholder="gsk_..."
              className="w-full px-3 py-2 border rounded text-sm mb-2"
            />
            <button
              onClick={() => setShowApiKeyInput(false)}
              className="text-sm text-blue-600 hover:underline"
            >
              Done
            </button>
          </div>
        )}

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex justify-start">
              <div className="bg-gray-100 p-3 rounded-lg flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating workflow...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Describe your workflow..."
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={isGenerating}
              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="text-xs text-gray-500 hover:text-gray-700 mt-2 flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            {groqApiKey ? 'Update API Key' : 'Use Your Own API Key (optional)'}
          </button>
        </div>
      </div>

      {/* Right Panel - Workflow Canvas */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {workflow ? workflow.name : 'No Workflow Yet'}
          </h2>
          <div className="flex gap-2">
            {workflow && (
              <>
                <button
                  onClick={saveWorkflow}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={exportToN8n}
                  disabled={!workflow}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export to n8n
                </button>
                <button
                  onClick={executeWorkflow}
                  disabled={isExecuting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {isExecuting ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Run
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {workflow ? (
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Trigger */}
              <div className="bg-white rounded-lg border-2 border-purple-300 p-4">
                <div className="flex items-center gap-2 mb-2">
                  {getTriggerIcon(workflow.trigger.type)}
                  <span className="font-semibold">Trigger</span>
                </div>
                <div className="bg-purple-50 rounded p-3">
                  <p className="text-sm font-medium capitalize">{workflow.trigger.type}</p>
                  {workflow.trigger.config.interval && (
                    <p className="text-xs text-gray-600 mt-1">Runs {workflow.trigger.config.interval}</p>
                  )}
                </div>
              </div>

              {/* Steps */}
              {workflow.steps.map((step, idx) => (
                <WorkflowStep
                  key={step.id || idx}
                  step={step}
                  index={idx}
                  depth={0}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <Hammer className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Start by describing a workflow in the chat</p>
                <p className="text-sm mt-2">Example: "Send daily email with analytics report"</p>
              </div>
            </div>
          )}

          {/* Execution Log */}
          {executionLog.length > 0 && (
            <div className="max-w-4xl mx-auto mt-6 bg-gray-900 rounded-lg p-4 text-white">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Play className="w-4 h-4" />
                Execution Log
              </h3>
              <div className="space-y-2 font-mono text-xs">
                {executionLog.map((log, idx) => (
                  <div key={idx} className={`flex items-start gap-2 ${
                    log.status === 'success' ? 'text-green-400' : 
                    log.status === 'error' ? 'text-red-400' : 'text-gray-300'
                  }`}>
                    <span className="text-gray-500">[{log.time}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Saved Workflows Sidebar */}
        {savedWorkflows.length > 0 && (
          <div className="w-64 border-l bg-white p-4">
            <h3 className="font-semibold mb-3">Saved Workflows</h3>
            <div className="space-y-2">
              {savedWorkflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => loadWorkflow(wf)}
                  className="w-full text-left p-3 bg-gray-50 rounded hover:bg-gray-100 border"
                >
                  <p className="font-medium text-sm">{wf.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(wf.savedAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;
