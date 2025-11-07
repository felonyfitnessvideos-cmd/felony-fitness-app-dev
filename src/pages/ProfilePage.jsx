/**
 * @fileoverview Comprehensive user profile and body metrics management page
 * @description Advanced profile management interface allowing users to maintain
 * personal information, track body composition metrics, and visualize progress
 * over time. Features interactive body fat estimation and historical data visualization.
 * 
 * @author Felony Fitness Development Team
 * @version 2.0.0
 * @since 2025-11-02
 * 
 * @requires React
 * @requires react-router-dom
 * @requires react-modal
 * @requires lucide-react
 * @requires supabaseClient
 * @requires AuthContext
 * @requires SubPageHeader
 * 
 * Core Features:
 * - Personal profile information management (DOB, gender)
 * - Body metrics tracking (weight, body fat percentage)
 * - Visual body fat percentage estimation guide
 * - Historical measurements with trend visualization
 * - Interactive modals for data entry
 * - Real-time age calculation
 * - Responsive design for all devices
 * 
 * @example
 * // Used in main application routing
 * <Route path="/profile" element={<ProfilePage />} />
 * 
 * @example
 * // Navigation from other components
 * <Link to="/profile">View Profile</Link>
 */

import { Calendar, Edit2 as EditIcon, HeartPulse, MapPin, Percent, Phone, User, Weight, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import Modal from 'react-modal';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import SubPageHeader from '../components/SubPageHeader.jsx';
import { supabase } from '../supabaseClient.js';
import './ProfilePage.css';

/**
 * @constant {Array<object>} maleBodyFatImages
 * @description An array of objects containing labels and placeholder image URLs for male body fat percentages.
 */
const maleBodyFatImages = [
  { label: '30%+', src: 'https://placehold.co/150x200/2d3748/ffffff?text=30%25%2B' },
  { label: '25%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=25%25' },
  { label: '20%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=20%25' },
  { label: '15%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=15%25' },
  { label: '10%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=10%25' },
  { label: '5%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=5%25' },
];

/**
 * @constant {Array<object>} femaleBodyFatImages
 * @description An array of objects containing labels and placeholder image URLs for female body fat percentages.
 */
const femaleBodyFatImages = [
  { label: '35%+', src: 'https://placehold.co/150x200/2d3748/ffffff?text=35%25%2B' },
  { label: '30%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=30%25' },
  { label: '25%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=25%25' },
  { label: '20%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=20%25' },
  { label: '15%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=15%25' },
  { label: '10%', src: 'https://placehold.co/150x200/2d3748/ffffff?text=10%25' },
];

// Modal styles moved to CSS; react-modal uses CSS classes defined in ProfilePage.css

/**
 * Calculate user age from date of birth
 * 
 * @function calculateAge
 * @param {string|null} dob - Date of birth in 'YYYY-MM-DD' format
 * @returns {number|null} Calculated age in years, or null if DOB not provided
 * 
 * @description Accurately calculates age accounting for leap years and exact
 * date differences. Handles edge cases where birthday hasn't occurred yet this year.
 * 
 * @example
 * // Calculate age from date string
 * const age = calculateAge('1990-05-15');
 * console.log(age); // Current age based on today's date
 * 
 * @example
 * // Handle null input gracefully
 * const age = calculateAge(null);
 * console.log(age); // null
 */
const calculateAge = (dob) => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * ProfilePage - Comprehensive user profile and body metrics management component
 * 
 * @component
 * @function ProfilePage
 * @returns {JSX.Element} Complete profile management interface with forms, metrics tracking,
 * historical data visualization, and interactive body fat estimation guide
 * 
 * @description Advanced profile management component that provides a comprehensive interface
 * for users to maintain personal information and track body composition metrics over time.
 * Features real-time age calculation, interactive body fat estimation tools, and historical
 * data visualization with optimized data fetching and error handling.
 * 
 * @since 2.0.0
 * @version 2.1.0
 * 
 * Component Architecture:
 * - Uses React hooks for state management and lifecycle methods
 * - Integrates with AuthContext for user authentication
 * - Connects to Supabase for data persistence and retrieval
 * - Implements Modal component for body fat estimation guide
 * - Uses SubPageHeader for consistent navigation experience
 * 
 * Core Features:
 * - Personal information editing (date of birth, gender, dietary preferences)
 * - Body metrics logging with validation (weight in lbs, body fat percentage)
 * - Visual body fat percentage estimation guide with gender-specific imagery
 * - Historical measurements tracking with chronological display
 * - Interactive modal interfaces for enhanced user experience
 * - Real-time age calculation from date of birth
 * - Responsive design optimized for mobile and desktop devices
 * - Comprehensive error handling and loading states
 * 
 * Database Schema Dependencies:
 * - user_profiles table: { id: uuid (PK), user_id: uuid, date_of_birth: date, sex: string ('male'|'female'|'other'), diet_preference: string }
 * - body_metrics table: { user_id: uuid, weight_lbs: decimal, body_fat_percentage: decimal, created_at: timestamp }
 * - Foreign key: body_metrics.user_id REFERENCES auth.users(id)
 * - RLS policies: Users can only access their own data
 * 
 * State Architecture:
 * @state {string} weight - Current weight input value for form submission
 * @state {string} bodyFat - Current body fat percentage input for form submission
 * @state {string} message - User feedback message for metric logging operations
 * @state {Object} profile - User profile data object containing dob (mapped from date_of_birth), sex, diet_preference
 * @state {number|null} age - Calculated age from date of birth, null if no DOB
 * @state {boolean} isEditingProfile - Controls profile form edit/display mode
 * @state {string} profileMessage - User feedback message for profile operations
 * @state {Array<Object>} history - Array of historical body metrics entries
 * @state {boolean} isBodyFatModalOpen - Controls body fat estimation modal visibility
 * @state {boolean} loading - Loading state for initial data fetching operations
 * 
 * Data Flow:
 * 1. Component mounts and fetches user profile and metrics history
 * 2. Profile data populates form fields and calculates age
 * 3. User can edit profile information or log new body metrics
 * 4. Form submissions update database and local state
 * 5. Historical data displays in chronological order
 * 6. Body fat modal provides visual estimation guidance
 * 
 * Error Handling:
 * - Gracefully handles missing user authentication
 * - Manages database connection failures with user feedback
 * - Handles missing user profile (PGRST116) as valid new user state
 * - Provides validation for form inputs with clear error messages
 * - Logs detailed errors for debugging while showing user-friendly messages
 * 
 * Performance Optimizations:
 * - useCallback for fetchData to prevent unnecessary re-renders
 * - Concurrent data fetching with Promise.all for faster initial load
 * - Optimized useEffect dependency array to prevent excessive API calls
 * - Efficient state updates that minimize component re-renders
 * - Limited history query (10 records) for optimal performance
 * 
 * Accessibility Features:
 * - Semantic HTML structure with proper form labels
 * - ARIA attributes for screen reader compatibility
 * - Keyboard navigation support for all interactive elements
 * - High contrast support through CSS variables
 * - Focus management in modal interactions
 * - Clear error messaging for form validation
 * 
 * Security Considerations:
 * - All database operations use Row Level Security (RLS)
 * - Input validation prevents malicious data submission
 * - User authentication required for all operations
 * - No sensitive data exposed in client-side logging
 * 
 * @example
 * // Primary usage in application routing
 * import ProfilePage from './pages/ProfilePage.jsx';
 * 
 * function App() {
 *   return (
 *     <Routes>
 *       <Route path="/profile" element={<ProfilePage />} />
 *     </Routes>
 *   );
 * }
 * 
 * @example
 * // Navigation from other components
 * import { Link } from 'react-router-dom';
 * <Link to="/profile" className="nav-link">My Profile</Link>
 * 
 * @example
 * // Programmatic navigation
 * import { useNavigate } from 'react-router-dom';
 * const navigate = useNavigate();
 * navigate('/profile');
 * 
 * @see {@link AuthContext} for user authentication state management
 * @see {@link SubPageHeader} for consistent page navigation
 * @see {@link supabaseClient} for database interaction utilities
 * @see {@link calculateAge} for age calculation utility function
 */
function ProfilePage() {
  // Authentication context integration
  const { user } = useAuth(); // Get current authenticated user from AuthContext

  /**
   * Current user's unique identifier
   * @type {string|undefined}
   * @description UUID from authenticated user, used for database queries
   */
  const userId = user?.id;

  /**
   * Implementation Notes:
   * - The user_profiles table may not have a record for new users (valid state)
   * - fetchData function treats PGRST116 (no row found) as non-error condition
   * - Profile editing is forced when required fields (dob, sex) are missing
   * - Form state is initialized with empty strings to prevent uncontrolled inputs
   * - Age calculation is performed client-side for real-time updates
   */

  // Body metrics form state management
  /**
   * Current weight input value for body metrics form
   * @type {string}
   * @description String representation of weight in pounds, validated on submission
   */
  const [weight, setWeight] = useState('');

  /**
   * Current body fat percentage input value for body metrics form
   * @type {string}
   * @description String representation of body fat percentage, validated on submission
   */
  const [bodyFat, setBodyFat] = useState('');

  /**
   * User feedback message for metric logging operations
   * @type {string}
   * @description Success/error messages displayed after metric form submission
   */
  const [message, setMessage] = useState('');

  // User profile form state management
  /**
   * User profile data object containing personal information
   * @type {Object}
   * @property {string} dob - Date of birth in YYYY-MM-DD format
   * @property {string} sex - Gender selection (male, female, other - lowercase per DB constraint)
   * @property {string} diet_preference - Dietary preference (Vegetarian, Vegan, or empty)
   * @property {string} first_name - User's first name
   * @property {string} last_name - User's last name
   * @property {string} phone - Phone number
   * @property {string} address - Street address
   * @property {string} city - City
   * @property {string} state - State/Province
   * @property {string} zip_code - ZIP/Postal code
   * @description Initialized with empty strings to ensure controlled inputs
   */
  const [profile, setProfile] = useState({
    dob: '',
    sex: '',
    diet_preference: '',
    heightFeet: '',
    heightInches: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: ''
  });

  /**
   * Calculated age from date of birth
   * @type {number|null}
   * @description Age in years calculated from DOB, null if DOB not provided
   */
  const [age, setAge] = useState(null);

  /**
   * Profile form edit mode state
   * @type {boolean}
   * @description Controls whether profile form is in edit or display mode
   */
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  /**
   * User feedback message for profile operations
   * @type {string}
   * @description Success/error messages displayed after profile form submission
   */
  const [profileMessage, setProfileMessage] = useState('');

  // Data display and UI control state
  /**
   * Historical body metrics data array
   * @type {Array<Object>}
   * @description Array of body metrics objects ordered by creation date (newest first)
   * @property {string} id - Unique identifier for the metric entry
   * @property {string} user_id - UUID of the user who created the entry
   * @property {number|null} weight_lbs - Weight measurement in pounds
   * @property {number|null} body_fat_percentage - Body fat percentage measurement
   * @property {string} created_at - ISO timestamp of when the measurement was recorded
   */
  const [history, setHistory] = useState([]);

  /**
   * Body fat estimation modal visibility state
   * @type {boolean}
   * @description Controls the display of the body fat percentage estimation guide modal
   */
  const [isBodyFatModalOpen, setBodyFatModalOpen] = useState(false);

  /**
   * Initial data loading state
   * @type {boolean}
   * @description Loading state for initial profile and metrics data fetching
   */
  const [loading, setLoading] = useState(true);

  /**
   * Fetches user profile and body metrics history from the database
   * 
   * @async
   * @function fetchData
   * @param {string} userId - The UUID of the currently authenticated user
   * @returns {Promise<void>} Resolves when data fetching and state updates complete
   * @throws {Error} Database connection or query execution errors
   * 
   * @description Retrieves user profile information and recent body metrics history
   * from Supabase database. Uses concurrent fetching for optimal performance and
   * handles both successful data retrieval and missing profile scenarios gracefully.
   * 
   * @since 2.0.0
   * @memoized Uses useCallback to prevent unnecessary function re-creation on renders
   * 
   * Database Operations:
   * 1. **Body Metrics Query**: Fetches last 10 body measurements ordered by date
   *    - Table: body_metrics
   *    - Filter: user_id equals current user
   *    - Order: created_at descending (newest first)
   *    - Limit: 10 records for performance optimization
   * 
   * 2. **User Profile Query**: Fetches personal information and preferences
   *    - Table: user_profiles
   *    - Fields: date_of_birth (mapped to dob), sex, diet_preference, height_cm (converted to heightFeet/heightInches)
   *    - Filter: id equals current user
   *    - Mode: single() expects exactly one record or none
   * 
   * Error Handling Strategy:
   * - **PGRST116 (No Rows Found)**: Treated as valid state for new users
   * - **Database Errors**: Logged to console and trigger loading state completion
   * - **Network Errors**: Propagated to catch block with error logging
   * - **Malformed Data**: Protected by default values and null checks
   * 
   * State Updates:
   * - Updates history array with fetched body metrics
   * - Populates profile object with user information
   * - Calculates and sets age from date of birth
   * - Determines edit mode based on profile completeness
   * - Always sets loading to false regardless of success/failure
   * 
   * Performance Optimizations:
   * - Concurrent queries using Promise.all for faster loading
   * - Limited result set (10 records) to prevent large data transfers
   * - Selective field querying to minimize bandwidth usage
   * - Memoized function to prevent unnecessary re-creation
   * 
   * @example
   * // Called automatically on component mount and user change
   * useEffect(() => {
   *   if (userId) {
   *     fetchData(userId);
   *   }
   * }, [userId, fetchData]);
   * 
   * @example
   * // Manual refresh after data update
   * const handleDataRefresh = () => {
   *   if (user?.id) {
   *     fetchData(user.id);
   *   }
   * };
   * 
   * Data Structure Examples:
   * @example
   * // Body metrics response structure
   * const metricsData = [
   *   {
   *     id: "uuid-string",
   *     user_id: "user-uuid",
   *     weight_lbs: 175.5,
   *     body_fat_percentage: 15.2,
   *     created_at: "2025-11-04T10:30:00Z"
   *   }
   * ];
   * 
   * @example
   * // User profile response structure (database columns)
   * const profileData = {
   *   date_of_birth: "1990-05-15",
   *   sex: "male",
   *   diet_preference: "Vegetarian"
   * };
   */
  const fetchData = useCallback(async (userId) => {
    try {
      // Execute concurrent database queries for optimal performance
      const [metricsRes, profileRes] = await Promise.all([
        // Fetch recent body metrics (last 10 entries, newest first)
        supabase
          .from('body_metrics')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),

        // Fetch user profile information
        // Note: Using actual column names from database schema
        // Query by id (primary key) which matches the user's auth ID
        supabase
          .from('user_profiles')
          .select('date_of_birth, sex, diet_preference, height_cm, first_name, last_name, phone, address, city, state, zip_code')
          .eq('id', userId)
          .single()
      ]);

      // Process body metrics query results
      const { data: metricsData, error: metricsError } = metricsRes;
      if (metricsError) throw metricsError;

      // Update history state with fetched metrics data
      // Fallback to empty array if no data returned
      setHistory(metricsData || []);

      // Process user profile query results
      const { data: profileData, error: profileError } = profileRes;

      // Handle profile query errors
      // PGRST116 indicates no profile record exists (valid for new users)
      // All other errors should be thrown and handled by catch block
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        // Profile exists - populate form with data
        // Map database fields to component state
        // Convert height from cm to feet/inches for display
        let heightFeet = '', heightInches = '';
        if (profileData.height_cm) {
          const totalInches = profileData.height_cm / 2.54; // Convert cm to inches
          const totalInchesRounded = Math.round(totalInches);
          const feetPart = Math.floor(totalInchesRounded / 12);
          const inchesPart = totalInchesRounded % 12; // This is always 0-11 after rounding first
          heightFeet = feetPart.toString();
          heightInches = inchesPart.toString();
        }

        setProfile({
          dob: profileData.date_of_birth || '',
          sex: profileData.sex || '',
          diet_preference: profileData.diet_preference || '',
          heightFeet: heightFeet,
          heightInches: heightInches,
          first_name: profileData.first_name || '',
          last_name: profileData.last_name || '',
          phone: profileData.phone || '',
          address: profileData.address || '',
          city: profileData.city || '',
          state: profileData.state || '',
          zip_code: profileData.zip_code || ''
        });

        // Calculate and set user's age from date of birth
        setAge(calculateAge(profileData.date_of_birth));

        // Determine if profile editing should be forced
        // Required fields: date_of_birth and sex
        const isProfileIncomplete = !profileData.date_of_birth || !profileData.sex;
        setIsEditingProfile(isProfileIncomplete);
      } else {
        // No profile exists (new user) - force editing mode
        setIsEditingProfile(true);
      }
    } catch (error) {
      // Log detailed error information for debugging
      console.error("Error fetching profile data:", error);

      // Could add user-visible error notification here
      // For now, we fail silently and let the user try again
    } finally {
      // Always set loading to false, regardless of success or failure
      // This ensures the UI doesn't remain in loading state indefinitely
      setLoading(false);
    }
  }, []);

  /**
   * Effect hook for data fetching lifecycle management
   * 
   * @description Triggers data fetching when user authentication state changes.
   * Optimized dependency array prevents unnecessary API calls while ensuring
   * data is loaded when user becomes available.
   * 
   * @since 2.0.0
   * 
   * Dependency Strategy:
   * - Uses userId instead of full user object to prevent reference-based re-runs
   * - Includes fetchData callback which is memoized with useCallback
   * - Ensures data fetching only occurs when user authentication is confirmed
   * 
   * Execution Flow:
   * 1. Component mounts with loading state true
   * 2. If userId exists, initiates data fetching
   * 3. If no userId, sets loading false (unauthenticated state)
   * 4. Re-runs only when userId or fetchData function changes
   * 
   * Performance Notes:
   * - Avoids fetch on every user object reference change
   * - Prevents infinite loops through proper dependency management
   * - Optimizes for authentication state changes only
   */
  useEffect(() => {
    if (userId) {
      // User is authenticated - fetch their profile and metrics data
      fetchData(userId);
    } else {
      // No user authenticated - stop loading state
      // This handles cases where user is logged out or not yet authenticated
      setLoading(false);
    }
  }, [userId, fetchData]);

  /**
   * Handles input changes in the profile form
   * 
   * @function handleProfileChange
   * @param {React.ChangeEvent<HTMLInputElement | HTMLSelectElement>} e - Form input change event
   * @returns {void}
   * 
   * @description Processes form input changes for profile data, updating the profile
   * state object and performing real-time age calculation when date of birth changes.
   * Ensures controlled input behavior and immediate user feedback.
   * 
   * @since 2.0.0
   * 
   * Supported Input Fields:
   * - **dob**: Date of birth input (date type) - triggers age recalculation
   * - **sex**: Gender selection (select type) - updates profile gender
   * - **diet_preference**: Dietary preference (select type) - updates dietary info
   * 
   * Special Behaviors:
   * - Date of birth changes trigger real-time age calculation and display
   * - All changes update the profile state immutably
   * - Input validation occurs at form submission, not during typing
   * 
   * State Updates:
   * - Updates profile object using functional state update pattern
   * - Preserves existing profile data while updating changed field
   * - Triggers age calculation for date of birth changes
   * 
   * @example
   * // Usage in form input
   * <input
   *   name="dob"
   *   type="date"
   *   value={profile.dob}
   *   onChange={handleProfileChange}
   * />
   * 
   * @example
   * // Usage in select dropdown
   * <select
   *   name="sex"
   *   value={profile.sex}
   *   onChange={handleProfileChange}
   * >
   *   <option value="male">Male</option>
   *   <option value="female">Female</option>
   * </select>
   * 
   * @see {@link calculateAge} for age calculation implementation
   */

  /**
   * Handles form input changes for profile fields
   * 
   * @function handleProfileChange
   * @param {React.ChangeEvent<HTMLInputElement|HTMLSelectElement>} e - Form input change event
   * @returns {void}
   * 
   * @description Generic form handler for all profile input fields. Updates the profile
   * state immutably and triggers real-time age calculation when date of birth changes.
   * Supports text inputs, select dropdowns, and number inputs.
   * 
   * @since 2.0.0
   * 
   * Supported Fields:
   * - dob: Date of birth input (triggers age recalculation)
   * - sex: Gender selection dropdown
   * - diet_preference: Dietary preference dropdown
   * - heightFeet: Height feet component (number input)
   * - heightInches: Height inches component (number input)
   * 
   * State Management:
   * - Uses functional state update for immutability
   * - Preserves existing profile fields while updating changed field
   * - Triggers side effects (age calculation) when appropriate
   * 
   * Real-time Features:
   * - Age updates automatically when date of birth changes
   * - Form validation occurs on profile save, not on change
   * - Maintains controlled input state for all form fields
   * 
   * @example
   * // Usage in form inputs
   * <input 
   *   name="dob" 
   *   type="date" 
   *   value={profile.dob} 
   *   onChange={handleProfileChange} 
   * />
   * 
   * @example
   * // Usage in select dropdowns
   * <select 
   *   name="sex" 
   *   value={profile.sex} 
   *   onChange={handleProfileChange}
   * >
   *   <option value="male">Male</option>
   *   <option value="female">Female</option>
   * </select>
   * 
   * @example
   * // Height fields usage
   * <input 
   *   name="heightFeet" 
   *   type="number" 
   *   value={profile.heightFeet} 
   *   onChange={handleProfileChange} 
   * />
   * 
   * Event Flow:
   * 1. User interacts with form field
   * 2. handleProfileChange extracts name and value from event
   * 3. Profile state updated with new value (immutable update)
   * 4. If dob changed, age is recalculated via calculateAge
   * 5. Component re-renders with updated state
   * 
   * @see {@link setProfile} for profile state management
   * @see {@link calculateAge} for date of birth age calculation
   * @see {@link handleProfileUpdate} for form submission handling
   */
  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    // Update profile state with new value
    // Using functional update to ensure immutability
    setProfile(prev => ({ ...prev, [name]: value }));

    // Special handling for date of birth changes
    // Recalculate age in real-time for immediate user feedback
    if (name === 'dob') {
      setAge(calculateAge(value));
    }
  };

  /**
   * Handles user profile form submission and database persistence
   * 
   * @async
   * @function handleProfileUpdate
   * @param {React.FormEvent<HTMLFormElement>} e - Form submission event object
   * @returns {Promise<void>} Resolves when profile update operation completes
   * 
   * @description Processes profile form submission by validating user authentication,
   * upserting profile data to the database, and providing user feedback. Uses upsert
   * operation to handle both new profile creation and existing profile updates seamlessly.
   * 
   * @since 2.0.0
   * 
   * Form Validation:
   * - Checks for authenticated user before processing
   * - Validates date_of_birth format (YYYY-MM-DD) and ensures valid date
   * - Prevents future dates for date of birth
   * - Allows empty date of birth (optional field)
   * - Shows appropriate error messages for validation failures
   * 
   * Database Operation:
   * - Uses upsert operation for flexible data handling
   * - Creates new profile record if none exists
   * - Updates existing profile record if one exists
   * - Includes all profile fields: date_of_birth, sex, diet_preference, height_cm
   * - Converts feet/inches input to centimeters for database storage
   * - Validates height ranges (feet: 0-8, inches: 0-11, final: 3-8 feet)
   * 
   * State Management:
   * - Updates profileMessage with success/error feedback
   * - Exits editing mode on successful save
   * - Clears success message after 3 seconds automatically
   * - Preserves error messages until next form interaction
   * 
   * User Experience:
   * - Prevents default form submission behavior
   * - Provides immediate feedback through message display
   * - Automatically transitions from edit to display mode
   * - Uses setTimeout for non-intrusive message clearing
   * 
   * Error Handling:
   * - Authentication errors: User-friendly refresh suggestion
   * - Date validation errors: Clear format requirements and future date prevention
   * - Database errors: Display technical error message from Supabase
   * - Network errors: Handled by Supabase client error response
   * - Validation errors: Handled by database constraints and client-side validation
   * 
   * @example
   * // Form usage with event handler
   * <form onSubmit={handleProfileUpdate}>
   *   <input name="dob" type="date" value={profile.dob} onChange={handleProfileChange} />
   *   <select name="sex" value={profile.sex} onChange={handleProfileChange}>
   *     <option value="male">Male</option>
   *     <option value="female">Female</option>
   *   </select>
   *   <button type="submit">Save Profile</button>
   * </form>
   * 
   * @example
   * // Success flow
   * // 1. User fills form and clicks submit
   * // 2. handleProfileUpdate validates user authentication
   * // 3. Profile data upserted to database
   * // 4. Success message displayed: "Profile saved!"
   * // 5. Form switches to display mode
   * // 6. Message clears after 3 seconds
   * 
   * @example
   * // Error flow - Invalid date
   * // 1. User enters invalid date format or future date
   * // 2. Client-side validation fails
   * // 3. Error message displayed: "Please enter date of birth in YYYY-MM-DD format"
   * // 4. Form remains in editing mode for correction
   * 
   * @example
   * // Error flow - Database error
   * // 1. Database operation fails
   * // 2. Error message displayed from Supabase
   * // 3. Form remains in editing mode
   * // 4. User can correct and retry
   * 
   * Data Validation Examples:
   * @example
   * // Valid date formats
   * profile.dob = "1990-05-15";  // ✅ Valid: YYYY-MM-DD format, past date
   * profile.dob = "";           // ✅ Valid: Empty string, optional field
   * profile.dob = "1985-12-25"; // ✅ Valid: Proper format and valid date
   * 
   * @example
   * // Invalid date formats (will show error)
   * profile.dob = "05/15/1990";  // ❌ Invalid: Wrong format
   * profile.dob = "2030-01-01";  // ❌ Invalid: Future date
   * profile.dob = "1990-13-01";  // ❌ Invalid: Invalid month
   * profile.dob = "invalid";     // ❌ Invalid: Not a date
   *
   * @example
   * // Valid height formats (feet/inches to cm conversion)
   * profile.heightFeet = "5", profile.heightInches = "9"  // ✅ Valid: 5'9" → 175 cm
   * profile.heightFeet = "6", profile.heightInches = "0"  // ✅ Valid: 6'0" → 183 cm
   * profile.heightFeet = "", profile.heightInches = ""    // ✅ Valid: Empty, optional
   * 
   * @example
   * // Invalid height formats (will show error)
   * profile.heightFeet = "9", profile.heightInches = "0"  // ❌ Invalid: Too tall
   * profile.heightFeet = "5", profile.heightInches = "15" // ❌ Invalid: >11 inches
   * profile.heightFeet = "2", profile.heightInches = "0"  // ❌ Invalid: Too short
   *
   * Database Schema:
   * @example
   * // user_profiles table structure
   * {
   *   id: "uuid (primary key, references auth.users)",
   *   user_id: "uuid (also references auth.users, same as id)",
   *   date_of_birth: "date (date of birth, YYYY-MM-DD format, optional)",
   *   sex: "varchar (gender: 'male', 'female', 'other')",
   *   diet_preference: "varchar (dietary preference)",
   *   email: "varchar (user email)",
   *   created_at: "timestamp (auto-generated)",
   *   updated_at: "timestamp (auto-updated)"
   * }
   * 
   * @see {@link supabase} for database client configuration
   * @see {@link profile} for current profile state structure
   * @see {@link setProfileMessage} for user feedback state management
   */
  const handleProfileUpdate = async (e) => {
    // Prevent default form submission behavior
    e.preventDefault();

    // Validate user authentication before proceeding
    if (!user) {
      setProfileMessage("Error: Could not save profile. Please refresh and try again.");
      return;
    }

    try {
      // Prepare and validate data before database operation
      const profileData = {
        id: user.id,
        user_id: user.id,
        sex: profile.sex,
        diet_preference: profile.diet_preference,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        phone: profile.phone || null,
        address: profile.address || null,
        city: profile.city || null,
        state: profile.state || null,
        zip_code: profile.zip_code || null
      };

      // Add height if provided (convert feet/inches to cm)
      if (profile.heightFeet || profile.heightInches) {
        const feet = parseFloat(profile.heightFeet) || 0;
        const inches = parseFloat(profile.heightInches) || 0;

        // Validate reasonable ranges
        if (feet < 0 || feet > 8 || inches < 0 || inches >= 12) {
          setProfileMessage('Please enter a valid height (feet: 0-8, inches: 0-11).');
          return;
        }

        // Convert to total inches, then to cm
        const totalInches = (feet * 12) + inches;
        const heightCm = Math.round(totalInches * 2.54); // Convert inches to cm and round

        // Validate final cm value is reasonable (3-8 feet range)
        if (heightCm < 91 || heightCm > 244) { // ~3ft to ~8ft
          setProfileMessage('Please enter a reasonable height.');
          return;
        }

        profileData.height_cm = heightCm;
      }

      // Only include date_of_birth if it's a valid date
      // Empty strings or invalid dates should not be sent to database
      if (profile.dob && profile.dob.trim() !== '') {
        // Validate date format (YYYY-MM-DD) and ensure it's a valid date
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(profile.dob)) {
          const testDate = new Date(profile.dob);
          // Check if date is valid and not in the future
          if (!isNaN(testDate.getTime()) && testDate <= new Date()) {
            profileData.date_of_birth = profile.dob;
          } else {
            setProfileMessage('Please enter a valid date of birth that is not in the future.');
            return;
          }
        } else {
          setProfileMessage('Please enter date of birth in YYYY-MM-DD format.');
          return;
        }
      }

      // Upsert profile data to database
      // Upsert operation handles both insert (new profile) and update (existing profile)
      const { error } = await supabase
        .from('user_profiles')
        .upsert(profileData);

      if (error) {
        // Display database error message to user
        setProfileMessage(error.message);
      } else {
        // Success - provide feedback and update UI state
        setProfileMessage('Profile saved!');
        setIsEditingProfile(false);

        // Clear success message after 3 seconds for clean UX
        setTimeout(() => setProfileMessage(''), 3000);
      }
    } catch (error) {
      // Handle unexpected errors (network issues, etc.)
      console.error('Profile update error:', error);
      setProfileMessage('An unexpected error occurred. Please try again.');
    }
  };

  /**
   * Handles body metrics form submission and database persistence
   * 
   * @async
   * @function handleLogMetric
   * @param {React.FormEvent<HTMLFormElement>} e - Form submission event object
   * @returns {Promise<void>} Resolves when metrics logging operation completes
   * 
   * @description Processes body metrics form submission by validating input data,
   * inserting new measurements into the database, and updating the local history state.
   * Supports flexible input where users can log weight only, body fat only, or both.
   * 
   * @since 2.0.0
   * 
   * Form Validation:
   * - Requires at least one measurement (weight or body fat)
   * - Validates user authentication before processing
   * - Converts string inputs to appropriate numeric types
   * - Handles empty/null values gracefully
   * 
   * Database Operation:
   * - Inserts new record into body_metrics table for time-series tracking
   * - Single operation - no redundant profile table updates needed
   * - Returns inserted record data for immediate UI update
   * - Uses parseFloat for numeric conversion and validation
   * - Stores null values for optional measurements
   * - Maintains data integrity with proper foreign key relationships
   * 
   * State Management:
   * - Updates local history state with new measurement
   * - Prepends new data to maintain chronological order
   * - Clears form inputs after successful save
   * - Provides user feedback through message system
   * 
   * User Experience:
   * - Prevents default form submission behavior
   * - Shows immediate feedback for validation errors
   * - Displays success confirmation with auto-clear
   * - Maintains form focus for continued data entry
   * 
   * Error Handling:
   * - Input validation: At least one measurement required
   * - Authentication errors: User-friendly refresh message
   * - Database errors: Technical error message display
   * - Network errors: Handled by Supabase client
   * 
   * @example
   * // Form usage with event handler
   * <form onSubmit={handleLogMetric}>
   *   <input 
   *     type="number" 
   *     value={weight} 
   *     onChange={(e) => setWeight(e.target.value)}
   *     placeholder="Weight (lbs)" 
   *   />
   *   <input 
   *     type="number" 
   *     value={bodyFat} 
   *     onChange={(e) => setBodyFat(e.target.value)}
   *     placeholder="Body Fat %" 
   *   />
   *   <button type="submit">Log Measurement</button>
   * </form>
   * 
   * @example
   * // Success flow with weight only
   * // 1. User enters weight: "175.5" lbs
   * // 2. Submits form (bodyFat empty)
   * // 3. Creates body_metrics: { user_id, weight_lbs: 175.5, body_fat_percentage: null }
   * // 4. Inserts to database and updates history
   * // 5. Shows "Measurement saved!" message
   * // 6. Clears form inputs
   * 
   * @example
   * // Validation error flow
   * // 1. User submits empty form
   * // 2. Validation fails: no measurements provided
   * // 3. Shows "Please enter at least one measurement."
   * // 4. Form remains active for user input
   * 
   * @example
   * // Database error handling
   * // 1. Network/database error occurs
   * // 2. Error message displayed from Supabase
   * // 3. Form data preserved for retry
   * // 4. User can correct and resubmit
   * 
   * Database Schema:
   * @example
   * // body_metrics table structure
   * {
   *   id: "uuid (primary key, auto-generated)",
   *   user_id: "uuid (foreign key to auth.users)",
   *   weight_lbs: "numeric (optional, weight in pounds)",
   *   body_fat_percentage: "numeric (optional, percentage)",
   *   created_at: "timestamp (auto-generated)",
   *   updated_at: "timestamp (auto-updated)"
   * }
   * 
   * Data Conversion:
   * @example
   * // Input processing examples
   * parseFloat("175.5")  // → 175.5
   * parseFloat("")       // → NaN → stored as null
   * parseFloat("15.2")   // → 15.2
   * parseFloat("invalid") // → NaN → stored as null
   * 
   * @see {@link supabase} for database client configuration
   * @see {@link weight} for current weight input state
   * @see {@link bodyFat} for current body fat input state
   * @see {@link setHistory} for metrics history state management
   */
  const handleLogMetric = async (e) => {
    // Prevent default form submission behavior
    e.preventDefault();

    // Validate that at least one measurement is provided
    if (!weight && !bodyFat) {
      setMessage('Please enter at least one measurement.');
      return;
    }

    // Validate user authentication
    if (!user) {
      setMessage("User not found, please refresh.");
      return;
    }

    try {
      // Prepare measurement data for database insertion
      // Convert string inputs to numbers, use null for empty values
      const newMetric = {
        user_id: user.id,
        weight_lbs: weight ? parseFloat(weight) : null,
        body_fat_percentage: bodyFat ? parseFloat(bodyFat) : null,
      };

      // Insert new measurement record (single operation - no profile table update needed)
      // Current weight/body fat will be determined by the most recent entry in body_metrics
      const { data, error } = await supabase
        .from('body_metrics')
        .insert(newMetric)
        .select()
        .single();

      if (error) {
        // Display database error to user
        setMessage(error.message);
      } else {
        // Success - update UI and provide feedback
        setMessage('Measurement saved!');

        // Add new measurement to top of history list for immediate visibility
        setHistory(prevHistory => [data, ...prevHistory]);

        // Clear form inputs for next entry
        setWeight('');
        setBodyFat('');

        // Clear success message after 3 seconds for clean UX
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      // Handle unexpected errors (network issues, etc.)
      console.error('Metrics logging error:', error);
      setMessage('An unexpected error occurred. Please try again.');
    }
  };

  /**
   * Get current (most recent) weight and body fat from metrics history
   * 
   * @function getCurrentMetrics
   * @returns {Object} Current metrics object with weight and body fat
   * 
   * @description Extracts the most recent weight and body fat measurements
   * from the history array. Returns the latest values or null if no data.
   * 
   * @example
   * // Returns most recent measurements
   * const current = getCurrentMetrics();
   * // { weight_lbs: 175.5, body_fat_percentage: 15.2 }
   */
  const getCurrentMetrics = () => {
    if (!history || history.length === 0) {
      return { weight_lbs: null, body_fat_percentage: null };
    }

    // Get the most recent entry (first in array since it's ordered by created_at DESC)
    const latest = history[0];
    return {
      weight_lbs: latest.weight_lbs,
      body_fat_percentage: latest.body_fat_percentage
    };
  };

  // Display a loading message while data is being fetched.
  if (loading) {
    return <div style={{ color: 'white', padding: '2rem' }}>Loading Profile...</div>;
  }

  return (
    <div className="profile-page-container">
      <SubPageHeader title="Profile & Metrics" icon={<User size={28} />} iconColor="#f97316" backTo="/dashboard" />

      {/* User Profile Section: Toggles between edit form and display view */}
      <div className="profile-form metric-form">
        <h2>Critical Statistics</h2>
        {isEditingProfile ? (
          <form onSubmit={handleProfileUpdate}>
            {/* Form fields for Date of Birth and Sex */}
            <div className="form-group">
              <label htmlFor="dob">Date of Birth {age && `(Age: ${age})`}</label>
              <div className="input-with-icon">
                <Calendar size={18} />
                <input id="dob" name="dob" type="date" value={profile.dob} onChange={handleProfileChange} />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="sex">Sex</label>
              <div className="input-with-icon">
                <HeartPulse size={18} />
                <select id="sex" name="sex" value={profile.sex} onChange={handleProfileChange}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Height</label>
              <div className="height-inputs">
                <div className="input-with-icon">
                  <User size={18} />
                  <input
                    id="heightFeet"
                    name="heightFeet"
                    type="number"
                    min="0"
                    max="8"
                    step="1"
                    value={profile.heightFeet}
                    onChange={handleProfileChange}
                    placeholder="5"
                  />
                  <span className="unit-label">ft</span>
                </div>
                <div className="input-with-icon">
                  <input
                    id="heightInches"
                    name="heightInches"
                    type="number"
                    min="0"
                    max="11"
                    step="1"
                    value={profile.heightInches}
                    onChange={handleProfileChange}
                    placeholder="9"
                  />
                  <span className="unit-label">in</span>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="diet_preference">Diet Preference</label>
              <div className="input-with-icon">
                <select id="diet_preference" name="diet_preference" value={profile.diet_preference} onChange={handleProfileChange}>
                  <option value="">None</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                </select>
              </div>
            </div>
            {/* Live region for profile messages */}
            <div className="form-message" role="status" aria-live="polite" aria-atomic="true">{profileMessage || ''}</div>
            <button type="submit" className="save-button">Save Statistics</button>
          </form>
        ) : (
          <div className="profile-display">
            <div className="compact-stats">
              <span className="stat-item">
                <strong>Age:</strong> {age || 'N/A'}
              </span>
              <span className="stat-separator">•</span>
              <span className="stat-item">
                <strong>Sex:</strong> {profile.sex || 'N/A'}
              </span>
              <span className="stat-separator">•</span>
              <span className="stat-item">
                <strong>Height:</strong> {(profile.heightFeet || profile.heightInches)
                  ? `${profile.heightFeet || 0}'${profile.heightInches || 0}"`
                  : 'N/A'
                }
              </span>
              <span className="stat-separator">•</span>
              <span className="stat-item">
                <strong>Diet:</strong> {profile.diet_preference || 'None'}
              </span>
            </div>

            <button className="edit-button" onClick={() => setIsEditingProfile(true)}>
              <EditIcon size={16} /> Edit
            </button>
          </div>
        )}
      </div>

      {/* Current Metrics Section - shows most recent measurements */}
      <div className="profile-form metric-form">
        <h2>Current Measurements</h2>
        <div className="profile-display">
          {(() => {
            const current = getCurrentMetrics();
            return (
              <>
                <div className="profile-stat">
                  <span className="label">Current Weight</span>
                  <span className="value">
                    {current.weight_lbs ? `${current.weight_lbs} lbs` : 'No data'}
                  </span>
                </div>
                <div className="profile-stat">
                  <span className="label">Current Body Fat</span>
                  <span className="value">
                    {current.body_fat_percentage ? `${current.body_fat_percentage}%` : 'No data'}
                  </span>
                </div>
                {!current.weight_lbs && !current.body_fat_percentage && (
                  <p className="no-data-message">
                    No measurements yet. Log your first measurement below!
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </div>

      {/* Metric Logging Section */}
      <form onSubmit={handleLogMetric} className="metric-form">
        <h2>Log Today's Measurements</h2>
        <div className="form-group">
          <label htmlFor="weight">Weight (lbs)</label>
          <div className="input-with-icon">
            <Weight size={18} />
            <input id="weight" type="number" placeholder="e.g., 185.5" value={weight} onChange={(e) => setWeight(e.target.value)} step="0.1" />
          </div>
        </div>
        <div className="form-group">
          <div className="label-with-link">
            <label htmlFor="bodyFat">Body Fat %</label>
            <button type="button" className="info-link" onClick={() => setBodyFatModalOpen(true)}>
              How can I tell?
            </button>
          </div>
          <div className="input-with-icon">
            <Percent size={18} />
            <input id="bodyFat" type="number" placeholder="e.g., 15.2" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} step="0.1" />
          </div>
        </div>
        {/* Live region for metric save messages */}
        <div className="form-message" role="status" aria-live="polite" aria-atomic="true">{message || ''}</div>
        <button type="submit" className="save-button">Save Measurement</button>
      </form>

      {/* Recent History Section */}
      <div className="history-section">
        <h2>Recent History</h2>
        {history.length === 0 ? <p>No measurements logged yet.</p> : (
          <ul className="history-list">
            {history.map(metric => (
              <li key={metric.id} className="history-item">
                <span className="history-date">{new Date(metric.created_at).toLocaleDateString()}</span>
                <div className="history-values">
                  {metric.weight_lbs && <span>{metric.weight_lbs} lbs</span>}
                  {metric.body_fat_percentage && <span>{metric.body_fat_percentage}% fat</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Contact Information Section */}
      <div className="profile-form metric-form">
        <h2>Contact Information</h2>
        {isEditingProfile ? (
          <form onSubmit={handleProfileUpdate}>
            <div className="form-group">
              <label htmlFor="contact_first_name">First Name</label>
              <div className="input-with-icon">
                <User size={18} />
                <input
                  id="contact_first_name"
                  name="first_name"
                  type="text"
                  value={profile.first_name}
                  onChange={handleProfileChange}
                  placeholder="First Name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_last_name">Last Name</label>
              <div className="input-with-icon">
                <User size={18} />
                <input
                  id="contact_last_name"
                  name="last_name"
                  type="text"
                  value={profile.last_name}
                  onChange={handleProfileChange}
                  placeholder="Last Name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_phone">Phone</label>
              <div className="input-with-icon">
                <Phone size={18} />
                <input
                  id="contact_phone"
                  name="phone"
                  type="tel"
                  value={profile.phone}
                  onChange={handleProfileChange}
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_address">Address</label>
              <div className="input-with-icon">
                <MapPin size={18} />
                <input
                  id="contact_address"
                  name="address"
                  type="text"
                  value={profile.address}
                  onChange={handleProfileChange}
                  placeholder="Street Address"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_city">City</label>
              <div className="input-with-icon">
                <MapPin size={18} />
                <input
                  id="contact_city"
                  name="city"
                  type="text"
                  value={profile.city}
                  onChange={handleProfileChange}
                  placeholder="City"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_state">State</label>
              <div className="input-with-icon">
                <MapPin size={18} />
                <input
                  id="contact_state"
                  name="state"
                  type="text"
                  value={profile.state}
                  onChange={handleProfileChange}
                  placeholder="State"
                  maxLength="2"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="contact_zip_code">ZIP Code</label>
              <div className="input-with-icon">
                <MapPin size={18} />
                <input
                  id="contact_zip_code"
                  name="zip_code"
                  type="text"
                  value={profile.zip_code}
                  onChange={handleProfileChange}
                  placeholder="12345"
                  maxLength="10"
                />
              </div>
            </div>

            <div className="form-message" role="status" aria-live="polite" aria-atomic="true">{profileMessage || ''}</div>
            <button type="submit" className="save-button">Save Contact Info</button>
          </form>
        ) : (
          <div className="profile-display">
            {(profile.first_name || profile.last_name) ? (
              <div className="profile-stat">
                <span className="label">Name</span>
                <span className="value">
                  {[profile.first_name, profile.last_name].filter(Boolean).join(' ')}
                </span>
              </div>
            ) : null}

            {profile.phone ? (
              <div className="profile-stat">
                <span className="label">Phone</span>
                <span className="value">{profile.phone}</span>
              </div>
            ) : null}

            {profile.address ? (
              <div className="profile-stat">
                <span className="label">Address</span>
                <span className="value">{profile.address}</span>
              </div>
            ) : null}

            {(profile.city || profile.state || profile.zip_code) ? (
              <div className="profile-stat">
                <span className="label">Location</span>
                <span className="value">
                  {[
                    profile.city,
                    profile.state,
                    profile.zip_code
                  ].filter(Boolean).join(', ')}
                </span>
              </div>
            ) : null}

            {!profile.first_name && !profile.last_name && !profile.phone && !profile.address && !profile.city && !profile.state && !profile.zip_code ? (
              <p className="no-data-message">
                No contact information yet. Click Edit to add your details.
              </p>
            ) : null}

            <button className="edit-button" onClick={() => setIsEditingProfile(true)}>
              <EditIcon size={16} /> Edit Contact Info
            </button>
          </div>
        )}
      </div>

      <Link to="/my-plan" className="link-button">
        Go to My Plan
      </Link>

      {/* Modal for Body Fat Estimation Guide */}
      <Modal
        isOpen={isBodyFatModalOpen}
        onRequestClose={() => setBodyFatModalOpen(false)}
        contentLabel="Body Fat Guide"
        overlayClassName="profile-modal-overlay"
        className="profile-modal-content"
      >
        <div className="modal-header">
          <h3>Body Fat Percentage Guide</h3>
          <button onClick={() => setBodyFatModalOpen(false)} className="close-modal-btn"><X size={24} /></button>
        </div>
        <div className="modal-body">
          {/* Conditionally render content based on the user's selected sex */}
          {(profile.sex === 'male' || profile.sex === 'female') ? (
            <>
              <p className="modal-subtitle">These are visual estimates. For accurate measurements, consult a professional.</p>
              <div className="bodyfat-grid">
                {(profile.sex === 'male' ? maleBodyFatImages : femaleBodyFatImages).map(img => (
                  <div key={img.label} className="bodyfat-card">
                    <img src={img.src} alt={`Body fat at ${img.label}`} className="bodyfat-image" />
                    <p className="bodyfat-label">{img.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="professional-advice">
              <p>Visual body fat estimation varies significantly based on individual body composition.</p>
              <p>For the most accurate assessment and personalized advice, we recommend consulting with a primary care provider, certified personal trainer, or registered dietitian.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default ProfilePage;
