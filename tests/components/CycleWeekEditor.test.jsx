/**
 * @file CycleWeekEditor.test.jsx
 * @description Comprehensive test suite for CycleWeekEditor component
 * Tests week grid rendering, routine assignment, deload week logic, and infinite loop prevention
 * @author Felony Fitness Development Team
 * @date November 6, 2025
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CycleWeekEditor from '../../src/components/CycleWeekEditor.jsx';

// Mock the AuthContext
const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com'
};

const mockAuthContext = {
    user: mockUser,
    loading: false
};

vi.mock('../../src/AuthContext.jsx', () => ({
    useAuth: () => mockAuthContext
}));

// Mock Supabase client
const mockRoutines = [
    { id: 'routine-1', routine_name: 'Push Day' },
    { id: 'routine-2', routine_name: 'Pull Day' },
    { id: 'routine-3', routine_name: 'Leg Day' }
];

vi.mock('../../src/supabaseClient.js', () => ({
    supabase: {
        from: vi.fn(function () { return this; }),
        select: vi.fn(function () { return this; }),
        eq: vi.fn(function () { return this; }),
        order: vi.fn(function () {
            return Promise.resolve({
                data: mockRoutines,
                error: null
            });
        })
    }
}));

const { supabase: mockSupabase } = await import('../../src/supabaseClient.js');

describe('CycleWeekEditor', () => {
    let mockOnAssignmentsChange;

    beforeEach(() => {
        mockOnAssignmentsChange = vi.fn();
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    describe('Rendering', () => {
        it('should render the correct number of week cards', () => {
            render(<CycleWeekEditor weeks={4} onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.getByText('Week 1')).toBeInTheDocument();
            expect(screen.getByText('Week 2')).toBeInTheDocument();
            expect(screen.getByText('Week 3')).toBeInTheDocument();
            expect(screen.getByText('Week 4')).toBeInTheDocument();
        });

        it('should render 7 day selectors for each week', () => {
            render(<CycleWeekEditor weeks={2} onAssignmentsChange={mockOnAssignmentsChange} />);

            const dayLabels = screen.getAllByText(/Day \d/);
            expect(dayLabels).toHaveLength(14); // 2 weeks * 7 days
        });

        it('should default to 4 weeks if invalid weeks value provided', () => {
            render(<CycleWeekEditor weeks={-1} onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.getByText('Week 1')).toBeInTheDocument();
            expect(screen.getByText('Week 4')).toBeInTheDocument();
            expect(screen.queryByText('Week 5')).not.toBeInTheDocument();
        });
    });

    describe('Deload Weeks', () => {
        it('should mark every 5th week as deload for Strength focus', () => {
            render(<CycleWeekEditor weeks={10} focus="Strength" onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.getByText('Week 5 (Deload week)')).toBeInTheDocument();
            expect(screen.getByText('Week 10 (Deload week)')).toBeInTheDocument();
        });

        it('should mark every 5th week as deload for Hypertrophy focus', () => {
            render(<CycleWeekEditor weeks={10} focus="Hypertrophy" onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.getByText('Week 5 (Deload week)')).toBeInTheDocument();
            expect(screen.getByText('Week 10 (Deload week)')).toBeInTheDocument();
        });

        it('should NOT mark deload weeks for Endurance focus', () => {
            render(<CycleWeekEditor weeks={10} focus="Endurance" onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.queryByText(/Deload week/)).not.toBeInTheDocument();
        });

        it('should disable day selects on deload weeks', async () => {
            render(<CycleWeekEditor weeks={5} focus="Strength" onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                const selects = screen.getAllByRole('combobox');
                // Week 5 has 7 days, all should be disabled
                const week5Selects = selects.slice(28, 35); // Days 29-35 (week 5)
                week5Selects.forEach(select => {
                    expect(select).toBeDisabled();
                });
            });
        });
    });

    describe('Routine Selection', () => {
        it('should load user routines from database', async () => {
            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                expect(mockSupabase.from).toHaveBeenCalledWith('workout_routines');
            });
        });

        it('should display routine options in selects', async () => {
            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                expect(screen.getByText('Push Day')).toBeInTheDocument();
                expect(screen.getByText('Pull Day')).toBeInTheDocument();
                expect(screen.getByText('Leg Day')).toBeInTheDocument();
            });
        });

        it('should allow selecting a routine for a day', async () => {
            const user = userEvent.setup();
            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                expect(screen.getByText('Push Day')).toBeInTheDocument();
            });

            const firstDaySelect = screen.getAllByRole('combobox')[0];
            await user.selectOptions(firstDaySelect, 'routine-1');

            await waitFor(() => {
                expect(mockOnAssignmentsChange).toHaveBeenCalled();
                const assignments = mockOnAssignmentsChange.mock.calls[mockOnAssignmentsChange.mock.calls.length - 1][0];
                const firstDay = assignments.find(a => a.week_index === 1 && a.day_index === 1);
                expect(firstDay.type).toBe('routine');
                expect(firstDay.routine_id).toBe('routine-1');
            });
        });

        it('should allow setting a day to rest', async () => {
            const user = userEvent.setup();
            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
            });

            const firstDaySelect = screen.getAllByRole('combobox')[0];
            await user.selectOptions(firstDaySelect, 'rest');

            await waitFor(() => {
                expect(mockOnAssignmentsChange).toHaveBeenCalled();
                const assignments = mockOnAssignmentsChange.mock.calls[mockOnAssignmentsChange.mock.calls.length - 1][0];
                const firstDay = assignments.find(a => a.week_index === 1 && a.day_index === 1);
                expect(firstDay.type).toBe('rest');
                expect(firstDay.routine_id).toBeNull();
            });
        });
    });

    describe('Initial Assignments', () => {
        it('should use initialAssignments when length matches weeks * 7', async () => {
            const initialAssignments = [
                { week_index: 1, day_index: 1, type: 'routine', routine_id: 'routine-1' },
                { week_index: 1, day_index: 2, type: 'rest', routine_id: null },
                { week_index: 1, day_index: 3, type: 'routine', routine_id: 'routine-2' },
                { week_index: 1, day_index: 4, type: 'rest', routine_id: null },
                { week_index: 1, day_index: 5, type: 'routine', routine_id: 'routine-3' },
                { week_index: 1, day_index: 6, type: 'rest', routine_id: null },
                { week_index: 1, day_index: 7, type: 'rest', routine_id: null }
            ];

            render(
                <CycleWeekEditor
                    weeks={1}
                    initialAssignments={initialAssignments}
                    onAssignmentsChange={mockOnAssignmentsChange}
                />
            );

            // Should call onAssignmentsChange with the initial assignments
            await waitFor(() => {
                expect(mockOnAssignmentsChange).toHaveBeenCalled();
                const assignments = mockOnAssignmentsChange.mock.calls[0][0];
                expect(assignments).toEqual(initialAssignments);
            });
        });

        it('should generate defaults when initialAssignments length does not match', async () => {
            const initialAssignments = [
                { week_index: 1, day_index: 1, type: 'routine', routine_id: 'routine-1' }
            ];

            render(
                <CycleWeekEditor
                    weeks={2}
                    initialAssignments={initialAssignments}
                    onAssignmentsChange={mockOnAssignmentsChange}
                />
            );

            await waitFor(() => {
                expect(mockOnAssignmentsChange).toHaveBeenCalled();
                const assignments = mockOnAssignmentsChange.mock.calls[0][0];
                expect(assignments.length).toBe(14); // 2 weeks * 7 days
            });
        });
    });

    describe('Infinite Loop Prevention (Bug Fix)', () => {
        it('should not cause infinite re-renders when onAssignmentsChange reference changes', async () => {
            const { rerender } = render(
                <CycleWeekEditor
                    weeks={1}
                    onAssignmentsChange={mockOnAssignmentsChange}
                />
            );

            // Rerender with a new callback reference (this used to cause infinite loop)
            const newCallback = vi.fn();
            rerender(
                <CycleWeekEditor
                    weeks={1}
                    onAssignmentsChange={newCallback}
                />
            );

            // Wait a bit to ensure no infinite loop
            await new Promise(resolve => setTimeout(resolve, 100));

            // The NEW callback should not be called excessively (test the actual new callback now used)
            expect(newCallback.mock.calls.length).toBeLessThan(5);
        });

        it('should only call onAssignmentsChange when assignments actually change', async () => {
            const user = userEvent.setup();
            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            const initialCallCount = mockOnAssignmentsChange.mock.calls.length;

            await waitFor(() => {
                expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
            });

            // Make an actual change
            const firstDaySelect = screen.getAllByRole('combobox')[0];
            await user.selectOptions(firstDaySelect, 'rest');

            // Should be called one more time for the change
            expect(mockOnAssignmentsChange.mock.calls.length).toBeGreaterThan(initialCallCount);
            expect(mockOnAssignmentsChange.mock.calls.length).toBeLessThan(initialCallCount + 10);
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing user gracefully', () => {
            // Temporarily set user to null for this test
            const originalUser = mockAuthContext.user;
            mockAuthContext.user = null;

            const { unmount } = render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(screen.getByText('Week 1')).toBeInTheDocument();
            unmount();

            // Restore user after test
            mockAuthContext.user = originalUser;
        });

        it('should handle database error when loading routines', async () => {
            mockSupabase.order.mockImplementationOnce(() =>
                Promise.resolve({ data: null, error: new Error('Database error') })
            );

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            render(<CycleWeekEditor weeks={1} onAssignmentsChange={mockOnAssignmentsChange} />);

            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalled();
            });

            consoleErrorSpy.mockRestore();
        });

        it('should cleanup on unmount', () => {
            const { unmount } = render(<CycleWeekEditor weeks={2} onAssignmentsChange={mockOnAssignmentsChange} />);

            expect(() => unmount()).not.toThrow();
        });
    });
});
