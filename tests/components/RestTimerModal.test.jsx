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
    let mockOnComplete;
    let mockOnClose;
    let mockOnUpdate;

    beforeEach(() => {
        mockOnComplete = vi.fn();
        mockOnClose = vi.fn();
        mockOnUpdate = vi.fn();
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
                    initialSeconds={90}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/1:30/i)).toBeInTheDocument();
        });

        it('should display formatted time correctly', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={125}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/2:05/i)).toBeInTheDocument();
        });

        it('should not render when isOpen is false', () => {
            const { container } = render(
                <RestTimerModal
                    isOpen={false}
                    initialSeconds={90}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('Timer Countdown', () => {
        it('should countdown when timer is started', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={10}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            const startButton = screen.getByRole('button', { name: /start|begin/i });
            await userEvent.click(startButton);

            // Fast-forward 3 seconds
            vi.advanceTimersByTime(3000);

            await waitFor(() => {
                expect(screen.getByText(/0:07/i)).toBeInTheDocument();
            });
        });

        it('should call onComplete when timer reaches zero', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={3}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            const startButton = screen.getByRole('button', { name: /start|begin/i });
            await userEvent.click(startButton);

            // Fast-forward past completion
            vi.advanceTimersByTime(4000);

            await waitFor(() => {
                expect(mockOnComplete).toHaveBeenCalled();
            });
        });

        it('should display completion UI when timer finishes', async () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={2}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            const startButton = screen.getByRole('button', { name: /start|begin/i });
            await userEvent.click(startButton);

            vi.advanceTimersByTime(3000);

            await waitFor(() => {
                expect(screen.getByText(/complete|done|finished/i)).toBeInTheDocument();
            });
        });
    });

    describe('Time Adjustment Controls', () => {
        it('should increase time when add button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={60}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                    onUpdate={mockOnUpdate}
                />
            );

            const addButton = screen.getByRole('button', { name: /\+|add|increase/i });
            await user.click(addButton);

            await waitFor(() => {
                expect(screen.getByText(/1:15|1:30/i)).toBeInTheDocument();
            });
        });

        it('should decrease time when subtract button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={90}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                    onUpdate={mockOnUpdate}
                />
            );

            const subtractButton = screen.getByRole('button', { name: /-|subtract|decrease/i });
            await user.click(subtractButton);

            await waitFor(() => {
                expect(screen.getByText(/1:15|1:00/i)).toBeInTheDocument();
            });
        });

        it('should call onUpdate when time is adjusted', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={60}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                    onUpdate={mockOnUpdate}
                />
            );

            const addButton = screen.getByRole('button', { name: /\+|add|increase/i });
            await user.click(addButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalled();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero initial time', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={0}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText(/0:00/i)).toBeInTheDocument();
        });

        it('should handle negative time gracefully', () => {
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={-10}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            // Should not crash, and should display 0:00 or handle gracefully
            expect(screen.getByText(/0:00/i)).toBeInTheDocument();
        });

        it('should prevent time from going below zero on subtraction', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={5}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            const subtractButton = screen.getByRole('button', { name: /-|subtract|decrease/i });
            
            // Try to subtract more than available time
            await user.click(subtractButton);
            await user.click(subtractButton);

            // Time should not go negative
            const timeDisplay = screen.getByText(/0:\d{2}/);
            expect(timeDisplay).toBeInTheDocument();
        });
    });

    describe('Callback Invocations', () => {
        it('should call onClose when close button is clicked', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={60}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                />
            );

            const closeButton = screen.getByRole('button', { name: /close|×/i });
            await user.click(closeButton);

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should pass correct time value to onUpdate', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={60}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                    onUpdate={mockOnUpdate}
                />
            );

            const addButton = screen.getByRole('button', { name: /\+|add|increase/i });
            await user.click(addButton);

            await waitFor(() => {
                expect(mockOnUpdate).toHaveBeenCalledWith(expect.any(Number));
                const newTime = mockOnUpdate.mock.calls[0][0];
                expect(newTime).toBeGreaterThan(60);
            });
        });
    });

    describe('Rapid Adjustments', () => {
        it('should handle rapid time adjustments without breaking', async () => {
            const user = userEvent.setup({ delay: null });
            render(
                <RestTimerModal
                    isOpen={true}
                    initialSeconds={60}
                    onComplete={mockOnComplete}
                    onClose={mockOnClose}
                    onUpdate={mockOnUpdate}
                />
            );

            const addButton = screen.getByRole('button', { name: /\+|add|increase/i });
            
            // Rapidly click multiple times
            await user.click(addButton);
            await user.click(addButton);
            await user.click(addButton);

            // Should still display a valid time
            expect(screen.getByText(/\d+:\d{2}/)).toBeInTheDocument();
        });
    });
});
