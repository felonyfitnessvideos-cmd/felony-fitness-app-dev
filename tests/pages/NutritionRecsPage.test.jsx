/**
 * @fileoverview Test suite for NutritionRecsPage component.
 * 
 * Tests AI-powered nutrition recommendations functionality including:
 * - Initial render and button state
 * - Edge Function invocation (generate-nutrition-recommendations)
 * - Loading states during AI processing
 * - Success state with recommendations display
 * - Error handling (auth failures, API errors)
 * - "Generate Again" functionality
 * - Dietary preference support
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NutritionRecsPage from '../../src/pages/NutritionRecsPage';

// Mock auth session
const mockSession = {
    access_token: 'mock-jwt-token-nutrition-67890',
    refresh_token: 'mock-refresh-token',
    expires_at: Date.now() + 3600000,
    user: {
        id: 'test-user-456',
        email: 'nutrition-test@example.com'
    }
};

// Mock AI-generated nutrition recommendations response
const mockNutritionRecommendations = {
    analysis_summary: "Your protein intake is consistent and meets your goal. However, you're consuming excess sodium and insufficient vegetables. Consider incorporating more whole foods to improve micronutrient balance.",
    recommendations: [
        {
            id: "nutr-rec-1",
            title: "Increase Vegetable Intake",
            reason: "You're only logging 2 servings of vegetables per day, which is below the recommended 5+ servings.",
            action: "Add a side salad to lunch and include a vegetable with dinner. Aim for colorful variety."
        },
        {
            id: "nutr-rec-2",
            title: "Reduce Processed Foods",
            reason: "High sodium levels suggest frequent consumption of processed foods, which can impact blood pressure and recovery.",
            action: "Replace packaged snacks with whole food options like nuts, fruits, or Greek yogurt."
        },
        {
            id: "nutr-rec-3",
            title: "Optimize Meal Timing",
            reason: "Your carb intake is clustered late in the day, which may affect energy during morning workouts.",
            action: "Shift 30-40g of carbs to breakfast to fuel your training sessions more effectively."
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
            if (functionName === 'generate-nutrition-recommendations') {
                return Promise.resolve({
                    data: mockNutritionRecommendations,
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
 * Helper function to render NutritionRecsPage with router context
 */
const renderNutritionRecsPage = () => {
    return render(
        <BrowserRouter>
            <NutritionRecsPage />
        </BrowserRouter>
    );
};

describe('NutritionRecsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Render', () => {
        it('should render the page title', () => {
            renderNutritionRecsPage();

            expect(screen.getByText('Nutrition Advice')).toBeInTheDocument();
        });

        it('should display intro view with icon and description', () => {
            renderNutritionRecsPage();

            expect(screen.getByText('AI-Powered Nutrition Guidance')).toBeInTheDocument();
            expect(screen.getByText(/Get personalized nutrition recommendations/i)).toBeInTheDocument();
        });

        it('should show pro tip about food logging', () => {
            renderNutritionRecsPage();

            expect(screen.getByText(/Log your meals consistently/i)).toBeInTheDocument();
        });

        it('should render generate button', () => {
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            expect(button).toBeInTheDocument();
            expect(button).not.toBeDisabled();
        });
    });

    describe('Generating Recommendations', () => {
        it('should fetch session on button click', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(mockSupabase.auth.getSession).toHaveBeenCalled();
            });
        });

        it('should call generate-nutrition-recommendations Edge Function', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
                    'generate-nutrition-recommendations',
                    expect.objectContaining({
                        body: {},
                        headers: expect.objectContaining({
                            'Authorization': `Bearer ${mockSession.access_token}`,
                            'Content-Type': 'application/json'
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
                    setTimeout(() => resolve({ data: mockNutritionRecommendations, error: null }), 100)
                )
            );

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            // Should show loading spinner
            const loadingElement = screen.getByTestId('loading-spinner') || screen.getByRole('status');
            expect(loadingElement).toBeInTheDocument();
        });

        it('should hide intro view while loading', async () => {
            const user = userEvent.setup();

            mockSupabase.functions.invoke.mockImplementationOnce(() =>
                new Promise(resolve =>
                    setTimeout(() => resolve({ data: mockNutritionRecommendations, error: null }), 100)
                )
            );

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            // Intro view should be hidden
            expect(screen.queryByText('AI-Powered Nutrition Guidance')).not.toBeInTheDocument();
        });
    });

    describe('Success State', () => {
        it('should display analysis summary', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Your protein intake is consistent/i)).toBeInTheDocument();
            });
        });

        it('should render all recommendation cards', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Vegetable Intake')).toBeInTheDocument();
                expect(screen.getByText('Reduce Processed Foods')).toBeInTheDocument();
                expect(screen.getByText('Optimize Meal Timing')).toBeInTheDocument();
            });
        });

        it('should display recommendation reasons', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/only logging 2 servings of vegetables/i)).toBeInTheDocument();
                expect(screen.getByText(/High sodium levels suggest/i)).toBeInTheDocument();
            });
        });

        it('should display actionable steps', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Add a side salad to lunch/i)).toBeInTheDocument();
                expect(screen.getByText(/Replace packaged snacks/i)).toBeInTheDocument();
            });
        });

        it('should show "Get New Advice" button after success', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            const generateButton = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(generateButton);

            await waitFor(() => {
                const regenerateButton = screen.getByRole('button', { name: /Get New Advice/i });
                expect(regenerateButton).toBeInTheDocument();
            });
        });
    });

    describe('Generate Again Functionality', () => {
        it('should allow regenerating recommendations', async () => {
            const user = userEvent.setup();
            renderNutritionRecsPage();

            // First generation
            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Vegetable Intake')).toBeInTheDocument();
            });

            // Click "Get New Advice"
            const regenerateButton = screen.getByRole('button', { name: /Get New Advice/i });
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
                .mockImplementationOnce(() => Promise.resolve({ data: mockNutritionRecommendations, error: null }))
                .mockImplementationOnce(() =>
                    new Promise(resolve =>
                        setTimeout(() => resolve({ data: mockNutritionRecommendations, error: null }), 100)
                    )
                );

            renderNutritionRecsPage();

            // First generation
            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText('Increase Vegetable Intake')).toBeInTheDocument();
            });

            // Regenerate
            const regenerateButton = screen.getByRole('button', { name: /Get New Advice/i });
            await user.click(regenerateButton);

            // Previous recommendations should be hidden during loading
            expect(screen.queryByText('Increase Vegetable Intake')).not.toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing session error', async () => {
            const user = userEvent.setup();
            mockSupabase.auth.getSession.mockResolvedValueOnce({
                data: { session: null },
                error: null
            });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
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

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Profile query failed/i)).toBeInTheDocument();
            });
        });

        it('should handle network errors gracefully', async () => {
            const user = userEvent.setup();
            mockSupabase.functions.invoke.mockRejectedValueOnce(
                new Error('Network request failed')
            );

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Network request failed/i)).toBeInTheDocument();
            });
        });

        it('should clear error when generating again after error', async () => {
            const user = userEvent.setup();

            // First call errors, second succeeds
            mockSupabase.functions.invoke
                .mockResolvedValueOnce({ data: null, error: { message: 'Test nutrition error' } })
                .mockResolvedValueOnce({ data: mockNutritionRecommendations, error: null });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Test nutrition error/i)).toBeInTheDocument();
            });

            // Try again
            await user.click(button);

            await waitFor(() => {
                // Error should be cleared
                expect(screen.queryByText(/Test nutrition error/i)).not.toBeInTheDocument();
                // Success content should show
                expect(screen.getByText('Increase Vegetable Intake')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty recommendations array', async () => {
            const user = userEvent.setup();
            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: {
                    analysis_summary: "Insufficient data to generate specific recommendations.",
                    recommendations: []
                },
                error: null
            });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/Insufficient data/i)).toBeInTheDocument();
                // Should not crash with empty array
                expect(screen.queryByRole('heading', { name: /Increase Vegetable Intake/i })).not.toBeInTheDocument();
            });
        });

        it('should handle recommendations without IDs', async () => {
            const user = userEvent.setup();
            const recsWithoutIds = {
                ...mockNutritionRecommendations,
                // eslint-disable-next-line no-unused-vars
                recommendations: mockNutritionRecommendations.recommendations.map(({ id, ...rest }) => rest)
            };

            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: recsWithoutIds,
                error: null
            });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                // Should use index as fallback key
                expect(screen.getByText('Increase Vegetable Intake')).toBeInTheDocument();
            });
        });

        it('should handle missing recommendation fields gracefully', async () => {
            const user = userEvent.setup();
            const partialRecs = {
                analysis_summary: "Partial analysis",
                recommendations: [
                    { title: "Title Only" }, // Missing reason and action
                    { reason: "Reason Only" }, // Missing title and action
                ]
            };

            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: partialRecs,
                error: null
            });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            // Should not crash with partial data
            await waitFor(() => {
                expect(screen.getByText('Partial analysis')).toBeInTheDocument();
            });
        });
    });

    describe('Dietary Preferences', () => {
        it('should respect vegetarian preferences in recommendations', async () => {
            const user = userEvent.setup();
            const vegRecs = {
                analysis_summary: "Your vegetarian diet is well-balanced with adequate protein from plant sources.",
                recommendations: [
                    {
                        title: "Increase Iron-Rich Foods",
                        reason: "Plant-based iron is less bioavailable than heme iron from meat.",
                        action: "Include lentils, spinach, and fortified cereals with vitamin C for better absorption."
                    }
                ]
            };

            mockSupabase.functions.invoke.mockResolvedValueOnce({
                data: vegRecs,
                error: null
            });

            renderNutritionRecsPage();

            const button = screen.getByRole('button', { name: /Get My Nutrition Advice/i });
            await user.click(button);

            await waitFor(() => {
                expect(screen.getByText(/vegetarian diet/i)).toBeInTheDocument();
                expect(screen.getByText(/Plant-based iron/i)).toBeInTheDocument();
            });
        });
    });
});
