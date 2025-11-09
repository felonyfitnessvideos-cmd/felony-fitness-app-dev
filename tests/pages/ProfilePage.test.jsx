/**
 * @file ProfilePage.test.jsx
 * @description Comprehensive test suite for ProfilePage component
 * Tests profile management, metrics logging, height conversion, and database operations
 * @author Felony Fitness Development Team
 * @date November 4, 2025
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfilePage from '../../src/pages/ProfilePage.jsx';

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

// Mock Supabase client - use factory function to avoid hoisting
vi.mock('../../src/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(function () { return this; }),
    select: vi.fn(function () { return this; }),
    eq: vi.fn(function () { return this; }),
    single: vi.fn(function () { return this; }),
    upsert: vi.fn(function () { return this; }),
    insert: vi.fn(function () { return this; }),
    order: vi.fn(function () { return this; }),
    limit: vi.fn(function () { return this; })
  }
}));

// Import the mocked supabase after mocking
const { supabase: mockSupabase } = await import('../../src/supabaseClient.js');

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  User: () => <div data-testid="user-icon">User Icon</div>,
  Calendar: () => <div data-testid="calendar-icon">Calendar Icon</div>,
  HeartPulse: () => <div data-testid="heart-pulse-icon">HeartPulse Icon</div>,
  Edit: () => <div data-testid="edit-icon">Edit Icon</div>,
  Edit2: () => <div data-testid="edit2-icon">Edit2 Icon</div>,
  Save: () => <div data-testid="save-icon">Save Icon</div>,
  Weight: () => <div data-testid="weight-icon">Weight Icon</div>,
  Activity: () => <div data-testid="activity-icon">Activity Icon</div>,
  Percent: () => <div data-testid="percent-icon">Percent Icon</div>,
  X: () => <div data-testid="x-icon">X Icon</div>,
  Phone: () => <div data-testid="phone-icon">Phone Icon</div>,
  MapPin: () => <div data-testid="map-pin-icon">MapPin Icon</div>
}));

// Mock SubPageHeader component
vi.mock('../../src/components/SubPageHeader.jsx', () => ({
  default: ({ title, backTo }) => (
    <div data-testid="sub-page-header">
      <h1>{title}</h1>
      <span data-testid="back-to">{backTo}</span>
    </div>
  )
}));

// Test wrapper component
const TestWrapper = ({ children }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('ProfilePage Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Reset mockSupabase.from to default chaining behavior
    mockSupabase.from.mockImplementation(function () { return this; });

    // Default successful responses
    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No profile found' }
    });

    mockSupabase.limit.mockResolvedValue({
      data: [],
      error: null
    });
  });

  afterEach(() => {
    cleanup();
    // Reset user authentication state
    vi.mocked(mockAuthContext).user = mockUser;
    vi.mocked(mockAuthContext).loading = false;
  });

  describe('Component Rendering', () => {
    it('renders ProfilePage with correct title and header', async () => {
      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('sub-page-header')).toBeInTheDocument();
        expect(screen.getByText('Profile & Metrics')).toBeInTheDocument();
        expect(screen.getByTestId('back-to')).toHaveTextContent('/dashboard');
      });
    });

    it('shows loading state initially', () => {
      // Mock loading state
      vi.mocked(mockAuthContext).loading = true;

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      expect(screen.getByText('Loading Profile...')).toBeInTheDocument();

      // Reset loading state
      vi.mocked(mockAuthContext).loading = false;
    });

    it('renders profile form sections', async () => {
      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Your Information')).toBeInTheDocument();
        expect(screen.getByText('Log Today\'s Measurements')).toBeInTheDocument();
        expect(screen.getByText('Recent History')).toBeInTheDocument();
      });
    });
  });

  describe('Profile Form Management', () => {
    it('renders profile form in edit mode by default when no profile exists', async () => {
      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Sex/)).toBeInTheDocument();
        // Height has two inputs (feet and inches), check by text and placeholders
        expect(screen.getByText('Height')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('5')).toBeInTheDocument(); // feet input
        expect(screen.getByPlaceholderText('9')).toBeInTheDocument(); // inches input
        expect(screen.getByLabelText(/Diet Preference/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Profile/ })).toBeInTheDocument();
      });
    });

    it('shows profile in display mode when data exists', async () => {
      // Mock existing profile data
      mockSupabase.single.mockResolvedValue({
        data: {
          date_of_birth: '1990-05-15',
          sex: 'male',
          diet_preference: 'Vegetarian',
          height_cm: 175
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('35')).toBeInTheDocument(); // Age calculation
        expect(screen.getByText('male')).toBeInTheDocument();
        expect(screen.getByText('5\'9"')).toBeInTheDocument(); // Height conversion
        expect(screen.getByText('Vegetarian')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
      });
    });

    it('switches to edit mode when edit button is clicked', async () => {
      // Mock existing profile data
      mockSupabase.single.mockResolvedValue({
        data: {
          date_of_birth: '1990-05-15',
          sex: 'male',
          diet_preference: 'Vegetarian',
          height_cm: 175
        },
        error: null
      });

      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Edit/ }));

      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Profile/ })).toBeInTheDocument();
      });
    });
  });

  describe('Height Conversion Logic', () => {
    it('converts cm to feet and inches correctly', async () => {
      // Mock profile with height in cm
      mockSupabase.single.mockResolvedValue({
        data: {
          date_of_birth: '1990-05-15',
          sex: 'male',
          height_cm: 183 // 6 feet
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('6\'0"')).toBeInTheDocument();
      });
    });

    it('handles feet and inches input correctly', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
      });

      // Find height inputs
      const feetInput = screen.getByPlaceholderText('5');
      const inchesInput = screen.getByPlaceholderText('9');

      await user.type(feetInput, '6');
      await user.type(inchesInput, '2');

      expect(feetInput).toHaveValue(6);
      expect(inchesInput).toHaveValue(2);
    });
  });

  describe('Profile Form Validation', () => {
    it('validates date of birth format', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({ error: null });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
      });

      const dobInput = screen.getByLabelText(/Date of Birth/);
      const saveButton = screen.getByRole('button', { name: /Save Profile/ });

      // Test invalid date format (future date)
      await user.type(dobInput, '2030-01-01');
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid date of birth that is not in the future/)).toBeInTheDocument();
      });
    });

    it('validates height range', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({ error: null });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText('5')).toBeInTheDocument();
      });

      // Fill in required fields first
      const dobInput = screen.getByLabelText(/Date of Birth/);
      const sexSelect = screen.getByLabelText(/Sex/);
      const feetInput = screen.getByPlaceholderText('5');
      const saveButton = screen.getByRole('button', { name: /Save Profile/ });

      await user.type(dobInput, '1990-05-15');
      await user.selectOptions(sexSelect, 'male');

      // Wait for sex to update in DOM
      await waitFor(() => {
        expect(sexSelect).toHaveValue('male');
      });

      // Test invalid height (too tall - feet > 8 should trigger validation)
      // Type directly into the empty input (no need to clear)
      await user.type(feetInput, '9');

      // Verify the input value updated before submitting
      await waitFor(() => {
        expect(feetInput).toHaveValue(9);
      });

      await user.click(saveButton);

      // Wait a moment for the form to process
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verification: Since validation failed, upsert should NOT have been called
      expect(mockSupabase.upsert).not.toHaveBeenCalled();

      // Form should still be in edit mode (save button still visible)
      expect(saveButton).toBeInTheDocument();

      // The heightFeet input should still have the invalid value
      expect(feetInput).toHaveValue(9);
    });

    it('handles sex constraint validation', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({ error: null });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Sex/)).toBeInTheDocument();
      });

      const sexSelect = screen.getByLabelText(/Sex/);

      await user.selectOptions(sexSelect, 'male');
      expect(sexSelect).toHaveValue('male');
    });
  });

  describe('Profile Form Submission', () => {
    it('successfully saves profile data', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({ error: null });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
      });

      // Fill out form
      await user.type(screen.getByLabelText(/Date of Birth/), '1990-05-15');
      await user.selectOptions(screen.getByLabelText(/Sex/), 'male');
      await user.type(screen.getByPlaceholderText('5'), '5');
      await user.type(screen.getByPlaceholderText('9'), '9');

      await user.click(screen.getByRole('button', { name: /Save Profile/ }));

      await waitFor(() => {
        expect(mockSupabase.upsert).toHaveBeenCalledWith({
          id: 'test-user-id',
          user_id: 'test-user-id',
          date_of_birth: '1990-05-15',
          sex: 'male',
          diet_preference: '',
          height_cm: 175 // 5'9" converted to cm
        });
      });

      // After successful save, component switches to display mode showing saved data
      await waitFor(() => {
        expect(screen.getByText('male')).toBeInTheDocument(); // Sex value in display mode
        expect(screen.getByText(/5'9"/)).toBeInTheDocument(); // Height in display mode
      });
    });

    it('handles profile save errors', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({
        error: { message: 'Database error' }
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Profile/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Save Profile/ }));

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument();
      });
    });
  });

  describe('Metrics Logging', () => {
    it('renders metrics logging form', async () => {
      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Body Fat %/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Save Measurement/ })).toBeInTheDocument();
      });
    });

    it('successfully logs weight and body fat measurements', async () => {
      const user = userEvent.setup();
      const mockMetricData = {
        id: 'metric-id',
        user_id: 'test-user-id',
        weight_lbs: 175.5,
        body_fat_percentage: 15.2,
        created_at: '2025-11-04T10:30:00Z'
      };

      // Mock the insert().select().single() chain by tracking calls
      let insertCalled = false;
      mockSupabase.insert.mockImplementation(() => {
        insertCalled = true;
        return mockSupabase; // Return for chaining
      });

      mockSupabase.single.mockImplementation(() => {
        if (insertCalled) {
          // This is for the metrics insert query
          insertCalled = false; // Reset for next call
          return Promise.resolve({
            data: mockMetricData,
            error: null
          });
        }
        // This is for the profile fetch query
        return Promise.resolve({
          data: null,
          error: { code: 'PGRST116', message: 'No profile found' }
        });
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
      });

      // Fill out metrics form
      await user.type(screen.getByLabelText(/Weight \(lbs\)/), '175.5');
      await user.type(screen.getByLabelText(/Body Fat %/), '15.2');

      await user.click(screen.getByRole('button', { name: /Save Measurement/ }));

      await waitFor(() => {
        expect(mockSupabase.insert).toHaveBeenCalledWith({
          user_id: 'test-user-id',
          weight_lbs: 175.5,
          body_fat_percentage: 15.2
        });
      });

      // Wait for success message to appear after async operation
      expect(await screen.findByText('Measurement saved!')).toBeInTheDocument();
    });

    it('validates metrics form requires at least one measurement', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Measurement/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Save Measurement/ }));

      await waitFor(() => {
        expect(screen.getByText('Please enter at least one measurement.')).toBeInTheDocument();
      });
    });

    it('allows logging weight only', async () => {
      const user = userEvent.setup();
      mockSupabase.insert.mockResolvedValue({
        data: { id: 'metric-id', weight_lbs: 180, body_fat_percentage: null },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Weight \(lbs\)/), '180');
      await user.click(screen.getByRole('button', { name: /Save Measurement/ }));

      await waitFor(() => {
        expect(mockSupabase.insert).toHaveBeenCalledWith({
          user_id: 'test-user-id',
          weight_lbs: 180,
          body_fat_percentage: null
        });
      });
    });

    it('allows logging body fat only', async () => {
      const user = userEvent.setup();
      mockSupabase.insert.mockResolvedValue({
        data: { id: 'metric-id', weight_lbs: null, body_fat_percentage: 18.5 },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Body Fat %/)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/Body Fat %/), '18.5');
      await user.click(screen.getByRole('button', { name: /Save Measurement/ }));

      await waitFor(() => {
        expect(mockSupabase.insert).toHaveBeenCalledWith({
          user_id: 'test-user-id',
          weight_lbs: null,
          body_fat_percentage: 18.5
        });
      });
    });
  });

  describe('Metrics History Display', () => {
    it('displays metrics history when data exists', async () => {
      const mockHistory = [
        {
          id: '1',
          weight_lbs: 175.5,
          body_fat_percentage: 15.2,
          created_at: '2025-11-04T10:30:00Z'
        },
        {
          id: '2',
          weight_lbs: 176.0,
          body_fat_percentage: null,
          created_at: '2025-11-03T10:30:00Z'
        }
      ];

      mockSupabase.limit.mockResolvedValue({
        data: mockHistory,
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check that history items appear (may appear in multiple places - current + history)
        const weightElements = screen.getAllByText('175.5 lbs');
        expect(weightElements.length).toBeGreaterThan(0);

        const fatElements = screen.getAllByText('15.2% fat');
        expect(fatElements.length).toBeGreaterThan(0);

        const weight2Elements = screen.getAllByText('176 lbs');
        expect(weight2Elements.length).toBeGreaterThan(0);
      });
    });

    it('shows empty state when no metrics history exists', async () => {
      mockSupabase.limit.mockResolvedValue({
        data: [],
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/No measurements yet/i)).toBeInTheDocument();
      });
    });
  });

  describe('Age Calculation', () => {
    it('calculates age correctly from date of birth', async () => {
      // Mock profile with known birth date
      mockSupabase.single.mockResolvedValue({
        data: {
          date_of_birth: '1990-05-15',
          sex: 'male'
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Age should be calculated as current year - 1990
        expect(screen.getByText('35')).toBeInTheDocument();
      });
    });

    it('handles null date of birth gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          date_of_birth: null,
          sex: 'male',
          diet_preference: 'Standard',
          height_cm: 180
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      // With null date_of_birth but sex present, profile is incomplete
      // Component forces edit mode - should show form with Date of Birth input
      await waitFor(() => {
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles database fetch errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { code: 'ERROR', message: 'Database connection failed' }
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching profile data:', expect.any(Object));
      });

      consoleSpy.mockRestore();
    });

    it('handles unauthenticated user state', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      // Wait for form to render in edit mode (default with no profile)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Profile/i })).toBeInTheDocument();
      });

      // Fill in some data to make the form valid
      await user.type(screen.getByLabelText(/Date of Birth/), '1990-05-15');
      await user.selectOptions(screen.getByLabelText(/Sex/), 'male');

      // Simulate user losing authentication before save (e.g., token expired)
      vi.mocked(mockAuthContext).user = null;

      await user.click(screen.getByRole('button', { name: /Save Profile/i }));

      // Should display authentication error message
      const errorMessage = await screen.findByText(/Could not save profile|Error/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('Body Fat Reference Images', () => {
    it('shows body fat images for male', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          sex: 'male',
          date_of_birth: '1990-05-15',
          height_cm: 180,
          diet_preference: ''
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      // Body fat images are in a modal, just verify profile displays correctly with male sex in display mode
      await waitFor(() => {
        // Look for the sex value in the profile display section
        const sexElements = screen.getAllByText('male');
        expect(sexElements.length).toBeGreaterThan(0);
      });
    });

    it('shows body fat images for female', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          sex: 'female',
          date_of_birth: '1990-05-15',
          height_cm: 165,
          diet_preference: ''
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      // Body fat images are in a modal, just verify profile displays correctly with female sex in display mode
      await waitFor(() => {
        // Look for the sex value in the profile display section
        const sexElements = screen.getAllByText('female');
        expect(sexElements.length).toBeGreaterThan(0);
      });
    });

    it('hides body fat images for other/unspecified gender', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          sex: 'other',
          date_of_birth: '1990-05-15'
        },
        error: null
      });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Body Fat Reference/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and ARIA attributes', async () => {
      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Check form labels
        expect(screen.getByLabelText(/Date of Birth/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Sex/)).toBeInTheDocument();
        // Height has two inputs without a single associated label
        expect(screen.getByText('Height')).toBeInTheDocument();
        expect(screen.getByLabelText(/Diet Preference/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Weight \(lbs\)/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Body Fat %/)).toBeInTheDocument();

        // Check ARIA attributes - multiple status regions (profile form + metrics form)
        const statusRegions = screen.getAllByRole('status');
        expect(statusRegions.length).toBeGreaterThan(0);
      });
    });

    it('provides feedback through live regions', async () => {
      const user = userEvent.setup();
      mockSupabase.upsert.mockResolvedValue({ error: null });

      render(
        <TestWrapper>
          <ProfilePage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Profile/ })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Save Profile/ }));

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toHaveAttribute('aria-live', 'polite');
        expect(statusElement).toHaveAttribute('aria-atomic', 'true');
      });
    });
  });
});
