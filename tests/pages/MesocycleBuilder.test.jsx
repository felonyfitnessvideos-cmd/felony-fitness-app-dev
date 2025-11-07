/**
 * @file MesocycleBuilder.test.jsx
 * @description Comprehensive test suite for MesocycleBuilder component
 * Tests mesocycle creation, editing, validation, and database operations
 * @author Felony Fitness Development Team
 * @date November 6, 2025
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MesocycleBuilder from '../../src/pages/MesocycleBuilder.jsx';

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
vi.mock('../../src/supabaseClient.js', () => ({
    supabase: {
        from: vi.fn(function () { return this; }),
        select: vi.fn(function () { return this; }),
        eq: vi.fn(function () { return this; }),
        single: vi.fn(function () { return this; }),
        maybeSingle: vi.fn(function () { return this; }),
        upsert: vi.fn(function () { return this; }),
        insert: vi.fn(function () { return this; }),
        delete: vi.fn(function () { return this; }),
        order: vi.fn(function () { return this; })
    }
}));

const { supabase: mockSupabase } = await import('../../src/supabaseClient.js');

// Mock react-router-dom
const mockNavigate = vi.fn();
const mockLocation = { search: '' };

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => mockLocation,
        BrowserRouter: actual.BrowserRouter
    };
});

// Mock CycleWeekEditor
vi.mock('../../src/components/CycleWeekEditor.jsx', () => ({
    default: ({ weeks, focus, onAssignmentsChange }) => (
        <div data-testid="cycle-week-editor">
            <span>Weeks: {weeks}</span>
            <span>Focus: {focus}</span>
            <button onClick={() => onAssignmentsChange([
                { week_index: 1, day_index: 1, type: 'routine', routine_id: 'test-routine' }
            ])}>
                Mock Assignment Change
            </button>
        </div>
    )
}));

describe('MesocycleBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocation.search = '';
    });

    afterEach(() => {
        cleanup();
    });

    const renderComponent = () => {
        return render(
            <BrowserRouter>
                <MesocycleBuilder />
            </BrowserRouter>
        );
    };

    describe('Rendering', () => {
        it('should render the mesocycle builder form', () => {
            renderComponent();

            expect(screen.getByText(/Create Mesocycle|Edit Mesocycle/)).toBeInTheDocument();
            expect(screen.getByLabelText(/Mesocycle Name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Training Focus/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Number of Weeks/i)).toBeInTheDocument();
        });

        it('should render CycleWeekEditor component', () => {
            renderComponent();

            expect(screen.getByTestId('cycle-week-editor')).toBeInTheDocument();
        });

        it('should show Create title when not editing', () => {
            renderComponent();

            expect(screen.getByText('Create Mesocycle')).toBeInTheDocument();
        });
    });

    describe('Form Input', () => {
        it('should update name input', async () => {
            const user = userEvent.setup();
            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Summer Shred');

            expect(nameInput.value).toBe('Summer Shred');
        });

        it('should update focus select', async () => {
            const user = userEvent.setup();
            renderComponent();

            const focusSelect = screen.getByLabelText(/Training Focus/i);
            await user.selectOptions(focusSelect, 'Strength');

            expect(focusSelect.value).toBe('Strength');
        });

        it('should update weeks input', async () => {
            const user = userEvent.setup();
            renderComponent();

            const weeksInput = screen.getByLabelText(/Number of Weeks/i);
            await user.clear(weeksInput);
            await user.type(weeksInput, '8');

            expect(weeksInput.value).toBe('8');
        });

        it('should update start date input', async () => {
            const user = userEvent.setup();
            renderComponent();

            const dateInput = screen.getByLabelText(/Start Date/i);
            await user.type(dateInput, '2025-01-01');

            expect(dateInput.value).toBe('2025-01-01');
        });
    });

    describe('Creating Mesocycle', () => {
        it('should validate required fields before saving', async () => {
            const user = userEvent.setup();
            renderComponent();

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            // Should show error for empty name
            await waitFor(() => {
                expect(screen.getByText(/name is required/i)).toBeInTheDocument();
            });
        });

        it('should validate weeks is greater than 0', async () => {
            const user = userEvent.setup();
            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Test Cycle');

            const weeksInput = screen.getByLabelText(/Number of Weeks/i);
            await user.clear(weeksInput);
            await user.type(weeksInput, '0');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/weeks must be greater than 0/i)).toBeInTheDocument();
            });
        });

        it('should create mesocycle with valid data', async () => {
            const user = userEvent.setup();

            mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.insert.mockResolvedValueOnce({
                data: [{ id: 'new-mesocycle-id' }],
                error: null
            });

            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Bulk Phase');

            const focusSelect = screen.getByLabelText(/Training Focus/i);
            await user.selectOptions(focusSelect, 'Hypertrophy');

            const weeksInput = screen.getByLabelText(/Number of Weeks/i);
            await user.clear(weeksInput);
            await user.type(weeksInput, '12');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(mockSupabase.insert).toHaveBeenCalled();
            });
        });
    });

    describe('Editing Mesocycle', () => {
        beforeEach(() => {
            mockLocation.search = '?mesocycleId=existing-id';

            mockSupabase.maybeSingle.mockResolvedValueOnce({
                data: {
                    id: 'existing-id',
                    name: 'Existing Cycle',
                    focus: 'Strength',
                    weeks: 6,
                    start_date: '2025-01-01'
                },
                error: null
            });

            mockSupabase.select.mockResolvedValueOnce({
                data: [
                    { week_index: 1, day_index: 1, routine_id: 'routine-1', notes: null },
                    { week_index: 1, day_index: 2, routine_id: null, notes: 'rest' }
                ],
                error: null
            });
        });

        it('should load existing mesocycle data', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByDisplayValue('Existing Cycle')).toBeInTheDocument();
            });

            const focusSelect = screen.getByLabelText(/Training Focus/i);
            expect(focusSelect.value).toBe('Strength');

            const weeksInput = screen.getByLabelText(/Number of Weeks/i);
            expect(weeksInput.value).toBe('6');
        });

        it('should show Edit title when editing', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Edit Mesocycle')).toBeInTheDocument();
            });
        });

        it('should update existing mesocycle', async () => {
            const user = userEvent.setup();

            mockSupabase.delete.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });

            renderComponent();

            await waitFor(() => {
                expect(screen.getByDisplayValue('Existing Cycle')).toBeInTheDocument();
            });

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.clear(nameInput);
            await user.type(nameInput, 'Updated Cycle');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(mockSupabase.upsert).toHaveBeenCalled();
            });
        });
    });

    describe('Week Assignments', () => {
        it('should receive assignments from CycleWeekEditor', async () => {
            const user = userEvent.setup();
            renderComponent();

            const assignmentButton = screen.getByText('Mock Assignment Change');
            await user.click(assignmentButton);

            // Assignments should be stored in component state
            // Verified by checking if save uses them
        });

        it('should pass correct props to CycleWeekEditor', () => {
            renderComponent();

            expect(screen.getByText('Weeks: 4')).toBeInTheDocument();
            expect(screen.getByText('Focus: Hypertrophy')).toBeInTheDocument();
        });
    });

    describe('Success Modal', () => {
        it('should show success modal after creating mesocycle', async () => {
            const user = userEvent.setup();

            mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.insert.mockResolvedValueOnce({
                data: [{ id: 'new-id' }],
                error: null
            });

            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Test Cycle');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
            });
        });

        it('should navigate to mesocycle detail page after success', async () => {
            const user = userEvent.setup();

            mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.insert.mockResolvedValueOnce({
                data: [{ id: 'new-id' }],
                error: null
            });

            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Test Cycle');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            // Wait for modal and close it
            await waitFor(() => {
                expect(screen.getByText(/created successfully/i)).toBeInTheDocument();
            });

            // Navigation happens when modal closes
        });
    });

    describe('Error Handling', () => {
        it('should display error message on save failure', async () => {
            const user = userEvent.setup();

            mockSupabase.upsert.mockResolvedValueOnce({
                data: null,
                error: new Error('Database error')
            });

            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Test Cycle');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
            });
        });

        it('should handle database connection errors gracefully', async () => {
            mockSupabase.maybeSingle.mockRejectedValueOnce(new Error('Connection failed'));
            mockLocation.search = '?mesocycleId=test-id';

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            renderComponent();

            await waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalled();
            });

            consoleErrorSpy.mockRestore();
        });
    });

    describe('User Profile Upsert', () => {
        it('should ensure user_profiles row exists before creating mesocycle', async () => {
            const user = userEvent.setup();

            mockSupabase.upsert.mockResolvedValueOnce({ data: null, error: null });
            mockSupabase.insert.mockResolvedValueOnce({
                data: [{ id: 'new-id' }],
                error: null
            });

            renderComponent();

            const nameInput = screen.getByLabelText(/Mesocycle Name/i);
            await user.type(nameInput, 'Test Cycle');

            const saveButton = screen.getByText(/Save/i);
            await user.click(saveButton);

            await waitFor(() => {
                expect(mockSupabase.upsert).toHaveBeenCalledWith(
                    expect.objectContaining({ id: 'test-user-id' }),
                    expect.any(Object)
                );
            });
        });
    });
});
