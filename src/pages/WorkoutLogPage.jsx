/**
 * WorkoutLogPage (doc): active workout logger for a selected routine.
 * Coordinates creating/editing `workout_logs` and manages entries for exercises.
 */
/**
 * @file WorkoutLogPage.jsx
 * @description The main page for actively logging a workout session based on a selected routine.
 * @project Felony Fitness
 */

import { Check, Dumbbell, Edit2, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import LazyRecharts from '../components/LazyRecharts.jsx';
import RestTimerModal from '../components/RestTimerModal.jsx';
import SubPageHeader from '../components/SubPageHeader.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { supabase } from '../supabaseClient.js';
import './WorkoutLogPage.css';

// --- 1. MODIFIED HELPER FUNCTION ---
/**
 * Converts a set number to a display string.
 * @param {number} num - The number of sets.
 * @returns {string} - The number as a string with "Sets".
 */
const formatSetCount = (num) => {
  if (num > 0) {
    return `${num} Sets`; // Changed from word to number
  }
  return ''; // Don't show anything if 0 or null/undefined
};

/**
 * @typedef {object} SetEntry
 * @property {string} id
 * @property {number} set_number
 * @property {number} reps_completed
 * @property {number} weight_lbs - Weight in pounds
 * @property {string} exercise_id
 */

/** @typedef {{[exerciseId: string]: SetEntry[]}} LogMap */

/**
 * @typedef {object} ChartDataPoint
 * @property {string} date
 * @property {number} value
 */

/**
 * Render the workout logging page for a selected routine and coordinate creating, updating, and finishing workout logs and their entries.
 *
 * Manages loading the routine, fetching previous and today's entries, creating or resuming a workout_log for the selected day, saving/editing/deleting sets via secure RPCs, fetching chart data for exercises, and finishing a workout (including duration and calorie calculation). Intentionally tolerant of missing DB migrations for optional columns used to link cycle sessions; logs and alerts surface only on critical failures.
 * @returns {JSX.Element} The WorkoutLogPage React component UI.
 */

function WorkoutLogPage() {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id;

  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [workoutLogId, setWorkoutLogId] = useState(null);
  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState({ weight: '', reps: '' });
  /** @type {[LogMap, React.Dispatch<React.SetStateAction<LogMap>>]} */
  const [todaysLog, setTodaysLog] = useState({});
  /** @type {[LogMap, React.Dispatch<React.SetStateAction<LogMap>>]} */
  const [previousLog, setPreviousLog] = useState({});
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [activeView, setActiveView] = useState('log');
  /** @type {[ChartDataPoint[], React.Dispatch<React.SetStateAction<ChartDataPoint[]>>]} */
  const [chartData, setChartData] = useState([]);
  const [chartMetric, setChartMetric] = useState('1RM');
  const [editingSet, setEditingSet] = useState(null);
  const [editSetValue, setEditSetValue] = useState({ weight: '', reps: '' });
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [shouldAdvance, setShouldAdvance] = useState(false);
  const [userWeightLbs, setUserWeightLbs] = useState(150);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [isWorkoutCompletable, setIsWorkoutCompletable] = useState(false);
  const [saveSetLoading, setSaveSetLoading] = useState(false);
  const [rpcLoading, setRpcLoading] = useState(false);
  const isMountedRef = useRef(true);

  // Get the whole routine_exercise object (which includes target_sets and exercises)
  const selectedRoutineExercise = useMemo(() => routine?.routine_exercises[selectedExerciseIndex], [routine, selectedExerciseIndex]);

  // Get the nested exercise details from the object above
  const selectedExercise = useMemo(() => selectedRoutineExercise?.exercises, [selectedRoutineExercise]);

  // Get the target sets number from the object above
  const targetSets = useMemo(() => selectedRoutineExercise?.target_sets, [selectedRoutineExercise]);
  // Adjust target sets according to deload multiplier when a mesocycle session is active
  const adjustedTargetSets = useMemo(() => {
    const base = Number(targetSets) || 0;
    const mult = sessionMeta?.planned_volume_multiplier ?? 1;
    if (!base) return 0;
    return Math.max(1, Math.round(base * mult));
  }, [targetSets, sessionMeta?.planned_volume_multiplier]);

  useEffect(() => {
    // track mounted state to avoid calling setState on an unmounted component
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Ensure the current selected exercise resets currentSet when logs change
  useEffect(() => {
    if (!selectedExercise) return;

    const todaysSets = todaysLog[selectedExercise.id] || [];
    const previousSets = previousLog[selectedExercise.id] || [];
    let lastSet = null;

    if (todaysSets.length > 0) {
      lastSet = todaysSets[todaysSets.length - 1];
    } else if (previousSets.length > 0) {
      lastSet = previousSets[previousSets.length - 1];
    }

    if (lastSet) {
      setCurrentSet({ weight: lastSet.weight_lbs, reps: lastSet.reps_completed });
    } else {
      setCurrentSet({ weight: '', reps: '' });
    }
  }, [selectedExercise, todaysLog, previousLog]);

  // The fetchAndStartWorkout callback intentionally omits dependencies so it
  // remains stable across renders. This reduces the chance of duplicate
  // network requests triggered by unrelated re-renders. If you need to
  // capture changing external values, add them to the dependency array and
  // update this rationale accordingly.

  const location = useLocation();

  const fetchAndStartWorkout = useCallback(async (userId, opts = {}) => {
    setLoading(true);
    try {
      // If a mesocycle_session_id was provided in the URL, prefer the
      // scheduled_date and routine referenced by that session to load the
      // appropriate day's log for editing.
      let currentRoutineId = routineId;
      let scheduledDateFromSession = null;
      if (opts.mesocycleSessionId) {
        const { data: sess, error: sessErr } = await supabase.from('cycle_sessions').select('scheduled_date,routine_id,is_deload,planned_volume_multiplier').eq('id', opts.mesocycleSessionId).maybeSingle();
        if (sessErr) console.warn('Could not load mesocycle session', sessErr);
        if (sess) {
          scheduledDateFromSession = sess.scheduled_date;
          if (sess.routine_id) currentRoutineId = sess.routine_id;
          // capture deload metadata for UI adjustments
          setSessionMeta({ is_deload: !!sess.is_deload, planned_volume_multiplier: Number(sess.planned_volume_multiplier || 1) });
        }
      }

      /**
       * Step 1: Fetch the routine details first, ensuring exercises are correctly ordered.
       * 
       * SCHEMA CHANGE (2025-11-06): Removed muscle_groups table join. The exercises table
       * now stores muscle information directly in string fields (primary_muscle, 
       * secondary_muscle, tertiary_muscle) instead of using foreign key relationships.
       * This simplifies the query and removes dependency on deprecated muscle_groups table.
       * 
       * Query structure:
       * - workout_routines (routine metadata)
       *   -> routine_exercises (target sets, order)
       *     -> exercises (all exercise details including muscle fields)
       */
      const { data: routineData, error: routineError } = await supabase
        .from('workout_routines')
        .select(`*, routine_exercises(target_sets, exercise_order, exercises(*))`)
        .eq('id', currentRoutineId)
        .order('exercise_order', { foreignTable: 'routine_exercises', ascending: true })
        .single();

      if (routineError) throw routineError;
      // Some DB setups / RLS may prevent nested routine_exercises from returning.
      // If routine_exercises is missing or empty, fetch them explicitly as a fallback.
      if (!routineData) throw new Error('Routine not found');
      console.debug('WorkoutLogPage: fetched routineData', routineData);
      if (!routineData.routine_exercises || routineData.routine_exercises.length === 0) {
        try {
          /**
           * Fallback query when nested join doesn't work due to RLS or DB configuration.
           * Updated to match schema changes - no muscle_groups join required.
           */
          const { data: reData, error: reErr } = await supabase
            .from('routine_exercises')
            .select('*, exercises(*)')
            .eq('routine_id', currentRoutineId)
            .order('exercise_order', { ascending: true });
          console.debug('WorkoutLogPage: fallback routine_exercises result', { reData, reErr });
          if (!reErr && reData) {
            routineData.routine_exercises = reData;
          } else if (reErr) {
            console.warn('Could not load routine_exercises fallback:', reErr);
          }
        } catch (err) {
          console.warn('Fallback fetch for routine_exercises failed:', err?.message ?? err);
        }
      }
      setRoutine(routineData);

      // Step 2: Fetch the "Last Time" data using the routineId BEFORE creating today's log.
      if (routineData?.routine_exercises) {
        console.log("Fetching 'Last Time' data for routine:", routineId);
        const prevLogPromises = routineData.routine_exercises.map(item => {
          const params = {
            user_id: userId,
            exercise_id: item.exercises.id,
            routine_id: routineId
          };
          console.log(`Calling Edge Function 'get-last-session-entries' with params:`, params);
          return supabase.functions.invoke('get-last-session-entries', { body: params });
        });

        const prevLogResults = await Promise.all(prevLogPromises);

        console.log("Results from Edge Function calls:", prevLogResults);

        const prevLogMap = {};
        prevLogResults.forEach((res, index) => {
          if (res.error) {
            console.error(`Error fetching last session for exercise ${routineData.routine_exercises[index].exercises.id}:`, res.error);
          }
          const exerciseId = routineData.routine_exercises[index].exercises.id;
          prevLogMap[exerciseId] = res.data?.entries || [];
        });
        setPreviousLog(prevLogMap);
      }

      // Step 3: Determine the day range we want to open/create a log for.
      // If a mesocycle session was specified, use its scheduled_date; otherwise use today.
      let targetDate = scheduledDateFromSession || (new URLSearchParams(location.search).get('date')) || null;
      let startOfDay = new Date();
      if (targetDate) {
        // Normalize string date to midnight
        const parts = (targetDate || '').toString().split('-').map((p) => Number(p));
        if (parts.length >= 3) startOfDay = new Date(parts[0], parts[1] - 1, parts[2]);
        else startOfDay = new Date(targetDate);
      }
      startOfDay.setHours(0, 0, 0, 0);
      const startOfTomorrow = new Date(startOfDay);
      startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

      const { data: todaysLogsData, error: todaysLogsError } = await supabase
        .from('workout_logs')
        .select('id, is_complete, created_at, workout_log_entries(*)')
        .eq('user_id', userId)
        .eq('routine_id', currentRoutineId)
        .gte('created_at', startOfDay.toISOString())
        .lt('created_at', startOfTomorrow.toISOString());

      if (todaysLogsError) throw todaysLogsError;

      const todaysEntriesMap = {};
      let activeLog = todaysLogsData.find(log => !log.is_complete);

      todaysLogsData.forEach(log => {
        log.workout_log_entries.sort((a, b) => a.set_number - b.set_number);
        log.workout_log_entries.forEach(entry => {
          if (!todaysEntriesMap[entry.exercise_id]) todaysEntriesMap[entry.exercise_id] = [];
          todaysEntriesMap[entry.exercise_id].push(entry);
        });
      });
      setTodaysLog(todaysEntriesMap);

      let currentLogId;
      if (activeLog) {
        currentLogId = activeLog.id;
      } else {
        // Create a new log for that scheduled day. We set created_at to the
        // scheduled date so this log is associated with the mesocycle session.
        const payload = {
          user_id: userId,
          routine_id: currentRoutineId,
          is_complete: false,
          // NOTE: Do NOT set `created_at` to the scheduled day's midnight. That
          // was causing incorrect duration calculations because the workout's
          // real start time (now) would be compared against a midnight timestamp
          // resulting in multi-hour durations. Let the DB set `created_at` to
          // the current timestamp (or omit it) and link to the scheduled
          // session via `cycle_session_id` when available.
        };
        // Try to see if there's a cycle_session for this user/routine/date so we can link the log
        const { data: matchingSession } = await supabase.from('cycle_sessions').select('id,mesocycle_id').eq('user_id', userId).eq('routine_id', currentRoutineId).eq('scheduled_date', startOfDay.toISOString().slice(0, 10)).maybeSingle();
        if (matchingSession && matchingSession.id) payload.cycle_session_id = matchingSession.id;

        // Avoid selecting 'cycle_session_id' here in case the DB migration hasn't been applied yet.
        // We'll attach the session id separately if needed.
        const { data: newLog, error: newLogError } = await supabase.from('workout_logs').insert(payload).select('id').single();
        if (newLogError) throw newLogError;
        currentLogId = newLog.id;
        // if we linked a session, expose session meta so finish handler can use it
        if (matchingSession && matchingSession.id) {
          setSessionMeta(prev => ({ ...(prev || {}), id: matchingSession.id, mesocycle_id: matchingSession.mesocycle_id }));
        }
      }
      setWorkoutLogId(currentLogId);

      // If we found an existing active log but it didn't have cycle_session_id set,
      // attempt to attach it so later finish updates can find the session.
      if (activeLog && currentLogId) {
        try {
          const { data: existingLog } = await supabase.from('workout_logs').select('id,cycle_session_id').eq('id', currentLogId).maybeSingle();
          if (existingLog && !existingLog.cycle_session_id) {
            const { data: matchingSession2 } = await supabase.from('cycle_sessions').select('id,mesocycle_id').eq('user_id', userId).eq('routine_id', currentRoutineId).eq('scheduled_date', startOfDay.toISOString().slice(0, 10)).maybeSingle();
            if (matchingSession2 && matchingSession2.id) {
              // wrap update in try/catch in case the column doesn't exist on the DB yet
              try {
                // Ensure we only update rows owned by the current user
                if (userId) {
                  await supabase.from('workout_logs').update({ cycle_session_id: matchingSession2.id }).eq('id', currentLogId).eq('user_id', userId);
                }
                setSessionMeta(prev => ({ ...(prev || {}), id: matchingSession2.id, mesocycle_id: matchingSession2.mesocycle_id }));
              } catch (err) {
                // ignore missing column errors (42703) and continue
                if (err?.code && err.code !== '42703') console.warn('Failed to attach cycle_session_id to existing log:', err);
              }
            }
          }
        } catch (err) {
          // If selecting cycle_session_id or querying cycle_sessions fails because migrations aren't applied,
          // just ignore and continue — the UI can still log sets and finish the workout.
          if (err?.code && err.code !== '42703') console.warn('Could not check/attach existing log session:', err);
        }
      }

      // Fetch user's weight for calorie calculation
      const { data: metricsData } = await supabase.from('body_metrics').select('weight_lbs').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single();
      if (metricsData) setUserWeightLbs(metricsData.weight_lbs);

      // If no explicit session meta set, clear it
      if (!opts.mesocycleSessionId) setSessionMeta(null);

    } catch (error) {
      console.error("A critical error occurred while fetching workout data:", error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [routineId, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mesocycleSessionId = params.get('mesocycle_session_id');
    if (userId) {
      fetchAndStartWorkout(userId, { mesocycleSessionId });
    } else {
      setLoading(false);
    }
  }, [userId, routineId, fetchAndStartWorkout, location.search]);

  const fetchChartDataForExercise = useCallback(async (metric, exerciseId) => {
    if (!userId || !exerciseId) return;
    setChartLoading(true);
    let metricType = '';
    switch (metric) {
      case 'Weight Volume': metricType = 'weight_volume'; break;
      case 'Set Volume': metricType = 'set_volume'; break;
      case '1RM': default: metricType = '1rm'; break;
    }

    try {
      const { data, error } = await supabase.functions.invoke('exercise-chart-data', {
        body: {
          metric: metricType,
          user_id: userId,
          exercise_id: exerciseId,
          limit: 30
        }
      });
      if (error) throw error;

      const formattedData = data.data.map(item => ({
        date: new Date(item.log_date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }),
        value: item.value,
      }));

      setChartData(formattedData);
    } catch (error) {
      console.error(`Error fetching ${metric} data:`, error);
      setChartData([]);
    } finally {
      setChartLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeView === 'chart' && selectedExercise) {
      fetchChartDataForExercise(chartMetric, selectedExercise.id);
    }
  }, [activeView, chartMetric, selectedExercise, fetchChartDataForExercise]);

  const handleSaveSet = async () => {
    if (!currentSet.reps || !currentSet.weight || !workoutLogId || !selectedExercise) return;
    if (saveSetLoading) return; // prevent double submits
    setSaveSetLoading(true);
    const newSetPayload = {
      log_id: workoutLogId,
      exercise_id: selectedExercise.id,
      set_number: (todaysLog[selectedExercise.id]?.length || 0) + 1,
      reps_completed: parseInt(currentSet.reps, 10),
      weight_lbs: parseInt(currentSet.weight, 10), // Using weight_lbs (compatibility field) for pounds
    };
    const { data: newEntry, error } = await supabase.from('workout_log_entries').insert(newSetPayload).select().single();
    if (error) {
      alert("Could not save set. Please try again." + (error?.message ? ` (${error.message})` : ''));
      setSaveSetLoading(false);
      return;
    }

    const newTodaysLog = { ...todaysLog, [selectedExercise.id]: [...(todaysLog[selectedExercise.id] || []), newEntry] };
    setTodaysLog(newTodaysLog);

    const targetSets = routine.routine_exercises[selectedExerciseIndex]?.target_sets;
    const completedSets = newTodaysLog[selectedExercise.id].length;
    const adjusted = Math.max(1, Math.round((Number(targetSets) || 0) * (sessionMeta?.planned_volume_multiplier ?? 1)));
    const isLastExercise = selectedExerciseIndex === routine.routine_exercises.length - 1;

    if (adjusted && completedSets >= adjusted) {
      if (isLastExercise) {
        setIsWorkoutCompletable(true);
      } else {
        setShouldAdvance(true);
      }
    }

    setIsTimerOpen(true);
    setSaveSetLoading(false);
  };

  const handleTimerClose = () => {
    setIsTimerOpen(false);
    if (shouldAdvance) {
      if (selectedExerciseIndex < routine.routine_exercises.length - 1) {
        setSelectedExerciseIndex(prevIndex => prevIndex + 1);
      }
      setShouldAdvance(false);
    }
  };

  const handleFinishWorkout = async () => {
    if (!workoutLogId) return;
    setIsTimerOpen(false);

    try {
      const { data: logData, error: fetchError } = await supabase.from('workout_logs').select('created_at').eq('id', workoutLogId).single();
      if (fetchError) throw fetchError;

      const startTime = new Date(logData.created_at);
      const endTime = new Date();
      const duration_minutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      const MET_VALUE = 5.0; // General MET value for weightlifting
      const weight_kg = userWeightLbs * 0.453592;
      const duration_hours = duration_minutes / 60;
      const calories_burned = Math.round(MET_VALUE * weight_kg * duration_hours);

      const updatePayload = {
        is_complete: true,
        duration_minutes,
        ended_at: endTime.toISOString(),
        notes: routine.routine_name,
        calories_burned
      };

      // Ensure the update is scoped to the current user for safety.
      const { error: updateError } = await supabase.from('workout_logs').update(updatePayload).eq('id', workoutLogId).eq('user_id', userId);
      if (updateError) throw updateError;

      // Also mark cycle_session as complete if this log is associated with one
      try {
        // Prefer sessionMeta.id if available
        if (sessionMeta?.id) {
          // Mark session complete only if it belongs to the current user
          if (userId) await supabase.from('cycle_sessions').update({ is_complete: true }).eq('id', sessionMeta.id).eq('user_id', userId);
        } else {
          // fallback: find cycle_session by user, routine and date
          const startDateStr = new Date(logData.created_at).toISOString().slice(0, 10);
          const { data: found } = await supabase.from('cycle_sessions').select('id').eq('user_id', userId).eq('routine_id', routineId).eq('scheduled_date', startDateStr).maybeSingle();
          if (found && found.id) {
            await supabase.from('cycle_sessions').update({ is_complete: true }).eq('id', found.id).eq('user_id', userId);
          }
        }
      } catch (err) {
        // ignore missing-column errors (42703) if migrations haven't been applied yet
        if (err?.code && err.code !== '42703') console.warn('Could not mark cycle_session complete:', err?.message ?? err);
      }

      setSuccessModalOpen(true);
    } catch (error) {
      alert(`Error finishing workout: ${error.message}`);
    }
  };

  const handleCloseSuccessModal = () => {
    setSuccessModalOpen(false);
    navigate('/dashboard');
  };

  /** Deletes a specific set from the current log securely. */
  const handleDeleteSet = async (entryId) => {
    if (rpcLoading) return;
    setRpcLoading(true);
    try {
      // SECURITY FIX: Call the secure Edge Function.
      const { error } = await supabase.functions.invoke('delete-workout-set', {
        body: { entry_id: entryId }
      });
      if (error) {
        console.error("Secure delete failed:", error);
        return alert("Could not delete set." + (error?.message ? ` (${error.message})` : ''));
      }
      // Refetch to ensure UI consistency, only if still mounted.
      if (userId && isMountedRef.current) await fetchAndStartWorkout(userId);
    } finally {
      if (isMountedRef.current) setRpcLoading(false);
    }
  };

  /** Enters "edit mode" for a specific set. */
  const handleEditSetClick = (set) => {
    setEditingSet({ entryId: set.id });
    setEditSetValue({ weight: set.weight_lbs, reps: set.reps_completed });
  };

  /** Saves the updated values for a set being edited securely. */
  const handleUpdateSet = async () => {
    if (!editingSet) return;
    if (rpcLoading) return;
    setRpcLoading(true);
    try {
      // SECURITY FIX: Call the secure Edge Function.
      const { error } = await supabase.functions.invoke('update-workout-set', {
        body: {
          entry_id: editingSet.entryId,
          weight_lbs: parseInt(editSetValue.weight, 10),
          reps_completed: parseInt(editSetValue.reps, 10)
        }
      });

      if (error) {
        console.error("Secure update failed:", error);
        return alert("Could not update set." + (error?.message ? ` (${error.message})` : ''));
      }
      if (isMountedRef.current) setEditingSet(null);
      if (userId && isMountedRef.current) await fetchAndStartWorkout(userId);
    } finally {
      if (isMountedRef.current) setRpcLoading(false);
    }
  };

  const handleCancelEdit = () => setEditingSet(null);

  if (loading) return <div className="loading-message">Loading Workout...</div>;

  // Allow an optional returnTo query param so callers (like mesocycle log) can
  // control where the back button should go after viewing/editing a session.
  const queryParams = new URLSearchParams(location.search);
  const returnTo = queryParams.get('returnTo') || '/workouts/select-routine-log';

  return (
    <div className="workout-log-page-container">
      <SubPageHeader title={routine?.routine_name || 'Workout'} icon={<Dumbbell size={28} />} iconColor="#f97316" backTo={returnTo} />

      <div className="log-toggle-header">
        <div className="log-toggle">
          <button className={`toggle-btn ${activeView === 'log' ? 'active' : ''}`} onClick={() => setActiveView('log')}>Log</button>
          <button className={`toggle-btn ${activeView === 'chart' ? 'active' : ''}`} onClick={() => setActiveView('chart')}>Chart</button>
        </div>
      </div>

      <div className="thumbnail-scroller">
        {routine?.routine_exercises.map((item, index) => (
          <button key={item.exercises.id} className={`thumbnail-btn ${index === selectedExerciseIndex ? 'selected' : ''}`} onClick={() => setSelectedExerciseIndex(index)}>
            <img
              src={item.exercises.thumbnail_url || 'https://placehold.co/50x50/4a556j8/ffffff?text=IMG'}
              alt={item.exercises.name}
              width="50"
              height="50"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* --- This JSX remains the same, but will now use the new function --- */}
      <h2 className="current-exercise-name">
        {selectedExercise?.name}
        {adjustedTargetSets > 0 && (
          <span className="set-count-subtitle">
            &nbsp;- {formatSetCount(adjustedTargetSets)}
            {sessionMeta && sessionMeta.planned_volume_multiplier !== 1 && (
              <em style={{ marginLeft: '0.5rem', fontWeight: 400, fontSize: '0.85rem' }}> (base: {formatSetCount(targetSets)})</em>
            )}
          </span>
        )}
        {sessionMeta?.is_deload && (
          <div style={{ marginLeft: '0.5rem', color: '#92400e', fontSize: '0.85rem' }}>Deload week — volume reduced</div>
        )}
      </h2>

      {activeView === 'log' ? (
        <>
          <div className="log-inputs">
            <div className="input-group">
              <label>Weight</label>
              {/* Use text + inputMode to avoid mobile numeric input quirks while still
                    presenting a numeric keyboard. Sanitize to digits but allow empty
                    string so users can clear the field without the browser forcing a
                    default like `1`. */}
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={currentSet.weight} onChange={(e) => setCurrentSet(prev => ({ ...prev, weight: e.target.value.replace(/\D/g, '') }))} placeholder="0" />
            </div>
            <div className="input-group">
              <label>Reps</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={currentSet.reps} onChange={(e) => setCurrentSet(prev => ({ ...prev, reps: e.target.value.replace(/\D/g, '') }))} placeholder="0" />
            </div>
          </div>
          <button className="save-set-button" onClick={handleSaveSet} disabled={saveSetLoading}>{saveSetLoading ? 'Saving...' : 'Save Set'}</button>

          <div className="log-history-container">
            <div className="log-history-column">
              <h3>Today</h3>
              <ul>
                {(todaysLog[selectedExercise?.id] || []).map((set) => (
                  <li key={set.id}>
                    {editingSet && editingSet.entryId === set.id ? (
                      <div className="edit-set-form">
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={editSetValue.weight} onChange={(e) => setEditSetValue(prev => ({ ...prev, weight: e.target.value.replace(/\D/g, '') }))} />
                        <span>lbs x</span>
                        <input type="text" inputMode="numeric" pattern="[0-9]*" value={editSetValue.reps} onChange={(e) => setEditSetValue(prev => ({ ...prev, reps: e.target.value.replace(/\D/g, '') }))} />
                        <button onClick={handleUpdateSet} className="edit-action-btn save" disabled={rpcLoading}><Check size={16} /></button>
                        <button onClick={handleCancelEdit} className="edit-action-btn cancel" disabled={rpcLoading}><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <span>{set.weight_lbs} lbs x {set.reps_completed}</span>
                        <div className="set-actions">
                          <button onClick={() => handleEditSetClick(set)} disabled={rpcLoading}><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteSet(set.id)} disabled={rpcLoading}><Trash2 size={14} /></button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="log-history-column">
              <h3>Last Time</h3>
              <ul>
                {(previousLog[selectedExercise?.id] || []).map((set, index) => (
                  <li key={index}><span>{set.weight_lbs} lbs x {set.reps_completed}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : (
        <div className="chart-view-container">
          <div className="chart-metric-selector">
            <button className={chartMetric === '1RM' ? 'active' : ''} onClick={() => setChartMetric('1RM')}>1RM</button>
            <button className={chartMetric === 'Weight Volume' ? 'active' : ''} onClick={() => setChartMetric('Weight Volume')}>Weight Volume</button>
            <button className={chartMetric === 'Set Volume' ? 'active' : ''} onClick={() => setChartMetric('Set Volume')}>Set Volume</button>
          </div>
          <div className="chart-container">
            {chartLoading ? (
              <div className="loading-message">Loading Chart...</div>
            ) : chartData.length > 0 ? (
              <LazyRecharts fallback={<div className="loading-message">Loading chart...</div>}>
                {// libs is used inside JSX via property access; ESLint sometimes flags this as unused
                  // eslint-disable-next-line no-unused-vars
                  (libs) => (
                    <libs.ResponsiveContainer width="100%" height={250}>
                      <libs.LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <libs.CartesianGrid stroke="#4a5568" strokeDasharray="3 3" />
                        <libs.XAxis dataKey="date" stroke="#a0aec0" />
                        <libs.YAxis stroke="#a0aec0" domain={["dataMin - 10", "dataMax + 10"]} />
                        <libs.Tooltip contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568' }} />
                        <libs.Line type="monotone" dataKey="value" name={chartMetric} stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                      </libs.LineChart>
                    </libs.ResponsiveContainer>
                  )}
              </LazyRecharts>
            ) : (
              <p className="no-data-message">No progress data available for this exercise yet.</p>
            )}
          </div>
        </div>
      )}

      <RestTimerModal
        isOpen={isTimerOpen}
        onClose={handleTimerClose}
        isWorkoutComplete={isWorkoutCompletable}
        onFinishWorkout={handleFinishWorkout}
      />

      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        title="Workout Saved!"
        message="Your progress has been saved successfully."
      />
    </div>
  );
}

export default WorkoutLogPage;

/** Audited: 2025-10-25 — JSDoc batch 9 */
