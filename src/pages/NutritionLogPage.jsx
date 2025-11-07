
/**
 * @file NutritionLogPage.jsx
 * @description This page allows users to log their daily food and water intake for different meals.
 * @project Felony Fitness
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import SubPageHeader from '../components/SubPageHeader.jsx';
import { supabase } from '../supabaseClient.js';
/**
 * NutritionLogPage — log daily nutrition entries.
 *
 * Responsibilities:
 * - add/edit nutrition log entries with sanitized numeric input
 * - normalize dates and avoid timezone surprises on mobile
 *
 * Notes:
 * - uses text + inputMode for numeric fields to avoid mobile quirks and
 *   sanitizes values before persisting.
 */
import { Apple, Camera, Droplets, Loader2, Search, Trash2, X } from 'lucide-react';
import Modal from 'react-modal';
import { useAuth } from '../AuthContext.jsx';
import './NutritionLogPage.css';


/**
 * @typedef {object} NutritionLog
 * @property {string} id
 * @property {string} meal_type
 * @property {number} quantity_consumed
 * @property {number} [water_oz_consumed]
 * @property {object} food_servings
 * @property {object} food_servings.foods
 * @property {string} food_servings.food_name
 * @property {string} food_servings.serving_description
 * @property {number} food_servings.calories
 * @property {number} food_servings.protein_g
 */

/**
 * @typedef {object} SearchResult
 * @property {boolean} is_external
 * @property {string} [food_id]
 * @property {string} name
 * @property {string} [serving_id]
 * @property {string} serving_description
 * @property {number} calories
 * @property {number} protein_g
 */

/**
 * NutritionLogPage
 * Page for logging food and water. Includes robust timezone-aware queries and
 * defensive guards against missing profile data or partial search results.
 */
function NutritionLogPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const [activeMeal, setActiveMeal] = useState('Breakfast');
  /** @type {[NutritionLog[], React.Dispatch<React.SetStateAction<NutritionLog[]>>]} */
  const [todaysLogs, setTodaysLogs] = useState([]);
  const [goals, setGoals] = useState({ daily_calorie_goal: 2000, daily_protein_goal_g: 150, daily_water_goal_oz: 128 });
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  /** @type {[SearchResult[], React.Dispatch<React.SetStateAction<SearchResult[]>>]} */
  const [searchResults, setSearchResults] = useState([]);
  const searchAbortControllerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  /** @type {[SearchResult | null, React.Dispatch<React.SetStateAction<SearchResult | null>>]} */
  const [selectedFood, setSelectedFood] = useState(null);
  // Store quantity as a string to avoid mobile keyboards auto-inserting values
  // when a numeric input is cleared. We sanitize and parse before submitting.
  const [quantity, setQuantity] = useState('1');
  const [dailyTotals, setDailyTotals] = useState({
    calories: 0, protein: 0, water: 0
  });

  const mealLogs = todaysLogs.filter(log => log.meal_type === activeMeal);
  const calorieProgress = goals.daily_calorie_goal > 0 ? (dailyTotals.calories / goals.daily_calorie_goal) * 100 : 0;

  /**
   * Fetches all nutrition data for the current day and calculates totals.
   * This function uses a robust, timezone-proof method to query the database.
   * @param {string} userId - The UUID of the authenticated user.
   * @async
   */
  const fetchLogData = useCallback(async (userId) => {
    setLoading(true);
    try {
      // **TIMEZONE FIX**: Calculate UTC midnight for today and tomorrow
      // This ensures we query the correct 24-hour period regardless of timezone
      const now = new Date();
      const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const startOfTomorrowUTC = new Date(startOfTodayUTC);
      startOfTomorrowUTC.setUTCDate(startOfTomorrowUTC.getUTCDate() + 1);

      // DEBUGGING: Log the exact timestamps being sent to the database (guarded).
      if (import.meta.env?.DEV) {
        console.debug('Fetching logs between (UTC):', startOfTodayUTC.toISOString(), 'and', startOfTomorrowUTC.toISOString());
      }


      const [logsResponse, profileResponse] = await Promise.all([
        supabase
          .from('nutrition_logs')
          .select('*, food_servings(*)')
          .eq('user_id', userId)
          .gte('created_at', startOfTodayUTC.toISOString())
          .lt('created_at', startOfTomorrowUTC.toISOString()),
        supabase
          .from('user_profiles')
          .select('daily_calorie_goal, daily_protein_goal_g, daily_water_goal_oz')
          .eq('id', userId)
          .single()
      ]);

      if (logsResponse.error) throw logsResponse.error;
      if (profileResponse.error && profileResponse.error.code !== 'PGRST116') throw profileResponse.error;

      const logs = logsResponse.data || [];
      // DEBUGGING: Avoid logging full objects in production; only show non-sensitive fields in development.
      if (import.meta.env?.DEV) {
        try {
          const safePreview = logs.map(l => ({ 
            id: l.id, 
            meal_type: l.meal_type, 
            created_at: l.created_at,
            food_serving_id: l.food_serving_id,
            has_food_servings: !!l.food_servings,
            food_name: l.food_servings?.food_name || 'NULL'
          }));
          console.debug('🔍 Fetched logs (preview):', safePreview);
          // Check for logs with missing food_servings
          const missingServings = logs.filter(l => !l.food_servings);
          if (missingServings.length > 0) {
            console.warn('⚠️ Found logs with missing food_servings:', missingServings.map(l => ({
              id: l.id,
              food_serving_id: l.food_serving_id,
              meal_type: l.meal_type
            })));
          }
        } catch {
          console.debug('Fetched logs (count):', Array.isArray(logs) ? logs.length : typeof logs);
        }
      }
      setTodaysLogs(logs);
      if (profileResponse.data) setGoals(profileResponse.data);

      // **FIX APPLIED**: Calculate totals on the client-side for perfect consistency.
      const totals = logs.reduce((acc, log) => {
        if (log.food_servings) {
          acc.calories += (log.food_servings.calories || 0) * log.quantity_consumed;
          acc.protein += (log.food_servings.protein_g || 0) * log.quantity_consumed;
        }
        if (log.water_oz_consumed) {
          acc.water += log.water_oz_consumed;
        }
        return acc;
      }, { calories: 0, protein: 0, water: 0 });

      setDailyTotals({
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        water: Math.round(totals.water)
      });

    } catch (error) {
      console.error("A critical error occurred during data fetch:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Depend only on the user's id and the stable fetchLogData callback. We
  // intentionally avoid depending on the full `user` object to prevent
  // re-fetches caused by non-essential reference changes.

  useEffect(() => {
    if (userId) {
      fetchLogData(userId);
    } else {
      setLoading(false);
    }
  }, [userId, fetchLogData]);

  const handleSearch = useCallback((term) => {
    setSearchTerm(term);

    // Clear pending debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }

    if (term.length < 3) {
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch (_err) { void _err; /* ignore */ }
        searchAbortControllerRef.current = null;
      }
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch (_err) { void _err; /* ignore */ }
      }
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      setIsSearching(true);
      try {
        // Call the hybrid food-search-v2 Edge Function (enhanced with AI guardrails)
        const { data: searchData, error: functionError } = await supabase.functions.invoke('food-search-v2', {
          body: { query: term }
        });

        if (functionError) {
          console.error('Food search error:', functionError);
          console.error('Search data received:', searchData);
          setSearchResults([]);
          return;
        }

        console.log('Food search successful:', { source: searchData?.source, count: searchData?.results?.length });

        const results = searchData?.results || [];
        const source = searchData?.source || 'unknown';

        // Standardize results format for both local and external sources
        // food-search-v2 now returns flat arrays for both local and external
        const standardizedResults = results.map(item => {
          const isExternal = source === 'external';
          
          return {
            is_external: isExternal,
            food_id: item.id || null,
            name: item.food_name || item.name, // local has food_name, external has name
            serving_id: isExternal ? null : item.id, // External foods don't have IDs yet
            serving_description: item.serving_description,
            // Core macronutrients
            calories: item.calories || 0,
            protein_g: item.protein_g || 0,
            carbs_g: item.carbs_g || 0,
            fat_g: item.fat_g || 0,
            fiber_g: item.fiber_g || 0,
            sugar_g: item.sugar_g || 0,
            // Micronutrients - all default to 0
            sodium_mg: item.sodium_mg || 0,
            calcium_mg: item.calcium_mg || 0,
            iron_mg: item.iron_mg || 0,
            vitamin_c_mg: item.vitamin_c_mg || 0,
            potassium_mg: item.potassium_mg || 0,
            vitamin_a_mcg: item.vitamin_a_mcg || 0,
            vitamin_e_mg: item.vitamin_e_mg || 0,
            vitamin_k_mcg: item.vitamin_k_mcg || 0,
            thiamin_mg: item.thiamin_mg || 0,
            riboflavin_mg: item.riboflavin_mg || 0,
            niacin_mg: item.niacin_mg || 0,
            vitamin_b6_mg: item.vitamin_b6_mg || 0,
            folate_mcg: item.folate_mcg || 0,
            vitamin_b12_mcg: item.vitamin_b12_mcg || 0,
            magnesium_mg: item.magnesium_mg || 0,
            phosphorus_mg: item.phosphorus_mg || 0,
            zinc_mg: item.zinc_mg || 0,
            copper_mg: item.copper_mg || 0,
            selenium_mcg: item.selenium_mcg || 0,
            // Metadata
            brand: item.brand || null,
            category: item.category || null,
            pdcaas_score: item.pdcaas_score || 0,
            quality_score: item.quality_score || 0,
          };
        });

        setSearchResults(standardizedResults);
      } catch (error) {
        if (error?.name === 'AbortError') {
          // ignore
        } else {
          console.error('Error searching food:', error?.message || error);
        }
      } finally {
        setIsSearching(false);
        searchAbortControllerRef.current = null;
      }
    }, 300);
  }, []);

  const openLogModal = async (food) => {
    if (food.needs_serving_fetch) {
      // Fetch servings for this food
      try {
        const { data: servings, error } = await supabase
          .from('food_servings')
          .select('*')
          .eq('food_id', food.food_id);

        if (error) {
          console.error('Error fetching servings:', error);
          return;
        }

        if (servings && servings.length > 0) {
          // Use the first serving as default, or show a selection if multiple
          const defaultServing = servings[0];
          const updatedFood = {
            ...food,
            serving_id: defaultServing.id,
            serving_description: defaultServing.serving_description,
            calories: defaultServing.calories,
            protein_g: defaultServing.protein_g,
            carbs_g: defaultServing.carbs_g,
            fat_g: defaultServing.fat_g,
            needs_serving_fetch: false
          };
          setSelectedFood(updatedFood);
        } else {
          console.error('No servings found for food:', food.name);
          return;
        }
      } catch (error) {
        console.error('Error fetching food servings:', error);
        return;
      }
    } else {
      setSelectedFood(food);
    }
    setIsLogModalOpen(true);
  };

  const closeLogModal = () => {
    setIsLogModalOpen(false);
    setSelectedFood(null);
    setSearchTerm('');
    setSearchResults([]);
    setQuantity('1');
  };

  const handleLogFood = async () => {
    // Normalize quantity to a number for validation and payload.
    const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
    if (!selectedFood || !qty || qty <= 0 || Number.isNaN(qty) || !user) return;

    try {
      console.log('🔍 DEBUG: Logging food:', selectedFood);

      let servingId = selectedFood.serving_id;

      // If this is an external food without a serving_id, create a food_servings record first
      if (!servingId && selectedFood.is_external) {
        console.log('🔍 External food detected, creating food_servings record...');
        
        const { data: newServing, error: servingError } = await supabase
          .from('food_servings')
          .insert({
            food_name: selectedFood.name,
            serving_description: selectedFood.serving_description || '1 serving',
            // Core macronutrients
            calories: selectedFood.calories || 0,
            protein_g: selectedFood.protein_g || 0,
            carbs_g: selectedFood.carbs_g || 0,
            fat_g: selectedFood.fat_g || 0,
            fiber_g: selectedFood.fiber_g || 0,
            sugar_g: selectedFood.sugar_g || 0,
            // Micronutrients - explicitly set to 0 if not provided
            sodium_mg: selectedFood.sodium_mg || 0,
            calcium_mg: selectedFood.calcium_mg || 0,
            iron_mg: selectedFood.iron_mg || 0,
            vitamin_c_mg: selectedFood.vitamin_c_mg || 0,
            potassium_mg: selectedFood.potassium_mg || 0,
            vitamin_a_mcg: selectedFood.vitamin_a_mcg || 0,
            vitamin_e_mg: selectedFood.vitamin_e_mg || 0,
            vitamin_k_mcg: selectedFood.vitamin_k_mcg || 0,
            thiamin_mg: selectedFood.thiamin_mg || 0,
            riboflavin_mg: selectedFood.riboflavin_mg || 0,
            niacin_mg: selectedFood.niacin_mg || 0,
            vitamin_b6_mg: selectedFood.vitamin_b6_mg || 0,
            folate_mcg: selectedFood.folate_mcg || 0,
            vitamin_b12_mcg: selectedFood.vitamin_b12_mcg || 0,
            magnesium_mg: selectedFood.magnesium_mg || 0,
            phosphorus_mg: selectedFood.phosphorus_mg || 0,
            zinc_mg: selectedFood.zinc_mg || 0,
            copper_mg: selectedFood.copper_mg || 0,
            selenium_mcg: selectedFood.selenium_mcg || 0,
            // Metadata
            brand: selectedFood.brand || null,
            category: selectedFood.category || null,
            pdcaas_score: selectedFood.pdcaas_score || 0,
            data_sources: 'openai',
            quality_score: selectedFood.quality_score || 70,
            enrichment_status: 'completed',
            last_enrichment: new Date().toISOString(),
            is_verified: false,
            source: 'external_api'
          })
          .select()
          .single();

        if (servingError) {
          console.error('❌ Error creating food_servings record:', servingError);
          alert(`Error saving food: ${servingError.message}`);
          return;
        }

        servingId = newServing.id;
        console.log('✅ Created food_servings record:', servingId);
      }

      // Now insert the nutrition log
      const { data, error } = await supabase
        .from('nutrition_logs')
        .insert({
          user_id: user.id,
          food_serving_id: servingId,
          meal_type: activeMeal,
          quantity_consumed: qty
        })
        .select();

      if (error) {
        console.error('❌ Error logging food:', error);
        alert(`Error logging food: ${error.message}`);
      } else {
        console.log('✅ Food logged successfully:', data);
        await fetchLogData(user.id);
        closeLogModal();
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      alert(`Error logging food: ${error.message}`);
    }
  };

  const handleLogWater = async (ounces) => {
    if (!user) return;
    const { error } = await supabase.from('nutrition_logs').insert({
      user_id: user.id,
      meal_type: 'Water',
      water_oz_consumed: ounces,
      // We no longer need to set log_date; created_at is handled automatically
    });
    if (error) {
      alert(`Error logging water: ${error.message}`);
    } else {
      await fetchLogData(user.id);
    }
  };

  const handleDeleteFoodLog = async (logId) => {
    if (!user || !logId) return;

    if (!confirm('Are you sure you want to delete this food entry?')) {
      return;
    }

    const { error } = await supabase
      .from('nutrition_logs')
      .delete()
      .eq('id', logId)
      .eq('user_id', user.id); // Extra security check

    if (error) {
      console.error('Error deleting food log:', error);
      alert(`Error deleting food entry: ${error.message}`);
    } else {
      await fetchLogData(user.id); // Refresh the data
    }
  };

  // Cleanup debounce timer and abort controller on unmount
  // NOTE: This cleanup effect must be declared before any early returns
  // (for example `if (loading) return ...`). React hooks must be called
  // in the same order on every render — moving this effect above the
  // early return ensures the component's hook call order remains stable
  // and avoids the "change in the order of Hooks" runtime error.
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch { /* ignore */ }
        searchAbortControllerRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return <div style={{ color: 'white', padding: '2rem' }}>Loading Nutrition Log...</div>;
  }

  return (
    <div className="nutrition-log-page-container">
      <SubPageHeader title="Log" icon={<Apple size={28} />} iconColor="#f97316" backTo="/nutrition" />

      <div className="meal-tabs">
        {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map(meal => (
          <button key={meal} className={activeMeal === meal ? 'active' : ''} onClick={() => setActiveMeal(meal)}>{meal}</button>
        ))}
      </div>

      <div className="search-bar-wrapper">
        <Search className="search-icon" size={20} />
        <input
          type="text"
          placeholder="Search for a food..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          disabled={!user}
        />
        <button className="camera-btn"><Camera size={20} /></button>
        {(isSearching || searchResults.length > 0) && (
          <div className="food-search-results">
            {isSearching && <div className="search-loading"><Loader2 className="animate-spin" /></div>}
            {!isSearching && searchResults.map((food, index) => (
              <div key={`${food.food_id}-${food.serving_id}-${index}`} className="food-search-item" onClick={() => openLogModal(food)}>
                <span>{food.name}</span>
                <span className="search-item-serving">{food.serving_description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="water-log-card">
        <div className="water-log-header">
          <Droplets size={20} />
          <h3>Water Intake</h3>
          <span>{dailyTotals.water} / {goals.daily_water_goal_oz || 128} oz</span>
        </div>
        <div className="water-log-actions">
          <button onClick={() => handleLogWater(8)} disabled={!user}>+ 8 oz</button>
          <button onClick={() => handleLogWater(12)} disabled={!user}>+ 12 oz</button>
          <button onClick={() => handleLogWater(16)} disabled={!user}>+ 16 oz</button>
        </div>
      </div>

      <div className="logged-items-list">
        {!user && <p className="no-items-message">Please log in to see your nutrition log.</p>}
        {user && !loading && mealLogs.length === 0 && (
          <p className="no-items-message">No items logged for {activeMeal} yet.</p>
        )}
        {user && !loading && mealLogs.map(log => (
          log.food_servings ? (
            <div key={log.id} className="food-item-card">
              <div className="food-item-details">
                <h4>{log.food_servings.food_name}</h4>
                <span>{log.quantity_consumed} x {log.food_servings.serving_description}</span>
              </div>
              <div className="food-item-actions">
                <span className="food-item-calories">
                  {Math.round((log.food_servings.calories || 0) * log.quantity_consumed)} cal
                </span>
                <button
                  className="delete-food-btn"
                  onClick={() => handleDeleteFoodLog(log.id)}
                  title="Delete this food entry"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ) : null
        ))}
      </div>

      <div className="calorie-status-footer">
        <div className="calorie-info">
          <span>{dailyTotals.calories} / {goals.daily_calorie_goal || 2000} cal</span>
          <span>{Math.max(0, Math.round(goals.daily_calorie_goal || 2000) - dailyTotals.calories)} left</span>
        </div>
        <div className="calorie-progress-bar-wrapper">
          <div className="calorie-progress-bar" style={{ width: `${calorieProgress > 100 ? 100 : calorieProgress}%` }}></div>
        </div>
      </div>

      <Modal
        isOpen={isLogModalOpen}
        onRequestClose={closeLogModal}
        contentLabel="Log Food Item"
        overlayClassName="custom-modal-overlay"
        className="custom-modal-content log-food-modal"
      >
        {selectedFood && (
          <div className="log-food-modal">
            <div className="modal-header">
              <h3>{selectedFood.name}</h3>
              <button onClick={closeLogModal} className="close-modal-btn"><X size={24} /></button>
            </div>
            <div className="modal-body">
              <p>Serving: {selectedFood.serving_description} ({Math.round(selectedFood.calories)} cal)</p>
              <div className="quantity-input">
                <label htmlFor="quantity">Quantity</label>
                <input
                  id="quantity"
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\.?[0-9]*"
                  value={quantity}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setQuantity('');
                      return;
                    }
                    // Allow only digits and a single decimal point
                    const sanitized = raw.replace(/[^0-9.]/g, '');
                    const parts = sanitized.split('.');
                    const normalized = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : sanitized;
                    const parsed = parseFloat(normalized);
                    setQuantity(Number.isNaN(parsed) ? '' : String(normalized));
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="log-food-btn" onClick={handleLogFood}>
                Add to {activeMeal}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default NutritionLogPage;

