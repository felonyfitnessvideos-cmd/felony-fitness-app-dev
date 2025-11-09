/**
 * @file ProgramEditorModal.jsx
 * @description Modal for editing program details and exercise pool
 * @project Felony Fitness - Trainer Programs
 */

import { Save, Search, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import './ProgramEditorModal.css';

/**
 * Program Editor Modal Component
 * Allows trainers to edit program details and manage exercise pool
 */
const ProgramEditorModal = ({ program, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    difficulty_level: 'beginner',
    program_type: 'strength',
    estimated_weeks: 8,
    exercise_pool: []
  });
  
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [availableExercises, setAvailableExercises] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize form with program data
  useEffect(() => {
    if (program) {
      setFormData({
        name: program.name || '',
        description: program.description || '',
        difficulty_level: program.difficulty_level || 'beginner',
        program_type: program.program_type || 'strength',
        estimated_weeks: program.estimated_weeks || 8,
        exercise_pool: program.exercise_pool || []
      });
    }
  }, [program]);

  /**
   * Search for exercises in the database
   */
  const searchExercises = async (query) => {
    if (!query || query.length < 2) {
      setAvailableExercises([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, primary_muscle, secondary_muscle, difficulty_level')
        .ilike('name', `%${query}%`)
        .limit(20);

      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (err) {
      console.error('Error searching exercises:', err);
    } finally {
      setSearching(false);
    }
  };

  /**
   * Add exercise to pool
   */
  const addExerciseToPool = (exercise) => {
    // Check if already in pool
    const alreadyExists = formData.exercise_pool.some(
      ex => ex.exercise_id === exercise.id
    );

    if (alreadyExists) {
      alert('Exercise already in pool');
      return;
    }

    const newExercise = {
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: 3,
      reps: '10-12',
      rest_seconds: 90,
      notes: '',
      muscle_groups: {
        primary: exercise.primary_muscle ? [exercise.primary_muscle] : [],
        secondary: exercise.secondary_muscle ? [exercise.secondary_muscle] : [],
        tertiary: []
      }
    };

    setFormData(prev => ({
      ...prev,
      exercise_pool: [...prev.exercise_pool, newExercise]
    }));

    setExerciseSearch('');
    setAvailableExercises([]);
  };

  /**
   * Remove exercise from pool
   */
  const removeExercise = (index) => {
    setFormData(prev => ({
      ...prev,
      exercise_pool: prev.exercise_pool.filter((_, i) => i !== index)
    }));
  };

  /**
   * Update exercise in pool
   */
  const updateExercise = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      exercise_pool: prev.exercise_pool.map((ex, i) => 
        i === index ? { ...ex, [field]: value } : ex
      )
    }));
  };

  /**
   * Handle form field changes
   */
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Save program changes
   */
  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Program name is required');
      return;
    }

    if (formData.exercise_pool.length === 0) {
      alert('Add at least one exercise to the pool');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('programs')
        .update({
          name: formData.name,
          description: formData.description,
          difficulty_level: formData.difficulty_level,
          program_type: formData.program_type,
          estimated_weeks: formData.estimated_weeks,
          exercise_pool: formData.exercise_pool,
          updated_at: new Date().toISOString()
        })
        .eq('id', program.id)
        .select()
        .single();

      if (error) throw error;

      onSave(data);
      onClose();
    } catch (err) {
      console.error('Error saving program:', err);
      alert('Failed to save program. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="program-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Edit Program</h2>
        </div>

        {/* Content */}
        <div className="modal-body">
          {/* Basic Info */}
          <div className="form-section">
            <h3>Basic Information</h3>
            
            <div className="form-group">
              <label>Program Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g., Beginner Strength Foundation"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="Describe the program goals and target audience..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Difficulty Level</label>
                <select
                  value={formData.difficulty_level}
                  onChange={(e) => handleFieldChange('difficulty_level', e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="form-group">
                <label>Program Type</label>
                <select
                  value={formData.program_type}
                  onChange={(e) => handleFieldChange('program_type', e.target.value)}
                >
                  <option value="strength">Strength</option>
                  <option value="hypertrophy">Hypertrophy</option>
                  <option value="powerlifting">Powerlifting</option>
                  <option value="general">General Fitness</option>
                </select>
              </div>

              <div className="form-group">
                <label>Estimated Duration (weeks)</label>
                <input
                  type="number"
                  value={formData.estimated_weeks}
                  onChange={(e) => handleFieldChange('estimated_weeks', parseInt(e.target.value))}
                  min="1"
                  max="52"
                />
              </div>
            </div>
          </div>

          {/* Exercise Pool */}
          <div className="form-section">
            <h3>Exercise Pool ({formData.exercise_pool.length})</h3>
            
            {/* Exercise Search */}
            <div className="exercise-search">
              <div className="search-input-wrapper">
                <Search size={18} />
                <input
                  type="text"
                  value={exerciseSearch}
                  onChange={(e) => {
                    setExerciseSearch(e.target.value);
                    searchExercises(e.target.value);
                  }}
                  placeholder="Search exercises to add..."
                />
              </div>
              
              {searching && exerciseSearch.length >= 2 && (
                <div className="exercise-search-results">
                  <div className="exercise-result-item">
                    <div className="exercise-result-name">Searching...</div>
                  </div>
                </div>
              )}
              
              {!searching && availableExercises.length > 0 && (
                <div className="exercise-search-results">
                  {availableExercises.map(exercise => (
                    <div
                      key={exercise.id}
                      className="exercise-result-item"
                      onClick={() => addExerciseToPool(exercise)}
                    >
                      <div className="exercise-result-name">{exercise.name}</div>
                      <div className="exercise-result-muscle">{exercise.primary_muscle}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exercise List */}
            <div className="exercise-pool-list">
              {formData.exercise_pool.map((exercise, index) => (
                <div key={index} className="exercise-pool-item">
                  <div className="exercise-pool-name">
                    {exercise.exercise_name}
                  </div>
                  <div className="exercise-pool-controls">
                    <input
                      type="number"
                      value={exercise.sets}
                      onChange={(e) => updateExercise(index, 'sets', parseInt(e.target.value))}
                      min="1"
                      max="10"
                      className="small-input"
                    />
                    <span>×</span>
                    <input
                      type="text"
                      value={exercise.reps}
                      onChange={(e) => updateExercise(index, 'reps', e.target.value)}
                      placeholder="8-12"
                      className="small-input"
                    />
                    <span>@</span>
                    <input
                      type="number"
                      value={exercise.rest_seconds}
                      onChange={(e) => updateExercise(index, 'rest_seconds', parseInt(e.target.value))}
                      min="30"
                      max="300"
                      step="15"
                      className="small-input"
                    />
                    <span>s</span>
                    <button
                      className="remove-exercise-btn"
                      onClick={() => removeExercise(index)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSave}
            disabled={saving}
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

ProgramEditorModal.propTypes = {
  program: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired
};

export default ProgramEditorModal;
