import React, { useState } from 'react';
import { Play, Loader, ChevronDown, ChevronRight } from 'lucide-react';
import { runEval, runGoldenEval, runPassAtK } from '../utils/evalApi';

const EvalRunResults = ({ goldens }) => {
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [passAtKResults, setPassAtKResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState(null);

  // Config
  const [useGoldens, setUseGoldens] = useState(false);
  const [graders, setGraders] = useState({ schema: true, intent: false });
  const [passAtK, setPassAtK] = useState(3);
  const [selectedGoldenId, setSelectedGoldenId] = useState('');

  const selectedGraders = Object.entries(graders).filter(([_, v]) => v).map(([k]) => k);

  const handleRunEval = async () => {
    setIsRunning(true);
    setResults(null);
    setSummary(null);
    try {
      const data = useGoldens
        ? await runGoldenEval(selectedGraders)
        : await runEval(selectedGraders);
      setResults(data.results);
      setSummary(data.summary);
    } catch (err) {
      console.error('Eval error:', err);
    }
    setIsRunning(false);
  };

  const handleRunPassAtK = async () => {
    if (!selectedGoldenId) return;
    setIsRunning(true);
    setPassAtKResults(null);
    try {
      const data = await runPassAtK(selectedGoldenId, passAtK);
      setPassAtKResults(data);
    } catch (err) {
      console.error('Pass@K error:', err);
    }
    setIsRunning(false);
  };

  return (
    <div>
      {/* Config panel */}
      <div className="bg-gray-50 border rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold mb-3">Run Configuration</h4>
        <div className="flex items-center gap-4 flex-wrap">
          {/* Grader selection */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">Graders:</span>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={graders.schema}
                onChange={(e) => setGraders(prev => ({ ...prev, schema: e.target.checked }))}
              />
              Schema
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={graders.intent}
                onChange={(e) => setGraders(prev => ({ ...prev, intent: e.target.checked }))}
              />
              Intent (LLM Judge)
            </label>
          </div>

          {/* Eval against goldens toggle */}
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={useGoldens}
              onChange={(e) => setUseGoldens(e.target.checked)}
            />
            Eval against golden dataset
          </label>

          <button
            onClick={handleRunEval}
            disabled={isRunning || selectedGraders.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isRunning ? <Loader className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Evaluation
          </button>
        </div>

        {/* Pass@K config */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
          <span className="text-xs text-gray-600">Pass@K:</span>
          <select
            value={selectedGoldenId}
            onChange={(e) => setSelectedGoldenId(e.target.value)}
            className="px-2 py-1 border rounded text-xs"
          >
            <option value="">Select golden...</option>
            {goldens.map(g => (
              <option key={g.id} value={g.id}>{g.user_message.substring(0, 50)}</option>
            ))}
          </select>
          <span className="text-xs text-gray-600">K=</span>
          <input
            type="number"
            value={passAtK}
            onChange={(e) => setPassAtK(Number(e.target.value))}
            min={2}
            max={10}
            className="w-14 px-2 py-1 border rounded text-xs"
          />
          <button
            onClick={handleRunPassAtK}
            disabled={isRunning || !selectedGoldenId}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Run Pass@K
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="bg-white border rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold mb-3">Summary</h4>
          <div className="flex gap-4">
            <div className="text-center px-4">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-green-600">{summary.passed}</p>
              <p className="text-xs text-gray-500">Passed</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
              <p className="text-xs text-gray-500">Failed</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold">{(summary.avg_score * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Avg Score</p>
            </div>
          </div>

          {/* Per-grader breakdown */}
          {summary.by_grader && Object.entries(summary.by_grader).map(([grader, stats]) => (
            <div key={grader} className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase">{grader}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${(stats.passed / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-600">
                  {stats.passed}/{stats.total} ({((stats.passed / stats.total) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {results && results.length > 0 && (
        <div className="border rounded-lg bg-white">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Grader</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Trace</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Result</th>
                  <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => (
                  <React.Fragment key={idx}>
                    <tr
                      className="border-t cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    >
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium uppercase">{result.grader_name}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-xs">
                        {result.trace_id?.substring(0, 8)}...
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {result.passed ? 'PASS' : 'FAIL'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">
                        {(result.score * 100).toFixed(0)}%
                      </td>
                    </tr>
                    {expandedIdx === idx && (
                      <tr>
                        <td colSpan="4" className="px-3 py-2 bg-gray-50">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pass@K Results */}
      {passAtKResults && (
        <div className="border rounded-lg bg-white p-4 mt-4">
          <h4 className="text-sm font-semibold mb-3">Pass@{passAtKResults.k} Results</h4>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{(passAtKResults.pass_at_k.schema * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Schema Pass@{passAtKResults.k}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{(passAtKResults.pass_at_k.intent * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Intent Pass@{passAtKResults.k}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{(passAtKResults.pass_hat_at_k.schema * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Schema Pass^@{passAtKResults.k}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{(passAtKResults.pass_hat_at_k.intent * 100).toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Intent Pass^@{passAtKResults.k}</p>
            </div>
          </div>

          {/* Per-attempt breakdown */}
          <div className="mt-3 pt-3 border-t">
            <div className="flex gap-2 flex-wrap">
              {passAtKResults.attempts.map((attempt) => (
                <div key={attempt.attempt} className="text-center px-3 py-2 bg-gray-50 rounded border">
                  <p className="text-xs text-gray-500">#{attempt.attempt}</p>
                  <div className="flex gap-1 mt-1">
                    <span className={`text-xs px-1 rounded ${attempt.schema.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>S</span>
                    <span className={`text-xs px-1 rounded ${attempt.intent.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>I</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvalRunResults;
