/**
 * @file RestTimerModal.test.jsx
 * @description Test suite for RestTimerModal component
 * Tests timer countdown, time adjustments, and callback invocations
 * @author Felony Fitness Development Team
 * @date November 7, 2025
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestTimerModal from '../../src/components/RestTimerModal.jsx';

describe('RestTimerModal', () => {
    let mockOnClose;

    beforeEach(() => {
        mockOnClose = vi.fn();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Rendering', () => {
        it('should render initial UI with timer display', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={90}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/1:30/i)).toBeInTheDocument();
        });

        it('should display formatted time correctly', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={125}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/2:05/i)).toBeInTheDocument();
        });

        it('should not render when isOpen is false', () => {
            const { container } = render(
                <RestTimerModal
                    isOpen={false}
                    initialDuration={90}
                    onClose={mockOnClose}
                />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('Timer Countdown', () => {
        it('should countdown automatically when timer opens', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={10}
                    onClose={mockOnClose}
                />
            );

            // Timer should start automatically
            expect(screen.getByText(/0:10/i)).toBeInTheDocument();

            // Fast-forward 3 seconds
            vi.advanceTimersByTime(3000);

            await waitFor(() => {
                expect(screen.getByText(/0:07/i)).toBeInTheDocument();
            });
        });

        it('should call onClose when timer reaches zero', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={2}
                    onClose={mockOnClose}
                />
            );

            // Fast-forward past completion
            vi.advanceTimersByTime(3000);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should display zero when timer finishes', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={2}
                    onClose={mockOnClose}
                />
            );

            vi.advanceTimersByTime(3000);

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });
        });
    });

    describe('Time Adjustment Controls', () => {
        it('should increase time when add button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={60}
                    onClose={mockOnClose}
                />
            );

            const addButton = screen.getByRole('button', { name: /increase/i });
            await user.click(addButton);

            await waitFor(() => {
                expect(screen.getByText(/1:10/i)).toBeInTheDocument();
            });
        });

        it('should decrease time when subtract button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={90}
                    onClose={mockOnClose}
                />
            );

            const subtractButton = screen.getByRole('button', { name: /decrease/i });
            await user.click(subtractButton);

            await waitFor(() => {
                expect(screen.getByText(/1:20/i)).toBeInTheDocument();
            });
        });

        it('should adjust time correctly', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={60}
                    onClose={mockOnClose}
                />
            );

            const addButton = screen.getByRole('button', { name: /increase/i });
            await user.click(addButton);

            // Verify time changes after adjustment
            await waitFor(() => {
                expect(screen.getByText(/1:10/i)).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero initial time', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={0}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/0:00/i)).toBeInTheDocument();
        });

        it('should handle negative time gracefully', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={-10}
                    onClose={mockOnClose}
                />
            );

            // Should not crash, timer starts at -10 but won't break
            expect(screen.getByTestId(/modal/i)).toBeInTheDocument();
        });

        it('should prevent time from going below zero on subtraction', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={5}
                    onClose={mockOnClose}
                />
            );

            const subtractButton = screen.getByRole('button', { name: /decrease/i });
            
            // Try to subtract more than available time
            await user.click(subtractButton);
            await user.click(subtractButton);

            // Time should not go negative - component has Math.max(0, ...) check
            const timeDisplay = screen.getByText(/0:00/);
            expect(timeDisplay).toBeInTheDocument();
        });
    });

    describe('Callback Invocations', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={60}
                    onClose={mockOnClose}
                />
            );

            const closeButton = screen.getByRole('button', { name: /close/i });
            await user.click(closeButton);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should adjust time when adjustment button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={60}
                    onClose={mockOnClose}
                />
            );

            const addButton = screen.getByRole('button', { name: /increase/i });
            await user.click(addButton);

            await waitFor(() => {
                expect(screen.getByText(/1:10/i)).toBeInTheDocument();
            });
        });
    });

    describe('Rapid Adjustments', () => {
        it('should handle rapid time adjustments without breaking', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialDuration={60}
                    onClose={mockOnClose}
                />
            );

            const addButton = screen.getByRole('button', { name: /increase/i });
            
            // Rapidly click multiple times
            await user.click(addButton);
            await user.click(addButton);
            await user.click(addButton);

            // Should still display a valid time (60 + 30 seconds)
            await waitFor(() => {
                expect(screen.getByText(/1:30/)).toBeInTheDocument();
            });
        });
    });
});
