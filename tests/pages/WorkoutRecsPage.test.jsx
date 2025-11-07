/**
 * @fileoverview Test suite for WorkoutRecsPage component.
 * 
 * Tests AI-powered workout recommendations functionality including:
 * - Initial render and button state
 * - Edge Function invocation (generate-workout-recommendations)
 * - Loading states during AI processing
 * - Success state with recommendations display
 * - Error handling (auth failures, API errors)
 * - "Generate Again" functionality
 * - UI layout and styling
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WorkoutRecsPage from '../../src/pages/WorkoutRecsPage';

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

// Mock auth session
const mockSession = {
    access_token: 'mock-jwt-token-12345',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000,
    user: mockUser
};

// Mock AI-generated recommendations response
const mockRecommendations = {
    analysis_summary: "Your training consistency is excellent with 4 workouts per week. However, your protein intake is slightly below your goal, which may impact muscle recovery. Consider increasing protein-rich foods to support your build muscle goal.",
    recommendations: [
        {
            id: "rec-1",
            title: "Increase Training Volume",
            reason: "Your goal is to build muscle, but current volume may be insufficient for optimal hypertrophy.",
            action: "Add 2-3 more sets per muscle group each week, focusing on compound movements."
        },
        {
            id: "rec-2",
            title: "Optimize Protein Timing",
            reason: "You're averaging 150g protein daily, but your goal is 180g. This deficit may limit muscle growth.",
            action: "Add a protein shake post-workout and increase protein portions at dinner."
        },
        {
            id: "rec-3",
            title: "Implement Progressive Overload",
            reason: "Consistent weight progression is key for your build muscle goal.",
            action: "Increase weight by 2.5-5lbs each week when you can complete all sets with good form."
        }
    ]
};

// Mock Supabase client
const mockSupabase = {
    auth: {
        getSession: vi.fn(() =>
            Promise.resolve({
                data: { session: mockSession },
                error: null
            })
        )
    },
    functions: {
        invoke: vi.fn((functionName) => {
            if (functionName === 'generate-workout-recommendations') {
                return Promise.resolve({
                    data: mockRecommendations,
                    error: null
                });
            }
            return Promise.resolve({ data: null, error: null });
        })
    }
};

// Mock Supabase module
vi.mock('../../src/supabaseClient', () => ({
    supabase: mockSupabase
}));

/**
 * Helper function to render WorkoutRecsPage with required context
 */
const renderWorkoutRecsPage = () => {
    return render(
        <BrowserRouter>
            <WorkoutRecsPage />
        </BrowserRouter>
    );
};

describe('WorkoutRecsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Render', () => {
        it('should render the page title', () => {
            renderWorkoutRecsPage();

            expect(screen.getByText('Recommendations')).toBeInTheDocument();
        });

        it('should display intro view with icon and description', () => {
            renderWorkoutRecsPage();

            expect(screen.getByText('Personalized Insights')).toBeInTheDocument();
            expect(screen.getByText(/Get AI-powered recommendations/i)).toBeInTheDocument();
        });

        it('should show pro tip about logging', () => {
            renderWorkoutRecsPage();

            expect(screen.getByText(/The more you log, the smarter your recommendations/i)).toBeInTheDocument();
        });

        it('should render generate button', () => {
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            expect(button).toBeInTheDocument();
            expect(button).not.toBeDisabled();
        });

        it('should disable button when no user is authenticated', () => {
            // Temporarily set user to null for this test
            const originalUser = mockAuthContext.user;
            mockAuthContext.user = null;

            render(
                <BrowserRouter>
                    <WorkoutRecsPage />
                </BrowserRouter>
            );

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            expect(button).toBeDisabled();

            // Restore user after test
            mockAuthContext.user = originalUser;
        });
    });

    describe('Generating Recommendations', () => {
        it('should fetch session on button click', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(mockSupabase.auth.getSession).toHaveBeenCalled();
            });
        });

        it('should call generate-workout-recommendations Edge Function', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
                    'generate-workout-recommendations',
                    expect.objectContaining({
                        body: {},
                        headers: expect.objectContaining({
                            'Authorization': `Bearer ${mockSession.access_token}`
                        })
                    })
                );
            });
        });

        it('should show loading spinner while processing', async () => {
            const user = userEvent.setup();

            // Delay the function response to catch loading state
            mockSupabase.functions.invoke.mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: mockRecommendations, error: null }), 100)
                )
            );

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            // Should show loading spinner
            expect(screen.getByTestId('loading-spinner') || screen.getByRole('status')).toBeInTheDocument();
        });

        it('should hide intro view while loading', async () => {
            const user = userEvent.setup();

            mockSupabase.functions.invoke.mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: mockRecommendations, error: null }), 100)
                )
            );

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            // Intro view should be hidden
            expect(screen.queryByText('Personalized Insights')).not.toBeInTheDocument();
        });
    });

    describe('Success State', () => {
        it('should display analysis summary', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Your training consistency is excellent/i)).toBeInTheDocument();
            });
        });

        it('should render all recommendation cards', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Training Volume')).toBeInTheDocument();
                expect(screen.getByText('Optimize Protein Timing')).toBeInTheDocument();
                expect(screen.getByText('Implement Progressive Overload')).toBeInTheDocument();
            });
        });

        it('should display recommendation reasons', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Your goal is to build muscle/i)).toBeInTheDocument();
                expect(screen.getByText(/averaging 150g protein daily/i)).toBeInTheDocument();
            });
        });

        it('should display actionable steps', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Add 2-3 more sets per muscle group/i)).toBeInTheDocument();
                expect(screen.getByText(/Add a protein shake post-workout/i)).toBeInTheDocument();
            });
        });

        it('should show "Generate Again" button after success', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            const generateButton = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(generateButton);

            await waitFor(() => {
                const regenerateButton = screen.getByRole('button', { name: /Generate Again/i });
                expect(regenerateButton).toBeInTheDocument();
            });
        });
    });

    describe('Generate Again Functionality', () => {
        it('should allow regenerating recommendations', async () => {
            const user = userEvent.setup();
            renderWorkoutRecsPage();

            // First generation
            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Training Volume')).toBeInTheDocument();
            });

            // Click "Generate Again"
            const regenerateButton = screen.getByRole('button', { name: /Generate Again/i });
            await user.click(regenerateButton);

            // Should call Edge Function again
            await waitFor(() => {
                expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(2);
            });
        });

        it('should clear previous recommendations while regenerating', async () => {
            const user = userEvent.setup();

            // Mock delayed response
            mockSupabase.functions.invoke
                .mockImplementationOnce(() => Promise.resolve({ data: mockRecommendations, error: null }))
                .mockImplementationOnce(() =>
                    new Promise(resolve =>
                        setTimeout(() => resolve({ data: mockRecommendations, error: null }), 100)
                    )
                );

            renderWorkoutRecsPage();

            // First generation
            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Training Volume')).toBeInTheDocument();
            });

            // Regenerate
            const regenerateButton = screen.getByRole('button', { name: /Generate Again/i });
            await user.click(regenerateButton);

            // Previous recommendations should be hidden during loading
            expect(screen.queryByText('Increase Training Volume')).not.toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing session error', async () => {
            const user = userEvent.setup();
            mockSupabase.auth.getSession.mockResolvedValueOnce({
                data: { session: null },
                error: new Error('No session found')
            });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/You must be logged in/i)).toBeInTheDocument();
            });
        });

        it('should handle Edge Function error', async () => {
            const user = userEvent.setup();
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: null,
                error: { message: 'Profile query failed: User profile not found' }
            });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Error:/i)).toBeInTheDocument();
                expect(screen.getByText(/Profile query failed/i)).toBeInTheDocument();
            });
        });

        it('should handle network errors gracefully', async () => {
            const user = userEvent.setup();
            mockSupabase.functions.invoke.mockRejectedValueOnce(
                new Error('Network request failed')
            );

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Error:/i)).toBeInTheDocument();
            });
        });

        it('should clear error when generating again after error', async () => {
            const user = userEvent.setup();

            // First call errors, second succeeds
            mockSupabase.functions.invoke
                .mockResolvedValueOnce({ data: null, error: { message: 'Test error' } })
                .mockResolvedValueOnce({ data: mockRecommendations, error: null });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Error: Test error/i)).toBeInTheDocument();
            });

            // Try again
            await user.click(button);

            await waitFor(() => {
                // Error should be cleared
                expect(screen.queryByText(/Error: Test error/i)).not.toBeInTheDocument();
                // Success content should show
                expect(screen.getByText('Increase Training Volume')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty recommendations array', async () => {
            const user = userEvent.setup();
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: {
                    analysis_summary: "No recommendations at this time.",
                    recommendations: []
                },
                error: null
            });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/No recommendations at this time/i)).toBeInTheDocument();
                // Should not crash with empty array
                expect(screen.queryByRole('heading', { name: /Increase Training Volume/i })).not.toBeInTheDocument();
            });
        });

        it('should handle recommendations without IDs', async () => {
            const user = userEvent.setup();
            const recsWithoutIds = {
                ...mockRecommendations,
                // eslint-disable-next-line no-unused-vars
                recommendations: mockRecommendations.recommendations.map(({ id, ...rest }) => rest)
            };

            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: recsWithoutIds,
                error: null
            });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            await waitFor(() => {
                // Should use index as fallback key
                expect(screen.getByText('Increase Training Volume')).toBeInTheDocument();
            });
        });

        it('should handle missing recommendation fields gracefully', async () => {
            const user = userEvent.setup();
            const partialRecs = {
                analysis_summary: "Analysis summary",
                recommendations: [
                    { title: "Title Only" }, // Missing reason and action
                    { reason: "Reason Only" }, // Missing title and action
                ]
            };

            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: partialRecs,
                error: null
            });

            renderWorkoutRecsPage();

            const button = screen.getByRole('button', { name: /Generate My Recommendations/i });
            await user.click(button);

            // Should not crash with partial data
            await waitFor(() => {
                expect(screen.getByText('Analysis summary')).toBeInTheDocument();
            });
        });
    });
});
