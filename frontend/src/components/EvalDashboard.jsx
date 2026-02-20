import React, { useState, useEffect } from 'react';
import { RefreshCw, Activity, Database, FlaskConical } from 'lucide-react';
import { getTraces, getGoldens, promoteTraceToGolden } from '../utils/evalApi';
import TraceViewer from './TraceViewer';
import GoldenDatasetManager from './GoldenDatasetManager';
import EvalRunResults from './EvalRunResults';

const EvalDashboard = () => {
  const [activeSection, setActiveSection] = useState('traces');
  const [traces, setTraces] = useState([]);
  const [tracesTotal, setTracesTotal] = useState(0);
  const [goldens, setGoldens] = useState([]);
  const [goldensTotal, setGoldensTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTraces = async () => {
    setLoading(true);
    try {
      const data = await getTraces(100);
      setTraces(data.traces);
      setTracesTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch traces:', err);
    }
    setLoading(false);
  };

  const fetchGoldens = async () => {
    try {
      const data = await getGoldens();
      setGoldens(data.goldens);
      setGoldensTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch goldens:', err);
    }
  };

  const refreshAll = () => {
    fetchTraces();
    fetchGoldens();
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handlePromoteToGolden = async (traceId) => {
    try {
      await promoteTraceToGolden(traceId);
      fetchGoldens();
    } catch (err) {
      console.error('Promote error:', err);
    }
  };

  const sections = [
    { id: 'traces', label: 'Traces', icon: Activity },
    { id: 'goldens', label: 'Goldens', icon: Database },
    { id: 'eval', label: 'Run Eval', icon: FlaskConical },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Activity className="w-4 h-4 text-gray-500" />
          <span className="font-medium">{tracesTotal}</span>
          <span className="text-gray-500">traces</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Database className="w-4 h-4 text-gray-500" />
          <span className="font-medium">{goldensTotal}</span>
          <span className="text-gray-500">goldens</span>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading}
          className="ml-auto p-1.5 hover:bg-gray-200 rounded text-gray-500"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Section tabs */}
      <div className="px-4 pt-3 border-b flex gap-1">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            className={`px-4 py-2 text-xs font-medium rounded-t border border-b-0 flex items-center gap-1.5 ${
              activeSection === id
                ? 'bg-white text-emerald-700 border-gray-300'
                : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeSection === 'traces' && (
          <TraceViewer
            traces={traces}
            onRefresh={refreshAll}
            onPromoteToGolden={handlePromoteToGolden}
          />
        )}
        {activeSection === 'goldens' && (
          <GoldenDatasetManager
            goldens={goldens}
            onRefresh={refreshAll}
          />
        )}
        {activeSection === 'eval' && (
          <EvalRunResults goldens={goldens} />
        )}
      </div>
    </div>
  );
};

export default EvalDashboard;
