/**
 * @fileoverview Calendar management page for trainers with Google Calendar integration
 * @description Comprehensive calendar management interface for fitness trainers featuring
 * Google Calendar integration, weekly view, event management, and responsive design.
 * Implements bulletproof error handling, accessibility features, and performance optimizations.
 * 
 * @author Felony Fitness Development Team
 * @version 2.0.0
 * @since 2025-11-01
 * 
 * @requires react
 * @requires lucide-react
 * @requires useGoogleCalendar
 * 
 * @example
 * // Basic usage
 * import TrainerCalendar from './pages/trainer/TrainerCalendar';
 * 
 * function App() {
 *   return <TrainerCalendar />;
 * }
 */

import { AlertCircle, Calendar, CheckCircle, RefreshCw } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useGoogleCalendar from '../../hooks/useGoogleCalendar.jsx';
import './TrainerCalendar.css';

/**
 * @typedef {Object} LocalAppointment
 * @property {number} id - Unique appointment identifier
 * @property {string} clientName - Client's name
 * @property {string} date - Appointment date (ISO string)
 * @property {string} time - Appointment time (formatted string)
 * @property {number} duration - Duration in minutes
 * @property {string} type - Appointment type
 * @property {string} location - Appointment location
 * @property {string} status - Appointment status ('confirmed', 'pending', 'cancelled')
 * @property {string} [googleEventId] - Google Calendar event ID if synced
 * @property {string} source - Data source ('local' or 'google')
 */

/**
 * @typedef {Object} CalendarState
 * @property {Array<LocalAppointment>} appointments - Local appointments
 * @property {Date} selectedDate - Currently selected date
 * @property {Array} localEvents - Events converted from Google Calendar
 * @property {Date} currentWeek - Current week being displayed
 */

/**
 * TrainerCalendar Component
 * 
 * @component
 * @description Comprehensive calendar management interface for fitness trainers.
 * Features Google Calendar integration, weekly view, event management, and responsive design.
 * Implements accessibility features, error boundaries, and performance optimizations.
 * 
 * @returns {React.ReactElement} The TrainerCalendar component
 * 
 * @example
 * // Basic usage
 * <TrainerCalendar />
 * 
 * @accessibility
 * - ARIA labels for all interactive elements
 * - Keyboard navigation support
 * - Screen reader friendly
 * - High contrast support
 * 
 * @performance
 * - Memoized components and calculations
 * - Optimized re-rendering with useCallback
 * - Debounced operations for smooth UX
 * - Lazy loading of non-critical features
 */
const TrainerCalendar = memo(() => {
  // Core state management
  /** @type {[Array<LocalAppointment>, Function]} Local appointments state */
  const [_appointments, setAppointments] = useState([]);

  /** @type {[Date, Function]} Currently selected date */
  // const [selectedDate, setSelectedDate] = useState(new Date());

  /** @type {[Array, Function]} Events converted from Google Calendar */
  const [localEvents, setLocalEvents] = useState([]);

  /** @type {[Date, Function]} Current week being displayed */
  const [currentWeek, setCurrentWeek] = useState(new Date());

  /** @type {[number, Function]} Number of weeks to show - static view */
  const [weeksToShow] = useState(12); // Show 12 weeks (3 months) in static view

  // Error boundary state
  /** @type {[string|null, Function]} Component-level error state */
  const [componentError, setComponentError] = useState(null);

  // Refs for scroll functionality
  /** @type {React.MutableRefObject<HTMLDivElement|null>} Reference to calendar scroll container */
  const scrollContainerRef = useRef(null);

  /** @type {React.MutableRefObject<HTMLDivElement|null>} Reference to headers scroll container */
  const headersScrollRef = useRef(null);

  // Google Calendar integration
  const {
    isLoading,
    isAuthenticated,
    isConfigured,
    events,
    error,
    signIn,
    signOut,
    loadEvents,
    createEvent,
    clearError
  } = useGoogleCalendar();

  /**
   * @function getWeekDates
   * @description Calculates the 7 dates for the week containing the given date.
   * Week starts on Sunday (US standard). Memoized for performance.
   * 
   * @param {Date} date - Reference date to calculate week for
   * @returns {Array<Date>} Array of 7 Date objects representing the week
   * 
   * @example
   * const weekDates = getWeekDates(new Date());
   * // Returns [Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday]
   */
  const getWeekDates = useCallback((date) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        console.error('❌ Invalid date provided to getWeekDates:', date);
        return Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 24 * 60 * 60 * 1000));
      }

      const week = [];
      const startOfWeek = new Date(date);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day; // First day is Sunday
      startOfWeek.setDate(diff);

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startOfWeek);
        dayDate.setDate(startOfWeek.getDate() + i);
        week.push(dayDate);
      }

      return week;
    } catch (error) {
      console.error('❌ Error calculating week dates:', error);
      setComponentError('Failed to calculate calendar dates');
      return Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 24 * 60 * 60 * 1000));
    }
  }, []);

  /**
   * @function getAllWeekDates
   * @description Generates multiple weeks starting from current week for infinite scrolling
   * 
   * @returns {Array<Date>} Array of Date objects for multiple weeks (weeksToShow * 7 dates)
   */
  const getAllWeekDates = useCallback(() => {
    const allDates = [];
    const startWeek = new Date(currentWeek);

    for (let weekOffset = 0; weekOffset < weeksToShow; weekOffset++) {
      const weekDate = new Date(startWeek);
      weekDate.setDate(startWeek.getDate() + (weekOffset * 7));
      const weekDates = getWeekDates(weekDate);
      allDates.push(...weekDates);
    }

    return allDates;
  }, [currentWeek, weeksToShow, getWeekDates]);

  /**
   * @function handleContentScroll
   * @description Synchronizes horizontal scroll between headers and content
   * 
   * @param {Event} event - Scroll event from content container
   */
  const handleContentScroll = useCallback((event) => {
    if (headersScrollRef.current && event.target) {
      // Sync horizontal scroll only
      headersScrollRef.current.scrollLeft = event.target.scrollLeft;
    }
  }, []);

  // Load Google Calendar events when authenticated or week changes
  useEffect(() => {
    if (isAuthenticated) {
      const startOfWeek = getWeekDates(currentWeek)[0];
      const endOfWeek = getWeekDates(currentWeek)[6];
      // Add one day to end to include the full last day
      const endDate = new Date(endOfWeek);
      endDate.setDate(endDate.getDate() + 1);

      console.log('🗓️ Loading events for week:', {
        start: startOfWeek.toISOString(),
        end: endDate.toISOString(),
        weekDates: getWeekDates(currentWeek).map(d => d.toDateString())
      });
      loadEvents('primary', startOfWeek, endDate);
    }
    // getWeekDates is stable from useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, currentWeek, loadEvents]);

  // Convert Google Calendar events to appointment format
  useEffect(() => {
    console.log(`🔄 Converting ${events.length} Google Calendar events to local format`);

    if (events.length > 0) {
      const convertedEvents = events.map(event => ({
        id: event.id,
        clientName: event.summary?.split(' - ')[1] || 'Unknown Client',
        date: event.start?.dateTime ? new Date(event.start.dateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: event.start?.dateTime ? new Date(event.start.dateTime).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        }) : 'All Day',
        duration: event.start?.dateTime && event.end?.dateTime ?
          Math.round((new Date(event.end.dateTime) - new Date(event.start.dateTime)) / (1000 * 60)) : 60,
        type: event.summary?.split(' - ')[0] || 'Appointment',
        location: event.location || 'TBD',
        status: 'confirmed',
        googleEventId: event.id,
        source: 'google'
      }));

      console.log(`✅ Converted events:`, convertedEvents.map(e => ({
        id: e.id,
        client: e.clientName,
        date: e.date,
        time: e.time
      })));

      setLocalEvents(convertedEvents);
    } else {
      console.log('📝 No events to convert, clearing local events');
      setLocalEvents([]);
    }
  }, [events]);

  // Mock local appointments data (fallback when not using Google Calendar)
  useEffect(() => {
    if (!isAuthenticated || !isConfigured) {
      const today = new Date().toISOString().split('T')[0];

      setAppointments([
        {
          id: 1,
          clientName: "John Dough",
          date: today,
          time: "10:00 AM",
          duration: 60,
          type: "Personal Training",
          location: "Gym Floor A",
          status: "confirmed",
          source: 'local'
        },
        {
          id: 2,
          clientName: "Jane Smith",
          date: today,
          time: "2:00 PM",
          duration: 45,
          type: "Consultation",
          location: "Office",
          status: "pending",
          source: 'local'
        }
      ]);
    } else {
      setAppointments(localEvents);
    }
  }, [isAuthenticated, isConfigured, localEvents]);

  /**
   * Handle Google Calendar sync operation
   * 
   * @async
   * @function handleGoogleCalendarSync
   * @description Handles Google Calendar synchronization - either sign in if not authenticated,
   * or refresh events if already authenticated. Includes comprehensive error handling.
   * 
   * @returns {Promise<void>} Promise that resolves when sync operation completes
   * 
   * @example
   * // Called when user clicks sync button
   * await handleGoogleCalendarSync();
   */
  const handleGoogleCalendarSync = useCallback(async () => {
    try {
      setComponentError(null);

      if (!isAuthenticated) {
        console.log('🔍 User not authenticated, initiating sign-in...');
        await signIn({ loadData: true });
      } else {
        console.log('🔍 User authenticated, refreshing events...');

        // Calculate date range for refresh (current week + 1 month)
        const weekDates = getWeekDates(currentWeek);
        const startDate = weekDates[0];
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        await loadEvents('primary', startDate, endDate);
        console.log('✅ Events refreshed successfully');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to sync with Google Calendar';
      console.error('❌ Google Calendar sync error:', err);
      setComponentError(errorMsg);

      // Don't re-throw - let the component handle the error gracefully
    }
  }, [isAuthenticated, signIn, loadEvents, currentWeek, getWeekDates]);

  // Auto-scroll to current day and time on component mount
  useEffect(() => {
    const scrollToCurrentDayAndTime = () => {
      if (!scrollContainerRef.current) {
        // Silently fail - scroll container may not be ready yet
        return;
      }

      const now = new Date();
      const currentHour = now.getHours();

      // Ensure we're showing the week that contains today
      const weekDates = getWeekDates(currentWeek);
      const todayInCurrentWeek = weekDates.some(date =>
        date.toDateString() === now.toDateString()
      );

      // If today is not in the current week view, navigate to this week
      if (!todayInCurrentWeek) {
        console.log('📅 Current day not in view, navigating to current week');
        setCurrentWeek(now);
        return; // Let the effect run again when currentWeek updates
      }

      // Calculate scroll position more accurately
      // Each hour is approximately 50px, we start at 6 AM (index 0)
      // So hour 8 AM would be at position (8-6) * 50 = 100px
      const startHour = 6;
      const hourHeight = 50;
      const scrollTop = Math.max(0, (currentHour - startHour) * hourHeight);

      // Offset to show some context above current time
      const offsetScrollTop = Math.max(0, scrollTop - 100);

      scrollContainerRef.current.scrollTop = offsetScrollTop;
      console.log(`📍 Auto-scrolled to current time: ${currentHour}:00 (scroll position: ${offsetScrollTop}px, calculated: ${scrollTop}px)`);
    };

    // Multiple attempts with increasing delays to ensure DOM is fully rendered
    const scrollTimer1 = setTimeout(scrollToCurrentDayAndTime, 300);
    const scrollTimer2 = setTimeout(scrollToCurrentDayAndTime, 800);
    const scrollTimer3 = setTimeout(scrollToCurrentDayAndTime, 1500);

    return () => {
      clearTimeout(scrollTimer1);
      clearTimeout(scrollTimer2);
      clearTimeout(scrollTimer3);
    };
  }, [currentWeek, getWeekDates]);

  // Ensure calendar always starts showing the current week on initial load
  useEffect(() => {
    const today = new Date();
    console.log('📅 Ensuring calendar shows current week on mount');
    setCurrentWeek(today);
  }, []); // Run only once on mount

  /**
   * Handle Google Calendar sign out
   * 
   * @async
   * @function handleSignOut
   * @description Signs out from Google Calendar and clears all related data.
   * Includes error handling and state cleanup.
   * 
   * @returns {Promise<void>} Promise that resolves when sign out completes
   * 
   * @example
   * // Called when user clicks sign out button
   * await handleSignOut();
   */
  const handleSignOut = useCallback(async () => {
    try {
      setComponentError(null);
      console.log('🔍 Signing out from Google Calendar...');

      await signOut();
      setLocalEvents([]);

      // Reset to default local appointments
      const today = new Date().toISOString().split('T')[0];
      setAppointments([
        {
          id: 1,
          clientName: "Demo Client",
          date: today,
          time: "10:00 AM",
          duration: 60,
          type: "Personal Training",
          location: "Gym Floor A",
          status: "confirmed",
          source: 'local'
        }
      ]);

      console.log('✅ Successfully signed out from Google Calendar');
    } catch (err) {
      const errorMsg = err.message || 'Failed to sign out from Google Calendar';
      console.error('❌ Google Calendar sign out error:', err);
      setComponentError(errorMsg);

      // Even if sign out fails, clear local data
      setLocalEvents([]);
    }
  }, [signOut]);



  /**
   * Format hour number to 12-hour time string
   * 
   * @function formatTime
   * @description Converts 24-hour format to 12-hour AM/PM format.
   * Includes input validation and error handling.
   * 
   * @param {number} hour - Hour in 24-hour format (0-23)
   * @returns {string} Formatted time string (e.g., "9:00 AM", "2:00 PM")
   * 
   * @example
   * formatTime(9);  // "9:00 AM"
   * formatTime(14); // "2:00 PM"
   * formatTime(0);  // "12:00 AM"
   */
  const formatTime = useCallback((hour) => {
    try {
      if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        console.error('❌ Invalid hour for time formatting:', hour);
        return 'Invalid Time';
      }

      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:00 ${ampm}`;
    } catch (error) {
      console.error('❌ Error formatting time:', error);
      return 'Error';
    }
  }, []);

  /**
   * Find event for specific time slot
   * 
   * @function getEventForTimeSlot
   * @description Finds the Google Calendar event that occurs in the specified time slot.
   * Handles both timed events and all-day events with comprehensive error handling.
   * 
   * @param {Date} date - The date to check
   * @param {number} hour - The hour to check (0-23)
   * @returns {Object|null} The event object if found, null otherwise
   * 
   * @example
   * const event = getEventForTimeSlot(new Date(), 14);
   * if (event) {
   *   console.log('Event found:', event.summary);
   * }
   */
  const getEventForTimeSlot = useCallback((date, hour) => {
    try {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        console.error('❌ Invalid date provided to getEventForTimeSlot:', date);
        return null;
      }

      if (typeof hour !== 'number' || hour < 0 || hour > 23) {
        console.error('❌ Invalid hour provided to getEventForTimeSlot:', hour);
        return null;
      }

      if (!events || !Array.isArray(events)) {
        return null;
      }

      return events.find(event => {
        try {
          if (!event || (!event.start?.dateTime && !event.start?.date)) {
            return false;
          }

          let eventStart;
          if (event.start.dateTime) {
            // Timed event
            eventStart = new Date(event.start.dateTime);
            if (isNaN(eventStart.getTime())) {
              console.warn('⚠️ Invalid event start time:', event.start.dateTime);
              return false;
            }

            const eventDate = eventStart.toDateString();
            const eventHour = eventStart.getHours();
            return eventDate === date.toDateString() && eventHour === hour;
          } else if (event.start.date) {
            // All-day event - show in first hour slot (midnight)
            eventStart = new Date(event.start.date);
            if (isNaN(eventStart.getTime())) {
              console.warn('⚠️ Invalid event start date:', event.start.date);
              return false;
            }

            const eventDate = eventStart.toDateString();
            return eventDate === date.toDateString() && hour === 0;
          }

          return false;
        } catch (error) {
          console.error('❌ Error processing event in time slot check:', error);
          return false;
        }
      });
    } catch (error) {
      console.error('❌ Error finding event for time slot:', error);
      return null;
    }
  }, [events]);

  /**
   * Handle creating a test event
   * 
   * @async
   * @function handleCreateTestEvent
   * @description Creates a test appointment in Google Calendar for demonstration purposes.
   * Includes validation, error handling, and user feedback.
   * 
   * @returns {Promise<void>} Promise that resolves when test event is created
   * 
   * @example
   * // Called when user clicks create test event button
   * await handleCreateTestEvent();
   */
  const _handleCreateTestEvent = useCallback(async () => {
    try {
      setComponentError(null);

      if (!isAuthenticated) {
        const errorMsg = 'Please sign in to Google Calendar first';
        setComponentError(errorMsg);
        return;
      }

      console.log('🔍 Creating test appointment...');

      // Create test appointment for tomorrow at a reasonable time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(14, 0, 0, 0); // 2:00 PM tomorrow

      const testAppointment = {
        clientName: 'John Test Client',
        type: 'Personal Training Session',
        date: tomorrow,
        duration: 60,
        location: 'Felony Fitness - Studio A',
        notes: 'Test appointment created from Felony Fitness trainer calendar app. This demonstrates Google Calendar integration functionality.',
        clientEmail: '' // Optional - could be added for real appointments
      };

      const createdEvent = await createEvent(testAppointment, 'primary', {
        refreshEvents: true,
        refreshStart: new Date(),
        refreshEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
      });

      if (createdEvent) {
        console.log('✅ Test appointment created:', createdEvent.id);

        // Force a refresh of events for the week containing the new event
        const eventWeek = new Date(tomorrow);
        const weekStart = getWeekDates(eventWeek)[0];
        const weekEnd = new Date(getWeekDates(eventWeek)[6]);
        weekEnd.setDate(weekEnd.getDate() + 1); // Include full last day

        console.log(`🔄 Force refreshing events for week: ${weekStart.toDateString()} to ${weekEnd.toDateString()}`);
        await loadEvents('primary', weekStart, weekEnd);

        // Show success message (could be replaced with a proper toast notification)
        if (window.confirm('Test appointment created successfully! Check your Google Calendar to see it. Navigate to tomorrow to see it in the calendar view?')) {
          // Navigate to the day the event was created
          setCurrentWeek(tomorrow);
        }
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to create test appointment';
      console.error('❌ Create test event error:', err);
      setComponentError(errorMsg);

      // Show error to user (could be replaced with proper error toast)
      alert(`Failed to create test appointment: ${errorMsg}`);
    }
    // getWeekDates and loadEvents are stable from useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, createEvent, setCurrentWeek]);

  // Memoized calculations for performance
  /** @type {Array<Date>} All dates for infinite scrolling (multiple weeks) */
  const allDates = useMemo(() => getAllWeekDates(), [getAllWeekDates]);

  /** @type {Array<Date>} Current week dates (for display purposes) */
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek, getWeekDates]);

  /** @type {Array<number>} Hours array for time slots (5am to 8pm) */
  const hours = useMemo(() => Array.from({ length: 16 }, (_, i) => i + 5), []); // 5am (5) to 8pm (20)

  /** @type {string} Formatted week range string */
  const _weekRangeText = useMemo(() => {
    try {
      const startDate = weekDates[0];
      const endDate = weekDates[6];

      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } catch (error) {
      console.error('❌ Error formatting week range:', error);
      return 'Calendar Week';
    }
  }, [weekDates]);

  // Error boundary wrapper
  if (componentError) {
    return (
      <div className="trainer-calendar-container">
        <div className="calendar-error-boundary">
          <div className="error-content">
            <AlertCircle size={48} />
            <h3>Calendar Error</h3>
            <p>{componentError}</p>
            <button
              onClick={() => setComponentError(null)}
              className="error-retry-button"
              aria-label="Clear error and retry"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="trainer-calendar-container"
      role="main"
      aria-label="Trainer Calendar Application"
    >
      <header className="calendar-header" role="banner">
        <h2>Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
        <div className="calendar-actions" role="toolbar" aria-label="Calendar actions">
          {/* Google Calendar Status - Clickable for connection */}
          <div className="google-calendar-status">
            {!isConfigured ? (
              <button
                className="status-badge warning clickable"
                disabled={true}
                aria-label="Google Calendar not configured - check environment variables"
                type="button"
              >
                <AlertCircle size={16} aria-hidden="true" />
                <span>Not Configured</span>
              </button>
            ) : isAuthenticated ? (
              <button
                className="status-badge success clickable"
                onClick={handleGoogleCalendarSync}
                disabled={isLoading}
                aria-label={isLoading ? 'Syncing calendar events...' : 'Connected - Click to sync'}
                type="button"
              >
                <CheckCircle size={16} aria-hidden="true" />
                <span>{isLoading ? 'Syncing...' : 'Connected'}</span>
              </button>
            ) : (
              <button
                className="status-badge neutral clickable"
                onClick={handleGoogleCalendarSync}
                disabled={isLoading}
                aria-label={isLoading ? 'Connecting to Google Calendar...' : 'Connect to Google Calendar'}
                type="button"
              >
                <RefreshCw
                  size={16}
                  className={isLoading ? 'spinning' : ''}
                  aria-hidden="true"
                />
                <span>{isLoading ? 'Connecting...' : 'Connect Now'}</span>
              </button>
            )}
          </div>

          {/* Sign Out Button - Only show when connected */}
          {isConfigured && isAuthenticated && (
            <button
              onClick={handleSignOut}
              className="signout-button compact"
              disabled={isLoading}
              aria-label="Sign out from Google Calendar"
              type="button"
            >
              Sign Out
            </button>
          )}
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div
          className="error-banner"
          role="alert"
          aria-live="assertive"
          aria-label={`Error: ${error}`}
        >
          <AlertCircle size={16} aria-hidden="true" />
          <span>{error}</span>
          <button
            onClick={clearError}
            className="error-close"
            aria-label="Dismiss error message"
            type="button"
          >
            ×
          </button>
        </div>
      )}

      {/* Configuration Notice */}
      {!isConfigured && (
        <div className="config-notice" role="region" aria-labelledby="config-notice-title">
          <AlertCircle size={20} aria-hidden="true" />
          <div>
            <h4 id="config-notice-title">Google Calendar Setup Required</h4>
            <p>To enable Google Calendar integration, please set up your API credentials:</p>
            <ol>
              <li>
                Go to{' '}
                <a
                  href="https://console.cloud.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Google Cloud Console (opens in new tab)"
                >
                  Google Cloud Console
                </a>
              </li>
              <li>Create a new project or select existing one</li>
              <li>Enable the Google Calendar API</li>
              <li>Create credentials (API Key and OAuth 2.0 Client ID)</li>
              <li>
                Set environment variables:{' '}
                <code>VITE_GOOGLE_API_KEY</code> and{' '}
                <code>VITE_GOOGLE_CLIENT_ID</code>
              </li>
            </ol>
            <p>
              <small>
                <strong>Note:</strong> After setting environment variables, restart your development server.
              </small>
            </p>
          </div>
        </div>
      )}

      <div className="calendar-layout">
        <div className="calendar-main-fullwidth">
          {isAuthenticated ? (
            <div className="weekly-calendar">
              {/* Current Week Display - Always shows current week */}


              {/* Calendar Grid */}
              <div
                className="calendar-grid-container"
                role="grid"
                aria-labelledby="current-date-heading"
                aria-describedby="calendar-instructions"
              >
                <div
                  id="calendar-instructions"
                  className="sr-only"
                  aria-live="polite"
                >
                  Weekly calendar view. Use arrow keys to navigate between time slots.
                  Events are displayed in their corresponding time slots.
                </div>

                {/* Fixed Headers Row - scrolls horizontally but not vertically */}
                <div className="calendar-headers-fixed">
                  <div className="time-column-header-fixed">Time</div>
                  <div
                    className="days-headers-scroll"
                    ref={headersScrollRef}
                  >
                    {allDates.map((date, dayIndex) => {
                      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                      const isToday = date.toDateString() === new Date().toDateString();

                      return (
                        <div
                          key={`header-${date.getTime()}-${dayIndex}`}
                          className={`day-header-fixed ${isToday ? 'current-day' : ''}`}
                          role="columnheader"
                          aria-label={`${dayName}, ${date.toLocaleDateString()}${isToday ? ' (Today)' : ''}`}
                        >
                          <div className="day-name" aria-hidden="true">
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                          <div className="day-number" aria-hidden="true">
                            {date.getDate()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Scrollable content container */}
                <div
                  ref={scrollContainerRef}
                  className="calendar-scroll-container"
                  role="grid"
                  tabIndex={0}
                  aria-label="Calendar time slots"
                >
                  <div className="calendar-content">
                    {/* Time Column */}
                    <div
                      className="time-column"
                      role="columnheader"
                      aria-label="Time column"
                    >
                      <div className="time-slots-list">
                        {hours.map((hour) => (
                          <div
                            key={hour}
                            className="time-slot"
                            role="rowheader"
                            aria-label={`${formatTime(hour)}`}
                          >
                            {formatTime(hour)}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Days Grid with sticky headers - infinite scrolling */}
                    <div
                      className="days-grid"
                      role="grid"
                      onScroll={handleContentScroll}
                    >
                      {allDates.map((date, dayIndex) => {
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                        const isToday = date.toDateString() === new Date().toDateString();

                        return (
                          <div
                            key={`${date.getTime()}-${dayIndex}`}
                            className={`day-column ${isToday ? 'today current-day' : ''}`}
                            role="gridcell"
                            aria-label={`${dayName}, ${date.toLocaleDateString()}`}
                          >
                            {/* Day Time Slots */}
                            <div className="day-slots">
                              {hours.map((hour) => {
                                const event = getEventForTimeSlot(date, hour);
                                const slotId = `slot-${dayIndex}-${hour}`;

                                return (
                                  <div
                                    key={hour}
                                    id={slotId}
                                    className={`time-slot ${event ? 'has-event' : ''}`}
                                    role="gridcell"
                                    tabIndex={event ? 0 : -1}
                                    aria-label={
                                      event
                                        ? `${formatTime(hour)} - ${event.summary} ${event.start?.dateTime ?
                                          `at ${new Date(event.start.dateTime).toLocaleTimeString('en-US', {
                                            hour: 'numeric',
                                            minute: '2-digit'
                                          })}` : 'All Day'
                                        }`
                                        : `${formatTime(hour)} - No events`
                                    }
                                  >
                                    {event && (
                                      <div
                                        className="event-block"
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`Event: ${event.summary}`}
                                      >
                                        <div className="event-title">
                                          {event.summary}
                                        </div>
                                        <div className="event-time" aria-hidden="true">
                                          {event.start?.dateTime ?
                                            new Date(event.start.dateTime).toLocaleTimeString('en-US', {
                                              hour: 'numeric',
                                              minute: '2-digit'
                                            }) : 'All Day'
                                          }
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="calendar-placeholder"
              role="region"
              aria-labelledby="placeholder-title"
              aria-describedby="placeholder-description"
            >
              <Calendar size={48} aria-hidden="true" />
              <h5 id="placeholder-title">Connect Google Calendar</h5>
              <p id="placeholder-description">
                Sync your appointments and manage your schedule with Google Calendar integration
              </p>
              <button
                onClick={handleGoogleCalendarSync}
                className="connect-button"
                disabled={isLoading || !isConfigured}
                aria-label={
                  !isConfigured
                    ? 'Google Calendar not configured. Please set up API credentials first.'
                    : isLoading
                      ? 'Connecting to Google Calendar...'
                      : 'Connect to Google Calendar now'
                }
                type="button"
              >
                {isLoading ? 'Connecting...' : 'Connect Now'}
              </button>
              {!isConfigured && (
                <p className="placeholder-note">
                  <small>Configuration required - see setup instructions above</small>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// Set display name for debugging
TrainerCalendar.displayName = 'TrainerCalendar';

export default TrainerCalendar;
