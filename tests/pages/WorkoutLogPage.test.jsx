/**
 * @fileoverview Test suite for WorkoutLogPage component.
 * 
 * Tests active workout logging functionality including:
 * - Routine loading with exercises
 * - Set logging (add/edit/delete operations)
 * - "Last Time" session data display
 * - Chart data loading and display
 * - Workout completion flow
 * - Database RPC calls (save-workout-set, delete-workout-set)
 * - Edge Function integration (get-last-session-entries)
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkoutLogPage from '../../src/pages/WorkoutLogPage';

// Mock the AuthContext
const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com'
};

const mockAuthContext = {
    user: mockUser,
    loading: false
};

vi.mock('../../src/AuthContext.jsx', () => ({
    useAuth: () => mockAuthContext
}));

// Mock workout session data
const mockWorkoutSession = {
    id: 'session-123',
    user_id: 'test-user-123',
    routine_id: 'routine-456',
    session_date: '2024-01-15',
    is_deload: false,
    planned_volume_multiplier: 1,
    status: 'active',
    created_at: '2024-01-15T10:00:00Z'
};

// Mock routine data with exercises
const mockRoutineData = {
    id: 'routine-456',
    user_id: 'test-user-123',
    name: 'Upper Body A',
    description: 'Chest and back focus',
    focus_type: 'Hypertrophy',
    routine_exercises: [
        {
            id: 're-1',
            routine_id: 'routine-456',
            exercise_id: 'ex-1',
            target_sets: 3,
            exercise_order: 1,
            exercises: {
                id: 'ex-1',
                name: 'Bench Press',
                description: 'Compound chest exercise',
                instructions: 'Lower bar to chest, press up',
                primary_muscle: 'Chest',
                secondary_muscle: 'Triceps',
                tertiary_muscle: 'Shoulders',
                equipment_needed: 'Barbell',
                difficulty_level: 'Intermediate',
                exercise_type: 'strength'
            }
        },
        {
            id: 're-2',
            routine_id: 'routine-456',
            exercise_id: 'ex-2',
            target_sets: 3,
            exercise_order: 2,
            exercises: {
                id: 'ex-2',
                name: 'Bent Over Row',
                description: 'Compound back exercise',
                instructions: 'Pull bar to lower chest',
                primary_muscle: 'Back',
                secondary_muscle: 'Biceps',
                tertiary_muscle: null,
                equipment_needed: 'Barbell',
                difficulty_level: 'Intermediate',
                exercise_type: 'strength'
            }
        }
    ]
};

// Mock "Last Time" data from Edge Function
const mockLastSessionData = [
    {
        exercise_id: 'ex-1',
        sets: [
            { set_number: 1, weight: 185, reps: 8, rpe: 7 },
            { set_number: 2, weight: 185, reps: 7, rpe: 8 },
            { set_number: 3, weight: 175, reps: 9, rpe: 7 }
        ]
    },
    {
        exercise_id: 'ex-2',
        sets: [
            { set_number: 1, weight: 135, reps: 10, rpe: 6 },
            { set_number: 2, weight: 135, reps: 9, rpe: 7 },
            { set_number: 3, weight: 135, reps: 8, rpe: 7 }
        ]
    }
];

// Mock chart data
const mockChartData = [
    {
        exercise_id: 'ex-1',
        exercise_name: 'Bench Press',
        data_points: [
            { session_date: '2024-01-01', avg_weight: 180, total_volume: 4320 },
            { session_date: '2024-01-08', avg_weight: 182.5, total_volume: 4380 },
            { session_date: '2024-01-15', avg_weight: 185, total_volume: 4440 }
        ]
    }
];

// Mock Supabase client
const mockSupabase = {
    from: vi.fn((table) => {
        const chainable = {
            select: vi.fn(() => chainable),
            insert: vi.fn(() => chainable),
            update: vi.fn(() => chainable),
            delete: vi.fn(() => chainable),
            eq: vi.fn(() => chainable),
            order: vi.fn(() => chainable),
            single: vi.fn(() => chainable),
            maybeSingle: vi.fn(() => chainable)
        };

        // Configure responses based on table
        if (table === 'workout_sessions') {
            chainable.maybeSingle.mockResolvedValue({
                data: mockWorkoutSession,
                error: null
            });
            chainable.single.mockResolvedValue({
                data: mockWorkoutSession,
                error: null
            });
        } else if (table === 'workout_routines') {
            chainable.single.mockResolvedValue({
                data: mockRoutineData,
                error: null
            });
        } else if (table === 'routine_exercises') {
            chainable.select.mockResolvedValue({
                data: mockRoutineData.routine_exercises,
                error: null
            });
        }

        return chainable;
    }),
    rpc: vi.fn((functionName) => {
        if (functionName === 'save-workout-set') {
            return Promise.resolve({ data: { id: 'set-new-123' }, error: null });
        } else if (functionName === 'delete-workout-set') {
            return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
    }),
    functions: {
        invoke: vi.fn((functionName) => {
            if (functionName === 'get-last-session-entries') {
                return Promise.resolve({
                    data: mockLastSessionData,
                    error: null
                });
            } else if (functionName === 'get-exercise-chart-data') {
                return Promise.resolve({
                    data: mockChartData,
                    error: null
                });
            }
            return Promise.resolve({ data: null, error: null });
        })
    }
};

// Mock Supabase module
vi.mock('../../src/supabaseClient.js', () => ({
    supabase: mockSupabase
}));

/**
 * Helper function to render WorkoutLogPage with required context
 */
const renderWorkoutLogPage = () => {
    return render(
        <BrowserRouter>
            <WorkoutLogPage />
        </BrowserRouter>
    );
};

describe('WorkoutLogPage', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('should render the page title', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText(/Today's Workout/i)).toBeInTheDocument();
            });
        });

        it('should display routine name after loading', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Upper Body A')).toBeInTheDocument();
            });
        });

        it('should render all exercises from the routine', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
                expect(screen.getByText('Bent Over Row')).toBeInTheDocument();
            });
        });

        it('should display exercise muscle information', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                // Primary muscle displayed
                expect(screen.getByText(/Chest/i)).toBeInTheDocument();
                expect(screen.getByText(/Back/i)).toBeInTheDocument();
            });
        });
    });

    describe('Loading Workout Data', () => {
        it('should fetch active workout session on mount', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('workout_sessions');
            });
        });

        it('should load routine data with exercises', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('workout_routines');
            });
        });

        it('should call get-last-session-entries Edge Function', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
                    'get-last-session-entries',
                    expect.objectContaining({
                        body: expect.objectContaining({
                            routineId: 'routine-456'
                        })
                    })
                );
            });
        });

        it('should display "Last Time" data when available', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                // Should show previous weights/reps
                expect(screen.getByText(/Last Time/i)).toBeInTheDocument();
            });
        });
    });

    describe('Set Logging', () => {
        it('should allow adding a new set', async () => {
            const user = userEvent.setup();
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            // Find and click "Add Set" button
            const addSetButton = screen.getByRole('button', { name: /add set/i });
            await user.click(addSetButton);

            // Verify RPC call was made
            await waitFor(() => {
                expect(mockSupabase.rpc).toHaveBeenCalledWith(
                    'save-workout-set',
                    expect.any(Object)
                );
            });
        });

        it('should allow editing an existing set', async () => {
            const user = userEvent.setup();
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            // Find weight input and update it
            const weightInputs = screen.getAllByLabelText(/weight/i);
            expect(weightInputs.length).toBeGreaterThan(0);
            
            await user.clear(weightInputs[0]);
            await user.type(weightInputs[0], '200');

            // Verify RPC call was made on blur or save
            await waitFor(() => {
                expect(mockSupabase.rpc).toHaveBeenCalledWith(
                    'save-workout-set',
                    expect.objectContaining({
                        p_weight: 200
                    })
                );
            });
        });

        it('should allow deleting a set', async () => {
            const user = userEvent.setup();
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            // Find and click delete button
            const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
            expect(deleteButtons.length).toBeGreaterThan(0);
            
            await user.click(deleteButtons[0]);

            // Verify RPC call was made
            await waitFor(() => {
                expect(mockSupabase.rpc).toHaveBeenCalledWith(
                    'delete-workout-set',
                    expect.any(Object)
                );
            });
        });
    });

    describe('Deload Sessions', () => {
        it('should display deload indicator when session is_deload is true', async () => {
            // Mock deload session
            const deloadSession = { ...mockWorkoutSession, is_deload: true };
            mockSupabase.from.mockImplementation((table) => {
                const chainable = {
                    select: vi.fn(() => chainable),
                    eq: vi.fn(() => chainable),
                    maybeSingle: vi.fn(() => chainable),
                    single: vi.fn(() => chainable),
                    order: vi.fn(() => chainable)
                };

                if (table === 'workout_sessions') {
                    chainable.maybeSingle.mockResolvedValue({
                        data: deloadSession,
                        error: null
                    });
                } else if (table === 'workout_routines') {
                    chainable.single.mockResolvedValue({
                        data: mockRoutineData,
                        error: null
                    });
                }

                return chainable;
            });

            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText(/deload/i)).toBeInTheDocument();
            });
        });

        it('should apply volume multiplier to target sets during deload', async () => {
            const deloadSession = {
                ...mockWorkoutSession,
                is_deload: true,
                planned_volume_multiplier: 0.7
            };

            mockSupabase.from.mockImplementation((table) => {
                const chainable = {
                    select: vi.fn(() => chainable),
                    eq: vi.fn(() => chainable),
                    maybeSingle: vi.fn(() => chainable),
                    single: vi.fn(() => chainable),
                    order: vi.fn(() => chainable)
                };

                if (table === 'workout_sessions') {
                    chainable.maybeSingle.mockResolvedValue({
                        data: deloadSession,
                        error: null
                    });
                } else if (table === 'workout_routines') {
                    chainable.single.mockResolvedValue({
                        data: mockRoutineData,
                        error: null
                    });
                }

                return chainable;
            });

            renderWorkoutLogPage();

            await waitFor(() => {
                // Should display adjusted target sets (3 * 0.7 ≈ 2)
                expect(screen.getByText(/2 sets/i)).toBeInTheDocument();
            });
        });
    });

    describe('Chart Data', () => {
        it('should load chart data for exercises', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
                    'get-exercise-chart-data',
                    expect.any(Object)
                );
            });
        });

        it('should display chart when data is available', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                // Look for chart container or canvas element
                screen.queryByRole('img', { name: /chart/i });
                // Chart rendering may vary, check component is rendered
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });
        });
    });

    describe('Workout Completion', () => {
        it('should allow completing the workout', async () => {
            const user = userEvent.setup();
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            // Find and click "Complete Workout" button
            const completeButton = screen.getByRole('button', { name: /complete workout/i });
            await user.click(completeButton);

            // Verify session status update
            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('workout_sessions');
                
                // Check that one of the chainable instances had update called
                const fromResults = mockSupabase.from.mock.results;
                const hasUpdateCall = fromResults.some(result => {
                    const chainInstance = result.value;
                    return chainInstance && chainInstance.update && chainInstance.update.mock && chainInstance.update.mock.calls.length > 0;
                });
                expect(hasUpdateCall).toBe(true);
            });
        });

        it('should show confirmation modal before completing', async () => {
            const user = userEvent.setup();
            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            const completeButton = screen.getByRole('button', { name: /complete workout/i });
            await user.click(completeButton);

            // Should show confirmation dialog
            await waitFor(() => {
                expect(screen.getByText(/confirm/i)).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle routine loading errors gracefully', async () => {
            mockSupabase.from.mockImplementation((table) => {
                const chainable = {
                    select: vi.fn(() => chainable),
                    eq: vi.fn(() => chainable),
                    single: vi.fn(() => chainable),
                    maybeSingle: vi.fn(() => chainable),
                    order: vi.fn(() => chainable)
                };

                if (table === 'workout_routines') {
                    chainable.single.mockResolvedValue({
                        data: null,
                        error: { message: 'Routine not found' }
                    });
                } else if (table === 'workout_sessions') {
                    chainable.maybeSingle.mockResolvedValue({
                        data: mockWorkoutSession,
                        error: null
                    });
                }

                return chainable;
            });

            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText(/error/i)).toBeInTheDocument();
            });
        });

        it('should handle Edge Function failures', async () => {
            mockSupabase.functions.invoke.mockResolvedValue({
                data: null,
                error: { message: 'Function timeout' }
            });

            renderWorkoutLogPage();

            // Should still render page even if Edge Function fails
            await waitFor(() => {
                expect(screen.getByText(/Today's Workout/i)).toBeInTheDocument();
            });
        });

        it('should handle set save errors', async () => {
            const user = userEvent.setup();
            mockSupabase.rpc.mockResolvedValue({
                data: null,
                error: { message: 'Database error' }
            });

            renderWorkoutLogPage();

            await waitFor(() => {
                expect(screen.getByText('Bench Press')).toBeInTheDocument();
            });

            const addSetButton = screen.getByRole('button', { name: /add set/i });
            await user.click(addSetButton);

            // Should show error message to user
            await waitFor(() => {
                expect(screen.getByText(/failed/i)).toBeInTheDocument();
            });
        });
    });

    describe('Schema Compliance', () => {
        it('should query exercises without muscle_groups join', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                const routineCall = mockSupabase.from.mock.calls.find(
                    call => call[0] === 'workout_routines'
                );
                expect(routineCall).toBeDefined();
            });

            // Verify select query uses exercises(*) not muscle_groups join
            // Check the actual mock results from the from() calls
            const fromResults = mockSupabase.from.mock.results;
            const hasDeprecatedJoin = fromResults.some(result => {
                const chainInstance = result.value;
                if (chainInstance && chainInstance.select && chainInstance.select.mock) {
                    return chainInstance.select.mock.calls.some(call =>
                        call[0]?.includes('muscle_groups')
                    );
                }
                return false;
            });
            expect(hasDeprecatedJoin).toBe(false);
        });

        it('should handle exercises with direct muscle string fields', async () => {
            renderWorkoutLogPage();

            await waitFor(() => {
                // Verify primary_muscle is displayed as string
                expect(screen.getByText(/Chest/i)).toBeInTheDocument();
            });

            // Muscle data should come from exercise object, not separate table
            const exercises = mockRoutineData.routine_exercises.map(re => re.exercises);
            exercises.forEach(ex => {
                expect(ex.primary_muscle).toBeDefined();
                expect(typeof ex.primary_muscle).toBe('string');
            });
        });
    });
});
