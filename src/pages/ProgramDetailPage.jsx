/**
 * @fileoverview Program Detail Page Component
 * @description Detailed view of a specific workout program showing all routines and allowing assignment to clients.
 * Includes program information, routine list, client selection, and Google Calendar scheduling.
 * 
 * @author Felony Fitness Development Team
 * @version 1.0.0
 * @since 2025-11-02
 * 
 * @requires React
 * @requires Supabase
 * @requires React Router
 * 
 * @component ProgramDetailPage
 * @example
 * // Used in router configuration
 * <Route path="/program-library/:programId" element={<ProgramDetailPage />} />
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import ScheduleRoutineModal from '../components/ScheduleRoutineModal';
import SubPageHeader from '../components/SubPageHeader';
import { supabase } from '../supabaseClient';
import './ProgramDetailPage.css';

/**
 * @typedef {Object} ProgramRoutine
 * @property {string} id - Unique routine identifier
 * @property {string} name - Display name of the routine
 * @property {string} description - Detailed description
 * @property {number} week_number - Week in program sequence
 * @property {number} day_number - Day in week sequence
 * @property {Array} exercises - Array of exercise objects
 * @property {number} estimated_duration_minutes - Expected workout time
 * @property {string} difficulty_level - beginner|intermediate|advanced
 * @property {Array} equipment_needed - Required equipment list
 */

const ProgramDetailPage = () => {
  const { programId } = useParams();
  // const navigate = useNavigate();
  const { user } = useAuth();

  const [program, setProgram] = useState(null);
  const [routines, setRoutines] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [groupedRoutines, setGroupedRoutines] = useState({});

  /**
   * Fetch program details and associated routines
   * @async
   * @function fetchProgramData
   * @returns {Promise<void>}
   */
  const fetchProgramData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch program details with creator info
      const { data: programData, error: programError } = await supabase
        .from('programs')
        .select(`
          *,
          creator_profile:user_profiles!created_by (
            id,
            full_name,
            trainer_specialization
          )
        `)
        .eq('id', programId)
        .single();

      if (programError) throw programError;
      if (!programData) throw new Error('Program not found');

      setProgram(programData);

      // Fetch all routines for this program
      const { data: routinesData, error: routinesError } = await supabase
        .from('program_routines')
        .select('*')
        .eq('program_id', programId)
        .order('week_number')
        .order('day_number');

      if (routinesError) throw routinesError;

      setRoutines(routinesData || []);

      // Group routines by week for better display
      const grouped = routinesData.reduce((acc, routine) => {
        const week = `Week ${routine.week_number}`;
        if (!acc[week]) {
          acc[week] = [];
        }
        acc[week].push(routine);
        return acc;
      }, {});

      setGroupedRoutines(grouped);

      // Fetch trainer's clients (if user is a trainer)
      if (user) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .eq('trainer_id', user.id)
          .order('full_name');

        if (clientsError) {
          console.warn('Error fetching clients:', clientsError);
        } else {
          setClients(clientsData || []);
        }
      }

    } catch (err) {
      console.error('Error fetching program data:', err);
      setError(err.message || 'Failed to load program details');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle routine assignment to client
   * @function handleAssignRoutine
   * @param {ProgramRoutine} routine - Routine to assign
   */
  const handleAssignRoutine = (routine) => {
    if (clients.length === 0) {
      alert('You need to have clients assigned to you before you can schedule routines.');
      return;
    }

    setSelectedRoutine(routine);
    setShowScheduleModal(true);
  };

  /**
   * Handle successful routine scheduling
   * @function handleScheduleSuccess
   * @param {Object} scheduleData - Scheduling result data
   */
  const handleScheduleSuccess = (scheduleData) => {
    setShowScheduleModal(false);
    setSelectedRoutine(null);

    // Show success message
    alert(`Routine "${selectedRoutine.name}" successfully scheduled for ${scheduleData.clientName}!`);
  };

  /**
   * Handle modal close
   * @function handleModalClose
   */
  const handleModalClose = () => {
    setShowScheduleModal(false);
    setSelectedRoutine(null);
  };

  /**
   * Get difficulty display with styling
   * @function getDifficultyDisplay
   * @param {string} level - Difficulty level
   * @returns {Object} Difficulty display object
   */
  const getDifficultyDisplay = (level) => {
    const displays = {
      beginner: { emoji: '🟢', text: 'Beginner', class: 'difficulty-beginner' },
      intermediate: { emoji: '🟡', text: 'Intermediate', class: 'difficulty-intermediate' },
      advanced: { emoji: '🔴', text: 'Advanced', class: 'difficulty-advanced' }
    };
    return displays[level] || { emoji: '⚪', text: level, class: 'difficulty-unknown' };
  };

  /**
   * Format duration in minutes to human readable
   * @function formatDuration
   * @param {number} minutes - Duration in minutes
   * @returns {string} Formatted duration string
   */
  const formatDuration = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  /**
   * Format program duration in weeks
   * @function formatProgramDuration
   * @param {number} weeks - Number of weeks
   * @returns {string} Formatted duration string
   */
  const formatProgramDuration = (weeks) => {
    if (weeks === 1) return '1 week';
    if (weeks < 4) return `${weeks} weeks`;
    const months = Math.round(weeks / 4);
    return months === 1 ? '1 month' : `${months} months`;
  };

  // Load program data on component mount
  useEffect(() => {
    if (programId) {
      fetchProgramData();
    }
    // fetchProgramData changes on every render, so we can't include it safely
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  if (loading) {
    return (
      <div className="program-detail-page">
        <SubPageHeader
          title="Loading Program..."
          subtitle="Please wait"
        />
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading program details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="program-detail-page">
        <SubPageHeader
          title="Error"
          subtitle="Failed to load program"
        />
        <div className="error-container">
          <p className="error-message">{error}</p>
          <div className="error-actions">
            <button onClick={fetchProgramData} className="retry-button">
              Try Again
            </button>
            <Link to="/program-library" className="back-button">
              ← Back to Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="program-detail-page">
        <SubPageHeader
          title="Program Not Found"
          subtitle="The requested program could not be found"
        />
        <div className="error-container">
          <p>This program may have been removed or you may not have access to it.</p>
          <Link to="/program-library" className="back-button">
            ← Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const difficulty = getDifficultyDisplay(program.difficulty_level);

  return (
    <div className="program-detail-page">
      <SubPageHeader
        title={program.name}
        subtitle={`${routines.length} workout routine${routines.length !== 1 ? 's' : ''}`}
      />

      {/* Back Navigation */}
      <div className="back-navigation">
        <Link to="/program-library" className="back-link">
          ← Back to Program Library
        </Link>
      </div>

      {/* Program Overview */}
      <div className="program-overview">
        <div className="overview-header">
          <div className="program-title-section">
            <h2 className="program-title">{program.name}</h2>
            <div className={`program-difficulty ${difficulty.class}`}>
              {difficulty.emoji} {difficulty.text}
            </div>
          </div>
        </div>

        <p className="program-description">{program.description}</p>

        <div className="program-stats">
          <div className="stat-item">
            <span className="stat-label">⏱️ Duration</span>
            <span className="stat-value">{formatProgramDuration(program.estimated_weeks)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">🎯 Target Areas</span>
            <span className="stat-value">{program.target_muscle_groups.join(', ')}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">📝 Total Workouts</span>
            <span className="stat-value">{routines.length} routine{routines.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">👨‍💼 Created by</span>
            <span className="stat-value">{program.creator_profile?.full_name || 'Unknown'}</span>
          </div>
        </div>
      </div>

      {/* Program Routines */}
      <div className="program-routines">
        <div className="routines-header">
          <h3>📋 Workout Routines</h3>
          {clients.length > 0 && (
            <p className="assign-hint">Click "Assign to Client" on any routine to schedule it</p>
          )}
        </div>

        {Object.keys(groupedRoutines).length === 0 ? (
          <div className="no-routines">
            <div className="no-routines-icon">📝</div>
            <h3>No routines available</h3>
            <p>This program doesn't have any workout routines yet.</p>
          </div>
        ) : (
          <div className="routines-by-week">
            {Object.entries(groupedRoutines).map(([week, weekRoutines]) => (
              <div key={week} className="week-section">
                <h4 className="week-title">{week}</h4>
                <div className="week-routines">
                  {weekRoutines.map((routine) => {
                    const routineDifficulty = getDifficultyDisplay(routine.difficulty_level);

                    return (
                      <div key={routine.id} className="routine-card">
                        <div className="routine-header">
                          <div className="routine-title-section">
                            <h5 className="routine-name">
                              Day {routine.day_number}: {routine.name}
                            </h5>
                            <div className={`routine-difficulty ${routineDifficulty.class}`}>
                              {routineDifficulty.emoji} {routineDifficulty.text}
                            </div>
                          </div>
                        </div>

                        <p className="routine-description">{routine.description}</p>

                        <div className="routine-details">
                          <div className="detail-row">
                            <span className="detail-label">⏱️ Duration:</span>
                            <span className="detail-value">
                              {formatDuration(routine.estimated_duration_minutes)}
                            </span>
                          </div>

                          {routine.equipment_needed && routine.equipment_needed.length > 0 && (
                            <div className="detail-row">
                              <span className="detail-label">🏋️ Equipment:</span>
                              <span className="detail-value">
                                {routine.equipment_needed.join(', ')}
                              </span>
                            </div>
                          )}

                          {routine.exercises && routine.exercises.length > 0 && (
                            <div className="detail-row">
                              <span className="detail-label">💪 Exercises:</span>
                              <span className="detail-value">
                                {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="routine-actions">
                          {clients.length > 0 ? (
                            <button
                              onClick={() => handleAssignRoutine(routine)}
                              className="assign-routine-btn"
                            >
                              📅 Assign to Client
                            </button>
                          ) : (
                            <div className="no-clients-message">
                              <span>No clients available for assignment</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Routine Modal */}
      {showScheduleModal && selectedRoutine && (
        <ScheduleRoutineModal
          routine={selectedRoutine}
          clients={clients}
          onSuccess={handleScheduleSuccess}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
};

export default ProgramDetailPage;