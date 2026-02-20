import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Sparkles, X, Check } from 'lucide-react';
import { createGolden, deleteGolden, updateGolden, generateSyntheticGoldens } from '../utils/evalApi';

const GoldenDatasetManager = ({ goldens, onRefresh }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [syntheticCount, setSyntheticCount] = useState(5);
  const [syntheticResults, setSyntheticResults] = useState(null);

  // Form state
  const [formMessage, setFormMessage] = useState('');
  const [formWorkflow, setFormWorkflow] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const resetForm = () => {
    setFormMessage('');
    setFormWorkflow('');
    setFormTags('');
    setFormNotes('');
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    try {
      const workflow = JSON.parse(formWorkflow);
      await createGolden({
        user_message: formMessage,
        expected_workflow: workflow,
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        notes: formNotes,
      });
      resetForm();
      onRefresh();
    } catch (err) {
      alert('Invalid JSON in expected workflow: ' + err.message);
    }
  };

  const handleUpdate = async (id) => {
    try {
      const updates = {
        user_message: formMessage,
        expected_workflow: JSON.parse(formWorkflow),
        tags: formTags.split(',').map(t => t.trim()).filter(Boolean),
        notes: formNotes,
      };
      await updateGolden(id, updates);
      resetForm();
      onRefresh();
    } catch (err) {
      alert('Invalid JSON: ' + err.message);
    }
  };

  const handleEdit = (golden) => {
    setEditingId(golden.id);
    setFormMessage(golden.user_message);
    setFormWorkflow(JSON.stringify(golden.expected_workflow, null, 2));
    setFormTags(golden.tags.join(', '));
    setFormNotes(golden.notes || '');
  };

  const handleDelete = async (id) => {
    await deleteGolden(id);
    onRefresh();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setSyntheticResults(null);
    try {
      const result = await generateSyntheticGoldens(syntheticCount);
      setSyntheticResults(result.generated);
    } catch (err) {
      console.error('Generate error:', err);
    }
    setGenerating(false);
  };

  const handleSaveSynthetic = async (example) => {
    try {
      await createGolden({
        user_message: example.user_message,
        expected_workflow: example.expected_workflow,
        tags: example.tags || [],
        notes: 'Generated synthetically',
      });
      setSyntheticResults(prev => prev.filter(e => e !== example));
      onRefresh();
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  return (
    <div>
      {/* Header actions */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add Golden
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <input
            type="number"
            value={syntheticCount}
            onChange={(e) => setSyntheticCount(Number(e.target.value))}
            min={1}
            max={20}
            className="w-16 px-2 py-1 border rounded text-xs"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50"
          >
            <Sparkles className="w-3 h-3" />
            {generating ? 'Generating...' : 'Generate Synthetic'}
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <div className="border rounded-lg p-4 mb-4 bg-gray-50">
          <h4 className="text-sm font-semibold mb-3">{editingId ? 'Edit Golden' : 'New Golden Example'}</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">User Message</label>
              <input
                type="text"
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="e.g., Send a Slack message every morning"
                className="w-full px-3 py-2 border rounded text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Expected Workflow (JSON)</label>
              <textarea
                value={formWorkflow}
                onChange={(e) => setFormWorkflow(e.target.value)}
                placeholder='{"name": "...", "trigger": {...}, "steps": [...]}'
                rows={8}
                className="w-full px-3 py-2 border rounded text-xs font-mono mt-1"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="simple, email, schedule"
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-gray-600">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Why this is the expected output"
                  className="w-full px-3 py-2 border rounded text-sm mt-1"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => editingId ? handleUpdate(editingId) : handleCreate()}
                className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synthetic results */}
      {syntheticResults && syntheticResults.length > 0 && (
        <div className="border rounded-lg p-4 mb-4 bg-purple-50">
          <h4 className="text-sm font-semibold mb-3">Generated Examples (review and save)</h4>
          <div className="space-y-3">
            {syntheticResults.map((example, idx) => (
              <div key={idx} className="bg-white p-3 rounded border flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{example.user_message}</p>
                  <div className="flex gap-1 mt-1">
                    {(example.tags || []).map(tag => (
                      <span key={tag} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleSaveSynthetic(example)}
                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={() => setSyntheticResults(prev => prev.filter((_, i) => i !== idx))}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goldens table */}
      {goldens.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No golden examples yet. Add some to start evaluating.</p>
      ) : (
        <div className="space-y-2">
          {goldens.map((golden) => (
            <div key={golden.id} className="border rounded-lg bg-white p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">{golden.user_message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {golden.expected_workflow?.steps?.length || 0} steps
                    </span>
                    <span className="text-xs text-gray-500">
                      {golden.expected_workflow?.trigger?.type}
                    </span>
                    {golden.tags?.map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                  {golden.notes && (
                    <p className="text-xs text-gray-500 mt-1 italic">{golden.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(golden)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(golden.id)}
                  className="p-1 hover:bg-red-50 rounded text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GoldenDatasetManager;
