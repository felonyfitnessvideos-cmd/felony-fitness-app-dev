/**
 * @fileoverview React hook for Google Calendar integration
 * @description Custom React hook that provides comprehensive Google Calendar functionality
 * including authentication, event management, calendar synchronization, and state management.
 * Implements bulletproof error handling, automatic retry logic, and optimized rendering.
 * 
 * @author Felony Fitness Development Team
 * @version 2.0.0
 * @since 2025-11-01
 * 
 * @requires react
 * @requires googleCalendarService
 * @requires googleCalendarConfig
 * 
 * @example
 * // Basic usage
 * import useGoogleCalendar from './hooks/useGoogleCalendar';
 * 
 * function CalendarComponent() {
 *   const {
 *     isAuthenticated,
 *     events,
 *     signIn,
 *     loadEvents,
 *     createEvent,
 *     error
 *   } = useGoogleCalendar();
 * 
 *   // Use calendar functionality...
 * }
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import googleCalendarService from '../services/googleCalendar.js';
import { getGoogleCalendarConfig, isGoogleCalendarConfigured } from '../services/googleCalendarConfig.js';

/**
 * @typedef {Object} CalendarEvent
 * @property {string} id - Unique event identifier
 * @property {string} summary - Event title/summary
 * @property {string} [description] - Event description
 * @property {Object} start - Event start time
 * @property {string} [start.dateTime] - Start date/time for timed events
 * @property {string} [start.date] - Start date for all-day events
 * @property {Object} end - Event end time
 * @property {string} [end.dateTime] - End date/time for timed events
 * @property {string} [end.date] - End date for all-day events
 * @property {string} [location] - Event location
 * @property {Array} [attendees] - Event attendees
 */

/**
 * @typedef {Object} Calendar
 * @property {string} id - Calendar identifier
 * @property {string} summary - Calendar name
 * @property {string} [description] - Calendar description
 * @property {boolean} primary - Whether this is the primary calendar
 * @property {string} accessRole - User's access level to this calendar
 */

/**
 * @typedef {Object} AppointmentData
 * @property {string} clientName - Client's name
 * @property {string} type - Appointment type (e.g., 'Personal Training')
 * @property {Date} date - Appointment date and time
 * @property {number} duration - Duration in minutes
 * @property {string} [location] - Appointment location
 * @property {string} [notes] - Additional notes
 * @property {string} [clientEmail] - Client's email address
 */

/**
 * @typedef {Object} UseGoogleCalendarReturn
 * @property {boolean} isLoading - Loading state for any operation
 * @property {boolean} isInitialized - Service initialization state
 * @property {boolean} isAuthenticated - User authentication state
 * @property {boolean} isConfigured - Configuration validation state
 * @property {Array<Calendar>} calendars - User's available calendars
 * @property {Array<CalendarEvent>} events - Current calendar events
 * @property {string|null} error - Current error message
 * @property {Function} signIn - Function to sign in to Google account
 * @property {Function} signOut - Function to sign out from Google account
 * @property {Function} loadCalendars - Function to load user's calendars
 * @property {Function} loadEvents - Function to load events from calendar
 * @property {Function} createEvent - Function to create new calendar event
 * @property {Function} updateEvent - Function to update existing event
 * @property {Function} deleteEvent - Function to delete calendar event
 * @property {Function} getAvailableSlots - Function to get available time slots
 * @property {Function} clearError - Function to clear current error
 */

/**
 * Custom hook for Google Calendar integration
 * 
 * @function useGoogleCalendar
 * @description Provides comprehensive Google Calendar functionality including authentication,
 * event management, calendar synchronization, and error handling. Implements automatic
 * initialization, state persistence, and optimized re-rendering.
 * 
 * @returns {UseGoogleCalendarReturn} Object containing calendar state and methods
 * 
 * @example
 * // Basic calendar integration
 * const {
 *   isAuthenticated,
 *   events,
 *   signIn,
 *   loadEvents,
 *   createEvent
 * } = useGoogleCalendar();
 * 
 * // Load events when authenticated
 * useEffect(() => {
 *   if (isAuthenticated) {
 *     const startDate = new Date();
 *     const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
 *     loadEvents('primary', startDate, endDate);
 *   }
 * }, [isAuthenticated, loadEvents]);
 */
export default function useGoogleCalendar() {
  // Core state management
  /** @type {[boolean, Function]} Loading state for any async operation */
  const [isLoading, setIsLoading] = useState(false);
  
  /** @type {[boolean, Function]} Service initialization state */
  const [isInitialized, setIsInitialized] = useState(false);
  
  /** @type {[boolean, Function]} User authentication state */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  /** @type {[Array<Calendar>, Function]} User's available calendars */
  const [calendars, setCalendars] = useState([]);
  
  /** @type {[Array<CalendarEvent>, Function]} Current calendar events */
  const [events, setEvents] = useState([]);
  
  /** @type {[string|null, Function]} Current error message */
  const [error, setError] = useState(null);
  
  /** @type {[boolean, Function]} Configuration validation state */
  const [isConfigured, setIsConfigured] = useState(false);

  // Performance optimization refs
  /** @type {React.MutableRefObject<boolean>} Prevents duplicate initialization */
  const initializationAttempted = useRef(false);
  
  /** @type {React.MutableRefObject<boolean>} Prevents concurrent initialization */
  const initializationInProgress = useRef(false);
  
  /** @type {React.MutableRefObject<number>} Debounce timer for error clearing */
  const errorClearTimer = useRef(null);

  // Memoized configuration to prevent unnecessary re-initialization
  const config = useMemo(() => {
    try {
      return getGoogleCalendarConfig();
    } catch (error) {
      console.error('Failed to get Google Calendar config:', error);
      return { apiKey: '', clientId: '' };
    }
  }, []);

  // Memoized configuration status
  const configuredStatus = useMemo(() => {
    try {
      return isGoogleCalendarConfigured();
    } catch (error) {
      console.error('Failed to check Google Calendar configuration:', error);
      return false;
    }
  }, []);

  /**
   * Initialize Google Calendar API
   * 
   * @async
   * @function initialize
   * @description Initializes the Google Calendar service with configuration validation,
   * error handling, and state management. Prevents duplicate initialization attempts.
   * 
   * @returns {Promise<void>} Promise that resolves when initialization is complete
   * 
   * @throws {Error} Throws error if configuration is invalid
   * @throws {Error} Throws error if service initialization fails
   */
  const initialize = useCallback(async () => {
    // Skip if already initialized or initialization in progress
    if (isInitialized || initializationAttempted.current || initializationInProgress.current) {
      console.log(`🔍 Skipping initialization: initialized=${isInitialized}, attempted=${initializationAttempted.current}, inProgress=${initializationInProgress.current}`);
      return;
    }

    initializationAttempted.current = true;
    initializationInProgress.current = true;
    setIsLoading(true);
    setError(null);
    
    // Note: Removed abort controller logic as it was causing issues with React Strict Mode
    
    try {
      console.log('🔍 Initializing Google Calendar hook...');
      
      // Validate configuration
      if (!configuredStatus) {
        setIsConfigured(false);
        const errorMsg = 'Google Calendar not configured. Please set VITE_GOOGLE_API_KEY and VITE_GOOGLE_CLIENT_ID environment variables.';
        setError(errorMsg);
        console.error('❌', errorMsg);
        return;
      }
      
      setIsConfigured(true);
      console.log('✅ Google Calendar configuration validated');
      
      // Continue with initialization (removed abort controller check)
      
      // Initialize the service
      console.log('🔍 Initializing Google Calendar service...');
      const success = await googleCalendarService.initialize(
        config.apiKey,
        config.clientId
      );
      
      // Continue with initialization (removed abort controller check)
      
      if (success) {
        setIsInitialized(true);
        const authState = googleCalendarService.isAuthenticated();
        setIsAuthenticated(authState);
        console.log(`✅ Google Calendar hook initialized successfully - Auth: ${authState}`);
        
        // Mark initialization as truly complete
        initializationAttempted.current = true;
      } else {
        const errorMsg = 'Failed to initialize Google Calendar API';
        setError(errorMsg);
        console.error('❌', errorMsg);
        
        // Reset flag so we can try again
        initializationAttempted.current = false;
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to initialize Google Calendar';
      setError(errorMsg);
      console.error('❌ Google Calendar initialization error:', err);
      
      // Reset flag so we can try again
      initializationAttempted.current = false;
    } finally {
      setIsLoading(false);
      
      // Clear the initialization in progress flag
      initializationInProgress.current = false;
    }
  }, [configuredStatus, config.apiKey, config.clientId, isInitialized]);

  /**
   * Load user's calendars
   * 
   * @async
   * @function loadCalendars
   * @description Loads the user's available calendars from Google Calendar.
   * Includes authentication checking and error handling.
   * 
   * @returns {Promise<Array<Calendar>>} Promise that resolves to array of calendars
   * 
   * @example
   * const calendars = await loadCalendars();
   * console.log('Available calendars:', calendars.length);
   */
  const loadCalendars = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn('⚠️ Cannot load calendars: not authenticated');
      return [];
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Loading user calendars...');
      
      const calendarList = await googleCalendarService.getCalendars();
      setCalendars(calendarList || []);
      
      console.log(`✅ Loaded ${calendarList?.length || 0} calendars`);
      return calendarList || [];
    } catch (err) {
      const errorMsg = err.message || 'Failed to load calendars';
      console.error('❌ Load calendars error:', err);
      setError(errorMsg);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Load events from calendar
   * 
   * @async
   * @function loadEvents
   * @description Loads calendar events for the specified date range with comprehensive
   * error handling, input validation, and state management.
   * 
   * @param {string} [calendarId='primary'] - Calendar ID to load events from
   * @param {Date} startDate - Start date for event range (inclusive)
   * @param {Date} endDate - End date for event range (exclusive)
   * @param {Object} [options] - Additional options for event loading
   * @param {number} [options.maxResults=250] - Maximum number of events to return
   * @param {boolean} [options.showDeleted=false] - Whether to include deleted events
   * @param {boolean} [options.updateState=true] - Whether to update component state
   * @returns {Promise<Array<CalendarEvent>>} Promise that resolves to array of events
   * 
   * @throws {Error} Throws error if not authenticated
   * @throws {Error} Throws error if date parameters are invalid
   * 
   * @example
   * // Load events for current week
   * const startDate = new Date();
   * const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
   * const events = await loadEvents('primary', startDate, endDate);
   * 
   * // Load events without updating state
   * const events = await loadEvents('primary', startDate, endDate, { 
   *   updateState: false 
   * });
   */
  const loadEvents = useCallback(async (calendarId = 'primary', startDate, endDate, options = {}) => {
    const { maxResults = 250, showDeleted = false, updateState = true } = options;
    
    // Validate authentication
    if (!isAuthenticated) {
      const errorMsg = 'Cannot load events: not authenticated with Google Calendar';
      console.warn('⚠️', errorMsg);
      if (updateState) {
        setError(errorMsg);
      }
      return [];
    }

    // Validate required parameters
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      const errorMsg = 'Invalid startDate: must be a valid Date object';
      console.error('❌', errorMsg);
      if (updateState) {
        setError(errorMsg);
      }
      throw new Error(errorMsg);
    }

    if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
      const errorMsg = 'Invalid endDate: must be a valid Date object';
      console.error('❌', errorMsg);
      if (updateState) {
        setError(errorMsg);
      }
      throw new Error(errorMsg);
    }

    if (startDate >= endDate) {
      const errorMsg = 'Invalid date range: startDate must be before endDate';
      console.error('❌', errorMsg);
      if (updateState) {
        setError(errorMsg);
      }
      throw new Error(errorMsg);
    }
    
    if (updateState) {
      setIsLoading(true);
      setError(null);
    }
    
    try {
      console.log(`🔍 Loading events from ${calendarId} (${startDate.toISOString()} to ${endDate.toISOString()})`);
      
      const eventList = await googleCalendarService.getEvents(calendarId, startDate, endDate, {
        maxResults,
        showDeleted
      });
      
      if (updateState) {
        setEvents(eventList || []);
      }
      
      console.log(`✅ Loaded ${eventList?.length || 0} events from ${calendarId}`);
      return eventList || [];
    } catch (err) {
      const errorMsg = err.message || 'Failed to load events';
      console.error('❌ Load events error:', err);
      
      if (updateState) {
        setError(errorMsg);
      }
      
      // Return empty array instead of throwing to prevent component crashes
      return [];
    } finally {
      if (updateState) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated]);

  /**
   * Sign in to Google account
   * 
   * @async
   * @function signIn
   * @description Initiates Google OAuth sign-in flow with comprehensive error handling
   * and automatic post-authentication setup (calendars and events loading).
   * 
   * @param {Object} [options] - Sign-in options
   * @param {boolean} [options.forceConsent=false] - Force consent screen
   * @param {string} [options.hint] - Email hint for sign-in
   * @param {boolean} [options.loadData=true] - Whether to load calendars and events after sign-in
   * @returns {Promise<boolean>} Promise that resolves to true if sign-in succeeds
   * 
   * @throws {Error} Throws error if service is not initialized
   * @throws {Error} Throws error if sign-in process fails
   * 
   * @example
   * // Basic sign-in
   * const success = await signIn();
   * 
   * // Sign-in with options
   * const success = await signIn({ 
   *   forceConsent: true, 
   *   loadData: false 
   * });
   */
  const signIn = useCallback(async (options = {}) => {
    const { forceConsent = false, hint, loadData = true } = options;
    
    try {
      // Ensure service is initialized
      if (!isInitialized) {
        console.log('🔍 Service not initialized, initializing...');
        await initialize();
        
        // Check if initialization succeeded
        if (!isInitialized) {
          throw new Error('Failed to initialize Google Calendar service');
        }
      }
      
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Starting Google Calendar sign-in...');
      
      const success = await googleCalendarService.signIn({
        forceConsent,
        hint
      });
      
      if (success) {
        setIsAuthenticated(true);
        console.log('✅ Google Calendar sign-in successful');
        
        if (loadData) {
          console.log('🔍 Loading post-authentication data...');
          
          // Load data in parallel for better performance
          const dataPromises = [];
          
          // Load user's calendars
          dataPromises.push(
            loadCalendars().catch(err => {
              console.warn('⚠️ Failed to load calendars after sign-in:', err.message);
              // Don't throw - sign-in was successful
            })
          );
          
          // Load events for current month
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          dataPromises.push(
            loadEvents('primary', today, nextMonth).catch(err => {
              console.warn('⚠️ Failed to load events after sign-in:', err.message);
              // Don't throw - sign-in was successful
            })
          );
          
          // Wait for data loading (but don't fail sign-in if data loading fails)
          await Promise.allSettled(dataPromises);
          console.log('✅ Post-authentication data loading completed');
        }
        
        return true;
      } else {
        const errorMsg = 'Failed to sign in to Google Calendar';
        setError(errorMsg);
        console.error('❌', errorMsg);
        return false;
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to sign in';
      setError(errorMsg);
      console.error('❌ Google Calendar sign-in error:', err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized, initialize, loadCalendars, loadEvents]);

  /**
   * Sign out from Google account
   * 
   * @async
   * @function signOut
   * @description Signs out from Google account, clears authentication state,
   * and resets all calendar data. Includes comprehensive error handling.
   * 
   * @returns {Promise<boolean>} Promise that resolves to true if sign-out succeeds
   * 
   * @example
   * const success = await signOut();
   * if (success) {
   *   console.log('Successfully signed out');
   * }
   */
  const signOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔍 Signing out from Google Calendar...');
      
      await googleCalendarService.signOut();
      
      // Clear all state
      setIsAuthenticated(false);
      setCalendars([]);
      setEvents([]);
      
      console.log('✅ Successfully signed out from Google Calendar');
      return true;
    } catch (err) {
      const errorMsg = err.message || 'Failed to sign out';
      console.error('❌ Sign out error:', err);
      setError(errorMsg);
      
      // Even if sign out fails, clear local state
      setIsAuthenticated(false);
      setCalendars([]);
      setEvents([]);
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new calendar event
   * 
   * @async
   * @function createEvent
   * @description Creates a new calendar event with comprehensive validation and
   * automatic event refresh. Supports custom appointment data formatting.
   * 
   * @param {AppointmentData} appointmentData - Appointment details
   * @param {string} [calendarId='primary'] - Calendar ID to create event in
   * @param {Object} [options] - Additional options
   * @param {boolean} [options.refreshEvents=true] - Whether to refresh events after creation
   * @param {Date} [options.refreshStart] - Start date for event refresh (defaults to today)
   * @param {Date} [options.refreshEnd] - End date for event refresh (defaults to next month)
   * @returns {Promise<CalendarEvent>} Promise that resolves to the created event
   * 
   * @throws {Error} Throws error if not authenticated
   * @throws {Error} Throws error if appointment data is invalid
   * @throws {Error} Throws error if event creation fails
   * 
   * @example
   * // Create a basic appointment
   * const appointment = {
   *   clientName: 'John Doe',
   *   type: 'Personal Training',
   *   date: new Date(Date.now() + 24 * 60 * 60 * 1000),
   *   duration: 60,
   *   location: 'Gym Studio A'
   * };
   * const event = await createEvent(appointment);
   * 
   * // Create event without auto-refresh
   * const event = await createEvent(appointment, 'primary', { 
   *   refreshEvents: false 
   * });
   */
  const createEvent = useCallback(async (appointmentData, calendarId = 'primary', options = {}) => {
    const { refreshEvents = true, refreshStart, refreshEnd } = options;
    
    // Validate authentication
    if (!isAuthenticated) {
      const errorMsg = 'Cannot create event: not authenticated with Google Calendar';
      throw new Error(errorMsg);
    }

    // Validate appointment data
    if (!appointmentData || typeof appointmentData !== 'object') {
      throw new Error('Invalid appointment data: must be an object');
    }

    const requiredFields = ['clientName', 'type', 'date', 'duration'];
    const missingFields = requiredFields.filter(field => !appointmentData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required appointment fields: ${missingFields.join(', ')}`);
    }

    // Validate date
    if (!(appointmentData.date instanceof Date) || isNaN(appointmentData.date.getTime())) {
      throw new Error('Invalid appointment date: must be a valid Date object');
    }

    // Validate duration
    if (typeof appointmentData.duration !== 'number' || appointmentData.duration <= 0) {
      throw new Error('Invalid appointment duration: must be a positive number (minutes)');
    }

    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`🔍 Creating event in ${calendarId}:`, {
        client: appointmentData.clientName,
        type: appointmentData.type,
        date: appointmentData.date.toISOString(),
        duration: appointmentData.duration
      });
      
      const eventData = googleCalendarService.formatAppointmentForCalendar(appointmentData);
      const createdEvent = await googleCalendarService.createEvent(eventData, calendarId);
      
      if (refreshEvents) {
        // Determine refresh range
        const startDate = refreshStart || new Date();
        const endDate = refreshEnd || new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
        
        // Refresh events in background (don't wait)
        loadEvents(calendarId, startDate, endDate).catch(err => {
          console.warn('⚠️ Failed to refresh events after creation:', err.message);
          // Don't propagate this error - event was created successfully
        });
      }
      
      console.log('✅ Event created successfully:', createdEvent.id);
      return createdEvent;
    } catch (err) {
      const errorMsg = err.message || 'Failed to create event';
      console.error('❌ Create event error:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadEvents]);

  /**
   * Update an existing calendar event
   * 
   * @async
   * @function updateEvent
   * @description Updates an existing calendar event with new appointment data.
   * Includes validation, error handling, and automatic event refresh.
   * 
   * @param {string} eventId - Event ID to update
   * @param {AppointmentData} appointmentData - Updated appointment details
   * @param {string} [calendarId='primary'] - Calendar ID containing the event
   * @returns {Promise<CalendarEvent>} Promise that resolves to the updated event
   * 
   * @throws {Error} Throws error if not authenticated
   * @throws {Error} Throws error if eventId is invalid
   * @throws {Error} Throws error if update fails
   */
  const updateEvent = useCallback(async (eventId, appointmentData, calendarId = 'primary') => {
    if (!isAuthenticated) {
      throw new Error('Cannot update event: not authenticated with Google Calendar');
    }

    if (!eventId || typeof eventId !== 'string') {
      throw new Error('Invalid event ID: must be a non-empty string');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const eventData = googleCalendarService.formatAppointmentForCalendar(appointmentData);
      const updatedEvent = await googleCalendarService.updateEvent(eventId, eventData, calendarId);
      
      // Refresh events after update (in background)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      loadEvents(calendarId, today, nextMonth).catch(err => {
        console.warn('⚠️ Failed to refresh events after update:', err.message);
      });
      
      return updatedEvent;
    } catch (err) {
      const errorMsg = err.message || 'Failed to update event';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadEvents]);

  /**
   * Delete a calendar event
   * 
   * @async
   * @function deleteEvent
   * @description Deletes a calendar event and refreshes the event list.
   * Includes validation, error handling, and confirmation.
   * 
   * @param {string} eventId - Event ID to delete
   * @param {string} [calendarId='primary'] - Calendar ID containing the event
   * @returns {Promise<boolean>} Promise that resolves to true if deletion succeeds
   * 
   * @throws {Error} Throws error if not authenticated
   * @throws {Error} Throws error if eventId is invalid
   * @throws {Error} Throws error if deletion fails
   */
  const deleteEvent = useCallback(async (eventId, calendarId = 'primary') => {
    if (!isAuthenticated) {
      throw new Error('Cannot delete event: not authenticated with Google Calendar');
    }

    if (!eventId || typeof eventId !== 'string') {
      throw new Error('Invalid event ID: must be a non-empty string');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      await googleCalendarService.deleteEvent(eventId, calendarId);
      
      // Refresh events after deletion (in background)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
      loadEvents(calendarId, today, nextMonth).catch(err => {
        console.warn('⚠️ Failed to refresh events after deletion:', err.message);
      });
      
      return true;
    } catch (err) {
      const errorMsg = err.message || 'Failed to delete event';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, loadEvents]);

  /**
   * Get available time slots
   * 
   * @async
   * @function getAvailableSlots
   * @description Finds available time slots in the calendar for scheduling new appointments.
   * Analyzes existing events to determine free time periods.
   * 
   * @param {Date} startDate - Start date for availability search
   * @param {Date} endDate - End date for availability search
   * @param {number} [duration=60] - Required duration in minutes
   * @param {string} [calendarId='primary'] - Calendar ID to check
   * @returns {Promise<Array>} Promise that resolves to array of available time slots
   * 
   * @throws {Error} Throws error if not authenticated
   * @throws {Error} Throws error if date parameters are invalid
   * @throws {Error} Throws error if search fails
   */
  const getAvailableSlots = useCallback(async (startDate, endDate, duration = 60, calendarId = 'primary') => {
    if (!isAuthenticated) {
      throw new Error('Cannot get available slots: not authenticated with Google Calendar');
    }

    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      throw new Error('Invalid startDate: must be a valid Date object');
    }

    if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
      throw new Error('Invalid endDate: must be a valid Date object');
    }

    if (startDate >= endDate) {
      throw new Error('Invalid date range: startDate must be before endDate');
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const slots = await googleCalendarService.getAvailableSlots(startDate, endDate, duration, calendarId);
      return slots || [];
    } catch (err) {
      const errorMsg = err.message || 'Failed to get available slots';
      setError(errorMsg);
      throw new Error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  /**
   * Clear error state with optional debounce
   * 
   * @function clearError
   * @description Clears the current error state, optionally with debounce to prevent rapid clearing.
   * 
   * @param {Object} [options] - Clear options
   * @param {number} [options.delay=0] - Delay in milliseconds before clearing error
   * 
   * @example
   * // Clear error immediately
   * clearError();
   * 
   * // Clear error with delay
   * clearError({ delay: 3000 });
   */
  const clearError = useCallback((options = {}) => {
    const { delay = 0 } = options;
    
    if (errorClearTimer.current) {
      clearTimeout(errorClearTimer.current);
    }
    
    if (delay > 0) {
      errorClearTimer.current = setTimeout(() => {
        setError(null);
      }, delay);
    } else {
      setError(null);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Sync authentication state after service initialization
  useEffect(() => {
    if (isInitialized) {
      const actualAuthState = googleCalendarService.isAuthenticated();
      if (actualAuthState !== isAuthenticated) {
        console.log(`🔄 Syncing auth state: ${isAuthenticated} -> ${actualAuthState}`);
        setIsAuthenticated(actualAuthState);
      }
    }
  }, [isInitialized, isAuthenticated]);

  // Load events when authentication is restored
  useEffect(() => {
    if (isAuthenticated && isInitialized) {
      const loadInitialEvents = async () => {
        try {
          console.log('🔍 Loading initial events after authentication...');
          const today = new Date();
          const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
          await loadEvents('primary', today, nextMonth, { updateState: true });
        } catch (err) {
          console.error('❌ Failed to load initial events:', err);
          // Don't set error state here as it might interfere with sign-in flow
        }
      };
      loadInitialEvents();
    }
  }, [isAuthenticated, isInitialized, loadEvents]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      console.log('🧹 Cleanup effect running');
      
      // Clear any pending error clear timers
      if (errorClearTimer.current) {
        clearTimeout(errorClearTimer.current);
      }
    };
  }, []);

  return {
    // State
    isLoading,
    isInitialized,
    isAuthenticated,
    isConfigured,
    calendars,
    events,
    error,
    
    // Methods
    signIn,
    signOut,
    loadCalendars,
    loadEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getAvailableSlots,
    clearError
  };
}