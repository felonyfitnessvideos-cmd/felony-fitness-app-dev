/**
 * @file CycleWeekEditor.jsx
 * @description Small UI to show a grid of weeks and allow assigning routines per week.
 * This is a lightweight placeholder used by the MesocycleBuilder scaffold.
 *
 * Notes
 * - The editor auto-assigns deload weeks for Strength/Hypertrophy by default
 *   (every 5th week). It emits assignments as an array of objects with shape:
 *   { week_index, day_index, type: 'routine'|'rest'|'deload', routine_id }
 * - The component gracefully handles cases where the user's routines cannot be
 *   loaded (e.g., permissions or missing data) by leaving the select options
 *   limited to 'rest' and 'deload' where applicable.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext.jsx';
import { supabase } from '../supabaseClient.js';
import './CycleWeekEditor.css';

// helper: returns true if focus should auto-deload on 5th week
function isDeloadFocus(focus) {
  return focus === 'Strength' || focus === 'Hypertrophy';
}

/**
 * Render an editable grid of weeks and days for assigning routines, rest days, or deload weeks.
 *
 * Initializes assignments (from initialAssignments when its length equals weeks*7, otherwise generates defaults),
 * auto-marks every 5th week as a deload when focus is 'Strength' or 'Hypertrophy', and emits assignment updates via the callback.
 *
 * @param {object} props - Component props.
 * @param {number} [props.weeks=4] - Number of weeks to display; non-finite or non-positive values fall back to 4.
 * @param {string} [props.focus='Hypertrophy'] - Training focus used to determine automatic deload weeks.
 * @param {(assignments: Array<{week_index:number,day_index:number,type:'routine'|'rest'|'deload',routine_id: (string|null)}>) => void} [props.onAssignmentsChange] - Called whenever assignments change with the full assignments array.
 * @param {Array<{week_index:number,day_index:number,type:'routine'|'rest'|'deload',routine_id: (string|null)}>} [props.initialAssignments=[]] - Optional initial assignments; used only when its length equals weeks * 7.
 * @returns {JSX.Element} The CycleWeekEditor React element.
 */
function CycleWeekEditor({ weeks = 4, focus = 'Hypertrophy', onAssignmentsChange = () => { }, initialAssignments = [] }) {
  // Defensive normalization: ensure `weeks` is a finite positive integer.
  // Fall back to 4 weeks when input is missing or invalid.
  if (!Number.isFinite(weeks) || weeks <= 0) weeks = 4;
  const { user, loading } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user || loading) return;
      try {
        const { data, error } = await supabase.from('workout_routines').select('id,routine_name').eq('user_id', user.id).order('routine_name');
        if (error) throw error;
        if (!mounted) return;
        setRoutines(data || []);
      } catch (err) {
        console.error('Failed to load routines', err.message ?? err);
      }
    })();
    return () => { mounted = false; };
  }, [user, loading]);

  // initialize assignments when weeks or focus changes
  /** Audited: 2025-10-25 — JSDoc batch 9 */
  useEffect(() => {
    // If initial assignments provided (editing mode), use them when lengths match
    if (initialAssignments && initialAssignments.length > 0) {
      // basic check: expected length
      const expected = weeks * 7;
      if (initialAssignments.length === expected) {
        setAssignments(initialAssignments);
        return;
      }
    }

    const arr = [];
    const autoDeload = isDeloadFocus(focus);
    for (let w = 1; w <= weeks; w++) {
      const deloadWeek = autoDeload && (w % 5 === 0);
      for (let d = 1; d <= 7; d++) {
        arr.push({ week_index: w, day_index: d, type: deloadWeek ? 'deload' : 'rest', routine_id: null });
      }
    }
    setAssignments(arr);

  }, [weeks, focus, initialAssignments]);

  /**
   * Emit assignment changes to parent component.
   * 
   * CRITICAL FIX (2025-11-06): Removed onAssignmentsChange from dependency array to prevent
   * infinite re-render loop. The parent component may recreate the callback on every render,
   * but we only need to call it when assignments actually change, not when the callback
   * reference changes. This fixes the "Maximum update depth exceeded" error.
   * 
   * @see https://react.dev/reference/react/useEffect#removing-unnecessary-object-dependencies
   */
  useEffect(() => {
    if (assignments && assignments.length > 0) {
      onAssignmentsChange(assignments);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments]);

  /**
   * Handle routine/rest/deload selection for a specific day.
   * 
   * Updates the assignments array by mapping over it and modifying the matching week/day.
   * Validates routine_id is a valid UUID (36 characters) before accepting it.
   * 
   * @param {number} weekIndex - 1-indexed week number
   * @param {number} dayIndex - 1-indexed day number (1-7)
   * @param {string} value - Selected value: 'rest', 'deload', or routine UUID
   */
  const handleSelect = (weekIndex, dayIndex, value) => {
    setAssignments((prev) => {
      return prev.map((a) => {
        if (a.week_index === weekIndex && a.day_index === dayIndex) {
          if (value === 'rest') return { ...a, type: 'rest', routine_id: null };
          if (value === 'deload') return { ...a, type: 'deload', routine_id: null };
          // Only allow valid UUIDs for routine_id
          if (typeof value === 'string' && value.length === 36) {
            return { ...a, type: 'routine', routine_id: value };
          }
          // fallback: treat as rest if not valid UUID
          return { ...a, type: 'rest', routine_id: null };
        }
        return a;
      });
    });
  };

  const weekArray = Array.from({ length: weeks }, (_, i) => i + 1);

  return (
    <div className="cycle-week-editor">
      <div className="weeks-grid">
        {weekArray.map((w) => {
          const deloadWeek = isDeloadFocus(focus) && (w % 5 === 0);
          return (
            <div key={w} className="week-card">
              <strong>Week {w} {deloadWeek ? '(Deload week)' : ''}</strong>
              <div className="assignments">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const idx = assignments.findIndex(a => a.week_index === w && a.day_index === d);
                  const current = idx >= 0 ? assignments[idx] : { type: 'rest', routine_id: null };
                  return (
                    <div key={d} style={{ marginTop: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem' }}>Day {d}</label>
                      <select
                        value={current.type === 'routine' ? (current.routine_id || '') : current.type}
                        onChange={(e) => handleSelect(w, d, e.target.value)}
                        disabled={deloadWeek}
                      >
                        {deloadWeek && <option value="deload">Deload</option>}
                        {!deloadWeek && (
                          <>
                            <option value="rest">Rest</option>
                            {routines.map((r) => (
                              <option key={r.id} value={r.id}>{r.routine_name}</option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CycleWeekEditor;
