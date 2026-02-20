import React, { useState } from 'react';
import { annotateTrace } from '../utils/evalApi';

const AnnotationPanel = ({ traceId, annotations, onRefresh }) => {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAnnotate = async (verdict) => {
    setSaving(true);
    try {
      await annotateTrace(traceId, verdict, notes);
      setNotes('');
      onRefresh();
    } catch (err) {
      console.error('Annotation error:', err);
    }
    setSaving(false);
  };

  const verdictColors = {
    correct: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    incorrect: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Annotations</h4>

      {/* Existing annotations */}
      {annotations.length > 0 && (
        <div className="space-y-1 mb-3">
          {annotations.map((ann, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded font-medium ${verdictColors[ann.verdict] || 'bg-gray-100'}`}>
                {ann.verdict}
              </span>
              {ann.notes && <span className="text-gray-600">{ann.notes}</span>}
              <span className="text-gray-400 ml-auto">{new Date(ann.timestamp).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* New annotation */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)..."
          className="flex-1 px-2 py-1 border rounded text-xs"
        />
        <button
          onClick={() => handleAnnotate('correct')}
          disabled={saving}
          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50"
        >
          Correct
        </button>
        <button
          onClick={() => handleAnnotate('partial')}
          disabled={saving}
          className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200 disabled:opacity-50"
        >
          Partial
        </button>
        <button
          onClick={() => handleAnnotate('incorrect')}
          disabled={saving}
          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
        >
          Incorrect
        </button>
      </div>
    </div>
  );
};

export default AnnotationPanel;
