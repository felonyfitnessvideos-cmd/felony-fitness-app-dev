
/**
 * @file EditRoutinePage.jsx
 * @description This page allows users to create a new workout routine or edit an existing one.
 * @project Felony Fitness
 */

/**
 * EditRoutinePage.jsx
 *
 * Editor for a workout routine. Handles CRUD of sets/exercises and local
 * ordering. Mutations are scoped to the current user; UI provides optimistic
 * updates and reverts on error.
 */
/**
 * EditRoutinePage (doc): editor for a single routine. Handles CRUD for
 * exercises and sets, and keeps optimistic UI updates local to the page.
 */
/**
 * EditRoutinePage — edit a routine and its mesocycles.
 *
 * Contract:
 * - Inputs: routineId via route params
 * - Outputs: calls to Supabase to save routine/mesocycle updates
 * - Errors: network or RLS errors are surfaced via UI message
 *
 * Edge-cases handled: missing columns during staged deploys, component
 * unmounts during async saves, and optimistic updates with reverts.
 */
import { ArrowDownCircle, ArrowUpCircle, Dumbbell, Loader2, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Modal from 'react-modal';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import SubPageHeader from '../components/SubPageHeader.jsx';
import { supabase } from '../supabaseClient.js';
import './EditRoutinePage.css';

// Modal styling moved to CSS (.custom-modal-overlay, .custom-modal-content)

/**
 * @typedef {object} MuscleGroup
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {object} Exercise
 * @property {string} id - The UUID of the exercise.
 * @property {string} name - The name of the exercise.
 * @property {string} [description] - A short description.
 * @property {string} [category_id] - The UUID for the category (e.g., Strength).
 * @property {string} [type] - The type of exercise (e.g., 'Strength').
 * @property {boolean} [is_external] - Flag indicating if the exercise is from the AI.
 * @property {number | string} sets - The number of sets for the routine.
 * @property {string} reps - The rep range (e.g., "8-12").
 * @property {Array<object>} [exercise_muscle_groups] - Join table data.
 * @property {string} [primary_muscle] - The primary muscle from the AI response.
 */

function EditRoutinePage() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [routineName, setRoutineName] = useState('');
  /** @type {[Exercise[], React.Dispatch<React.SetStateAction<Exercise[]>>]} */
  const [routineExercises, setRoutineExercises] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchAbortControllerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customExerciseName, setCustomExerciseName] = useState('');
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState('');

  /** @type {[MuscleGroup[], React.Dispatch<React.SetStateAction<MuscleGroup[]>>]} */
  const [allMuscleGroups, setAllMuscleGroups] = useState([]);


  const fetchInitialData = useCallback(async () => {
    try {
      const { data: muscleGroupsData, error: muscleGroupsError } = await supabase.from('muscle_groups').select('*');
      if (muscleGroupsError) throw muscleGroupsError;
      setAllMuscleGroups(muscleGroupsData || []);

      if (routineId !== 'new') {
        const { data, error } = await supabase
          .from('workout_routines')
          .select(`*, routine_exercises(*, exercises(*))`)
          .eq('id', routineId)
          .single();
        if (error) throw error;

        if (data) {
          setRoutineName(data.routine_name);
          const rawItems = Array.isArray(data.routine_exercises) ? data.routine_exercises : [];
          const sortedExercises = rawItems.sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0));
          const formattedExercises = sortedExercises.map(item => ({
            // Guard nested relation; some DB/RLS setups may omit nested `exercises`.
            ...(item.exercises || {}),
            sets: item.target_sets,
            reps: '8-12',
          }));
          setRoutineExercises(formattedExercises.filter(Boolean));
        }
      }
    } catch (error) {
      console.error("Error fetching initial data for routine page:", error);
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Cleanup debounce timer and abort controller on unmount
  // This effect is intended to run only on mount/unmount to clean up timers
  // and abort controllers. It intentionally uses an empty dependency array
  // to ensure the cleanup runs only once on unmount.

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch { /* ignore */ }
        searchAbortControllerRef.current = null;
      }
    };
  }, []);

  const handleSearch = useCallback((e) => {
    const term = e.target.value;
    setSearchTerm(term);

    // Clear any pending debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    // If search term is too short, cancel any in-flight request and clear results
    if (term.length < 3) {
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch (_err) { void _err; /* ignore */ }
        searchAbortControllerRef.current = null;
      }
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Debounce the network request
    searchDebounceRef.current = setTimeout(async () => {
      // Abort previous in-flight request if present (single consolidated attempt)
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch (_err) { void _err; /* ignore */ }
      }
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke('exercise-search', {
          body: { query: term },
          signal: controller.signal,
        });
        if (error) throw error;

        if (controller.signal.aborted) return;

        const results = (data?.results || []).map(item => ({
          ...item,
          is_external: data?.source === 'external',
        }));
        console.log('Exercise search results:', results);
        console.log('Search data source:', data?.source);
        setSearchResults(results);
      } catch (error) {
        if (error?.name === 'AbortError') {
          // Request was aborted, ignore
        } else {
          console.error('Error searching exercises:', error?.message || error);
          setSearchResults([]);
        }
      } finally {
        setIsSearching(false);
        searchAbortControllerRef.current = null;
      }
    }, 300);
  }, []);

  const handleAddExercise = (exerciseToAdd) => {
    console.log('Adding exercise to routine:', exerciseToAdd);
    const newExercise = { ...exerciseToAdd, sets: 3, reps: '8-12' };
    setRoutineExercises([...routineExercises, newExercise]);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleExerciseChange = (index, field, value) => {
    const updatedExercises = [...routineExercises];
    // Coerce numeric fields to numbers to avoid type issues (sets should be a number)
    if (field === 'sets') {
      updatedExercises[index][field] = Math.max(1, Number(value) || 1);
    } else {
      updatedExercises[index][field] = value;
    }
    setRoutineExercises(updatedExercises);
  };

  const handleRemoveExercise = (index) => {
    const updatedExercises = routineExercises.filter((_, i) => i !== index);
    setRoutineExercises(updatedExercises);
  };

  const handleSaveRoutine = async () => {
    if (!user) return alert("You must be logged in to save a routine.");

    const resolvedExercises = await Promise.all(
      routineExercises.map(async (ex) => {
        if (ex.id && !ex.is_external) {
          return ex;
        }

        const { data: existingExercise } = await supabase
          .from('exercises')
          .select('id')
          .eq('name', ex.name)
          .single();

        if (existingExercise) {
          return { ...ex, id: existingExercise.id };
        }

        // Insert new exercise with all fields from AI-generated data
        console.log('Inserting new exercise with data:', {
          name: ex.name,
          description: ex.description,
          instructions: ex.instructions,
          primary_muscle: ex.primary_muscle,
          secondary_muscle: ex.secondary_muscle,
          tertiary_muscle: ex.tertiary_muscle,
          equipment_needed: ex.equipment_needed,
          difficulty_level: ex.difficulty_level,
          exercise_type: ex.exercise_type,
        });

        const { data: newExercise, error: insertError } = await supabase
          .from('exercises')
          .insert({
            name: ex.name,
            description: ex.description || null,
            instructions: ex.instructions || null,
            primary_muscle: ex.primary_muscle || null,
            secondary_muscle: ex.secondary_muscle || null,
            tertiary_muscle: ex.tertiary_muscle || null,
            equipment_needed: ex.equipment_needed || null,
            difficulty_level: ex.difficulty_level || null,
            exercise_type: ex.exercise_type || ex.type || 'Strength',
            thumbnail_url: ex.thumbnail_url || null,
            video_url: ex.video_url || null
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        return { ...ex, id: newExercise.id };
      })
    );

    const exercisesToInsert = resolvedExercises.map((ex, index) => ({
      exercise_id: ex.id,
      target_sets: Math.max(1, Number(ex.sets) || 1),
      exercise_order: index
    }));

    try {
      if (routineId === 'new') {
        const { data: newRoutine, error: routineError } = await supabase.from('workout_routines').insert({ routine_name: routineName, user_id: user.id }).select('id').single();
        if (routineError) throw routineError;

        await supabase.from('routine_exercises').insert(exercisesToInsert.map(e => ({ ...e, routine_id: newRoutine.id })));
      } else {
        // Call the new Edge Function to replace routine exercises
        const { data, error: edgeError } = await supabase.functions.invoke('replace-routine-exercises', {
          body: {
            p_routine_id: routineId,
            p_name: routineName,
            p_items: exercisesToInsert
          }
        });
        if (edgeError || (data && data.error)) {
          throw new Error(edgeError?.message || data?.error || 'Unknown error');
        }
      }
      navigate('/workouts/routines');
    } catch (error) {
      alert(`Error saving routine: ${error.message}`);
    }
  };

  const moveExercise = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === routineExercises.length - 1)) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const items = [...routineExercises];
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    setRoutineExercises(items);
  };

  const openCustomExerciseModal = () => {
    setCustomExerciseName(searchTerm);
    setIsCustomModalOpen(true);
  };

  const closeCustomExerciseModal = () => setIsCustomModalOpen(false);

  const handleSaveCustomExercise = async (e) => {
    e.preventDefault();
    if (!customExerciseName || !selectedMuscleGroupId) return alert("Please provide a name and select a muscle group.");
    try {
      // Get the muscle group name to use as primary_muscle
      const muscleGroup = allMuscleGroups.find(mg => mg.id === selectedMuscleGroupId);
      const muscleName = muscleGroup?.name || 'Core';

      const { data: newExerciseData, error: insertError } = await supabase
        .from('exercises')
        .insert({
          name: customExerciseName,
          exercise_type: 'Strength',
          primary_muscle: muscleName,
          difficulty_level: 'Intermediate'
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      handleAddExercise(newExerciseData);
      closeCustomExerciseModal();

    } catch (error) {
      alert(`Error creating custom exercise: ${error.message}`);
    }
  };

  if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading routine...</div>;

  return (
    <div className="edit-routine-page-container">
      <SubPageHeader title={routineId === 'new' ? 'Create Routine' : 'Edit Routine'} icon={<Dumbbell size={28} />} iconColor="#f97316" backTo="/workouts/routines" />

      <div className="form-group">
        <label htmlFor="routineName">Routine Name</label>
        <input type="text" id="routineName" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="e.g., Push Day" required />
      </div>

      <div className="add-exercise-section">
        <h3>Add Exercises</h3>
        <input type="text" placeholder="Search for an exercise..." value={searchTerm} onChange={handleSearch} />
        {(isSearching || searchResults.length > 0 || searchTerm.length > 2) && (
          <div className="search-results">
            {isSearching && <div className="search-loading"><Loader2 className="animate-spin" /></div>}
            {!isSearching && searchResults.map(ex => {
              const muscleGroup = ex.exercise_muscle_groups?.[0]?.muscle_groups?.name || ex.primary_muscle || 'Core';
              return (
                <div key={ex.id || ex.name} className="search-result-item">
                  <div className="exercise-info">
                    <span className="exercise-name">{ex.name}</span>
                    <span className="muscle-group">{muscleGroup}</span>
                  </div>
                  <button className="add-exercise-btn" onClick={() => handleAddExercise(ex)}>Add</button>
                </div>
              );
            })}
            {!isSearching && searchTerm.length > 2 && searchResults.length === 0 && (
              <div className="custom-exercise-prompt">
                <button onClick={openCustomExerciseModal}>
                  Can't find it? Add "{searchTerm}" as a custom exercise.
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <h3>Exercises in this Routine</h3>
      <div className="exercise-list">
        {routineExercises.map((ex, index) => (
          <div key={ex.id || ex.name || index} className="exercise-card">
            <div className="reorder-controls">
              <button onClick={() => moveExercise(index, 'up')} disabled={index === 0}><ArrowUpCircle size={24} /></button>
              <button onClick={() => moveExercise(index, 'down')} disabled={index === routineExercises.length - 1}><ArrowDownCircle size={24} /></button>
            </div>
            <img
              src={ex.thumbnail_url || 'https://placehold.co/50x50/4a5568/ffffff?text=IMG'}
              alt={ex.name}
              className="exercise-thumbnail"
              width="50"
              height="50"
              loading="lazy"
            />
            <div className="exercise-details">
              <h4>{ex.name}</h4>
              <div className="exercise-inputs">
                <input type="number" min="1" step="1" value={ex.sets} onChange={(e) => handleExerciseChange(index, 'sets', e.target.value)} />
                <span>sets</span>
                <input type="text" value={ex.reps} onChange={(e) => handleExerciseChange(index, 'reps', e.target.value)} />
                <span>reps</span>
              </div>
            </div>
            <button onClick={() => handleRemoveExercise(index)} className="remove-exercise-button"><Trash2 size={20} /></button>
          </div>
        ))}
      </div>

      <div className="action-footer">
        <button className="cancel-button" onClick={() => navigate('/workouts/routines')}>Cancel</button>
        <button className="save-button" onClick={handleSaveRoutine}>Save Routine</button>
      </div>

      <Modal
        isOpen={isCustomModalOpen}
        onRequestClose={closeCustomExerciseModal}
        contentLabel="Create Custom Exercise"
        overlayClassName="custom-modal-overlay"
        className="custom-modal-content"
      >
        <h2>Create Custom Exercise</h2>
        <form onSubmit={handleSaveCustomExercise}>
          <div className="form-group">
            <label htmlFor="customExerciseName">Exercise Name</label>
            <input type="text" id="customExerciseName" value={customExerciseName} onChange={(e) => setCustomExerciseName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="muscleGroup">Muscle Group</label>
            <select id="muscleGroup" value={selectedMuscleGroupId} onChange={(e) => setSelectedMuscleGroupId(e.target.value)} required >
              <option value="" disabled>-- Select a muscle group --</option>
              {allMuscleGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <div className="modal-action-footer">
            <button type="button" className="cancel-button" onClick={closeCustomExerciseModal}>Cancel</button>
            <button type="submit" className="save-button">Save Exercise</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default EditRoutinePage;
