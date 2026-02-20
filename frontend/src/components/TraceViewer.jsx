import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, Award, Search } from 'lucide-react';
import { gradeTrace, deleteTrace } from '../utils/evalApi';
import AnnotationPanel from './AnnotationPanel';

const TraceViewer = ({ traces, onRefresh, onPromoteToGolden }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [gradeResults, setGradeResults] = useState({});
  const [loading, setLoading] = useState({});
  const [filter, setFilter] = useState('');

  const filteredTraces = traces.filter(t =>
    !filter || t.user_message.toLowerCase().includes(filter.toLowerCase())
  );

  const handleGrade = async (traceId, grader) => {
    setLoading(prev => ({ ...prev, [`${traceId}-${grader}`]: true }));
    try {
      const result = await gradeTrace(traceId, grader);
      setGradeResults(prev => ({
        ...prev,
        [traceId]: { ...prev[traceId], [grader]: result }
      }));
    } catch (err) {
      console.error('Grade error:', err);
    }
    setLoading(prev => ({ ...prev, [`${traceId}-${grader}`]: false }));
  };

  const handleDelete = async (traceId) => {
    try {
      await deleteTrace(traceId);
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter traces..."
          className="flex-1 px-3 py-2 border rounded text-sm"
        />
      </div>

      {filteredTraces.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No traces captured yet. Generate a workflow in the Builder tab to create traces.</p>
      ) : (
        <div className="space-y-2">
          {filteredTraces.map((trace) => (
            <div key={trace.id} className="border rounded-lg bg-white">
              {/* Row header */}
              <div
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === trace.id ? null : trace.id)}
              >
                {expandedId === trace.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <span className={`w-2 h-2 rounded-full ${trace.parse_success ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium truncate flex-1">{trace.user_message}</span>
                <span className="text-xs text-gray-400">{trace.latency_ms}ms</span>
                <span className="text-xs text-gray-400">{new Date(trace.timestamp).toLocaleString()}</span>
              </div>

              {/* Expanded detail */}
              {expandedId === trace.id && (
                <div className="border-t p-4 space-y-4">
                  {/* User message */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">User Message</h4>
                    <p className="text-sm bg-gray-50 p-3 rounded">{trace.user_message}</p>
                  </div>

                  {/* System prompt (collapsible) */}
                  <details>
                    <summary className="text-xs font-semibold text-gray-500 uppercase cursor-pointer">System Prompt</summary>
                    <pre className="text-xs bg-gray-50 p-3 rounded mt-1 whitespace-pre-wrap font-mono overflow-auto max-h-40">{trace.system_prompt}</pre>
                  </details>

                  {/* Parsed workflow */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
                      Parsed Workflow {trace.parse_success ? '(Success)' : '(Failed)'}
                    </h4>
                    <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded font-mono overflow-auto max-h-60">
                      {trace.parsed_workflow ? JSON.stringify(trace.parsed_workflow, null, 2) : 'No workflow parsed'}
                    </pre>
                  </div>

                  {/* Grade results */}
                  {gradeResults[trace.id] && (
                    <div className="space-y-2">
                      {Object.entries(gradeResults[trace.id]).map(([grader, result]) => (
                        <div key={grader} className="bg-gray-50 p-3 rounded">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {result.passed ? 'PASS' : 'FAIL'}
                            </span>
                            <span className="text-xs font-semibold uppercase">{grader}</span>
                            <span className="text-xs text-gray-500">Score: {(result.score * 100).toFixed(0)}%</span>
                          </div>
                          {result.details?.checks && (
                            <div className="grid grid-cols-2 gap-1">
                              {Object.entries(result.details.checks).map(([check, passed]) => (
                                <div key={check} className="flex items-center gap-1 text-xs">
                                  <span className={passed ? 'text-green-600' : 'text-red-600'}>
                                    {passed ? '  ' : '  '}
                                  </span>
                                  <span>{check.replace(/_/g, ' ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {result.details?.scores && (
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {Object.entries(result.details.scores).map(([dim, val]) => (
                                <div key={dim} className="flex items-center gap-1 text-xs">
                                  <span className={val === 1 ? 'text-green-600' : 'text-red-600'}>
                                    {val === 1 ? '  ' : '  '}
                                  </span>
                                  <span>{dim.replace(/_/g, ' ')}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {result.details?.reasoning && (
                            <p className="text-xs text-gray-600 mt-2 italic">{result.details.reasoning}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Annotations */}
                  <AnnotationPanel traceId={trace.id} annotations={trace.annotations || []} onRefresh={onRefresh} />

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <button
                      onClick={() => handleGrade(trace.id, 'schema')}
                      disabled={loading[`${trace.id}-schema`]}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                    >
                      {loading[`${trace.id}-schema`] ? 'Grading...' : 'Schema Grade'}
                    </button>
                    <button
                      onClick={() => handleGrade(trace.id, 'intent')}
                      disabled={loading[`${trace.id}-intent`]}
                      className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                    >
                      {loading[`${trace.id}-intent`] ? 'Judging...' : 'Intent Grade'}
                    </button>
                    <button
                      onClick={() => onPromoteToGolden(trace.id)}
                      className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200 flex items-center gap-1"
                    >
                      <Award className="w-3 h-3" />
                      Promote to Golden
                    </button>
                    <button
                      onClick={() => handleDelete(trace.id)}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 ml-auto flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TraceViewer;
