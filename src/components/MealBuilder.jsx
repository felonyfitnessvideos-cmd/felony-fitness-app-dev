import { ChefHat, Plus, Save, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import './MealBuilder.css';

/**
 * MealBuilder component for creating and editing meals with nutrition tracking
 * 
 * This component provides a comprehensive interface for meal creation including:
 * - Real-time nutrition calculation as foods are added
 * - Food search and ingredient management
 * - Meal metadata (name, category, prep time, etc.)
 * - Save/update functionality with Supabase integration
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Callback function when modal is closed
 * @param {Function} props.onSave - Callback function when meal is saved successfully
 * @param {Object|null} props.editingMeal - Existing meal data for editing mode (null for new meal)
 * @param {string[]} props.categories - Available meal categories for selection
 * @returns {JSX.Element|null} Modal component for meal building or null if not open
 * 
 * @example
 * <MealBuilder
 *   isOpen={showBuilder}
 *   onClose={() => setShowBuilder(false)}
 *   onSave={(meal) => handleMealSaved(meal)}
 *   editingMeal={selectedMeal}
 *   categories={['breakfast', 'lunch', 'dinner', 'snack']}
 * />
 */
const MealBuilder = ({
  isOpen,
  onClose,
  onSave,
  editingMeal = null,
  categories = ['breakfast', 'lunch', 'dinner', 'snack']
}) => {
  /** @type {[Object, Function]} State for meal metadata and details */
  const [mealData, setMealData] = useState({
    name: '',
    category: 'breakfast',
    tags: []
  });

  /** @type {[Array, Function]} State for selected meal ingredients with quantities */
  const [mealFoods, setMealFoods] = useState([]);

  /** @type {[string, Function]} State for food search query */
  const [foodSearch, setFoodSearch] = useState('');

  /** @type {[Array, Function]} State for food search results from database */
  const [searchResults, setSearchResults] = useState([]);

  /** @type {[boolean, Function]} State for food search loading indicator */
  const [isSearching, setIsSearching] = useState(false);

  /** @type {React.MutableRefObject} Reference for search debounce timeout */
  const searchDebounceRef = useRef(null);

  /** @type {React.MutableRefObject} Reference for search abort controller */
  const searchAbortControllerRef = useRef(null);

  /** @type {[Object, Function]} State for calculated nutrition totals */
  const [nutrition, setNutrition] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  /** @type {[boolean, Function]} State for meal save operation loading */
  const [isSaving, setIsSaving] = useState(false);

  /**
   * Initialize component state when editing meal changes or modal opens
   * Loads existing meal data for editing mode or resets form for new meal
   */
  useEffect(() => {
    if (editingMeal) {
      setMealData({
        name: editingMeal.name || '',
        category: editingMeal.category || 'breakfast',
        tags: editingMeal.tags || []
      });

      // Load existing meal foods if editing
      if (editingMeal.id) {
        loadMealFoods(editingMeal.id);
      }
    } else {
      // Reset form for new meal
      setMealData({
        name: '',
        category: 'breakfast',
        tags: []
      });
      setMealFoods([]);
    }
  }, [editingMeal, isOpen]);

  /**
   * Calculate total nutrition values for all foods in the meal
   * Updates nutrition state with calculated totals based on food quantities
   * 
   * @returns {void}
   */
  const calculateNutrition = useCallback(() => {
    const totals = mealFoods.reduce((acc, item) => {
      const food = item.food_servings;
      const quantity = item.quantity || 0;

      return {
        calories: acc.calories + (food.calories * quantity || 0),
        protein: acc.protein + (food.protein_g * quantity || 0),
        carbs: acc.carbs + (food.carbs_g * quantity || 0),
        fat: acc.fat + (food.fat_g * quantity || 0)
      };
    }, {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    });

    setNutrition(totals);
  }, [mealFoods]);

  /**
   * Recalculate nutrition totals whenever meal foods are modified
   */
  useEffect(() => {
    calculateNutrition();
  }, [calculateNutrition]);

  // Cleanup search timers and controllers on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      if (searchAbortControllerRef.current) {
        try { searchAbortControllerRef.current.abort(); } catch { /* ignore */ }
        searchAbortControllerRef.current = null;
      }
    };
  }, []);

  /**
   * Load existing meal foods from database for editing mode
   * Fetches meal foods with their associated food_servings data including nutrition information
   * and maps them to the component's expected format for display and editing
   * 
   * @async
   * @param {number} mealId - ID of the meal to load foods for
   * @returns {Promise<void>}
   * @throws {Error} When database query fails or meal foods cannot be loaded
   * 
   * @example
   * await loadMealFoods(123); // Loads foods for meal ID 123
   */
  const loadMealFoods = async (mealId) => {
    try {
      const { data, error } = await supabase
        .from('meal_foods')
        .select(`
          *,
          food_servings (
            id,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            serving_description,
            foods (
              name
            )
          )
        `)
        .eq('meal_id', mealId);

      if (error) throw error;

      setMealFoods(data.map(item => ({
        id: item.id,
        food_servings_id: item.food_servings_id,
        quantity: item.quantity,
        notes: item.notes,
        food_servings: item.food_servings
      })));
    } catch (error) {
      // Error loading meal foods - log for debugging
      console.error('Error loading meal foods:', error);
    }
  };

  /**
   * Search for foods using comprehensive database and external API search
   * 
   * Implements debounced search with abort controller for performance and uses the food-search
   * Supabase Edge Function to query both local database and external food APIs (OpenAI/FatSecret).
   * Results are standardized to a consistent format regardless of source.
   * 
   * @param {string} searchTerm - Search query to match against food names (minimum 1 character)
   * @returns {void} Updates searchResults state with formatted food items
   * 
   * @description
   * Search flow:
   * 1. Debounce input for 300ms to avoid excessive API calls
   * 2. Query food-search Edge Function with search term
   * 3. Handle two possible response sources:
   *    - 'local': Database foods/food_servings join results
   *    - 'external': OpenAI API results (generates temporary IDs)
   * 4. Standardize all results to consistent field names
   * 5. Update searchResults state for display
   * 
   * @example
   * searchFoods('chicken breast'); // Searches for chicken breast foods
   * searchFoods(''); // Clears search results
   */
  const searchFoods = useCallback((searchTerm) => {
    // Clear existing timeout
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!searchTerm.trim()) {
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
        const { data, error } = await supabase.functions.invoke('food-search-v2', {
          body: { query: searchTerm },
          signal: controller.signal,
        });

        if (error) throw error;
        if (controller.signal.aborted) return;

        let standardizedResults = [];
        if (data?.source === 'local') {
          // Database results - convert to consistent format
          standardizedResults = (data.results || []).flatMap(food =>
            (food.food_servings || []).map(serving => ({
              id: serving.id,
              food_name: food.name,
              serving_size: serving.serving_size,
              serving_unit: serving.serving_unit,
              calories: serving.calories,
              protein: serving.protein_g,
              carbs: serving.carbs_g,
              fat: serving.fat_g,
              fiber: serving.fiber_g,
              sugar: serving.sugar_g,
              is_external: false,
              food_id: food.id,
              serving_id: serving.id,
              serving_description: serving.serving_description
            }))
          );
        } else if (data?.source === 'external') {
          // OpenAI API results - need to generate serving_id for external results
          standardizedResults = (data.results || []).map((item, index) => {
            // Generate a unique serving_id for external results using timestamp + index
            const generatedServingId = `ext_${Date.now()}_${index}`;
            const result = {
              ...item,
              is_external: true,
              food_name: item.name,
              // Generate serving_id for external results since they don't have database IDs
              id: generatedServingId,
              serving_id: generatedServingId,
              protein: item.protein_g,
              carbs: item.carbs_g,
              fat: item.fat_g,
              fiber: item.fiber_g,
              sugar: item.sugar_g
            };
            return result;
          });
        }

        setSearchResults(standardizedResults);
      } catch (error) {
        if (error?.name === 'AbortError') {
          // ignore
        } else {
          // Error searching foods - silently handle
        }
      } finally {
        setIsSearching(false);
        searchAbortControllerRef.current = null;
      }
    }, 300);
  }, []);

  /**
   * Add a food item to the meal or increase quantity if already present
   * Handles both database and external API food results
   * 
   * @param {Object} food - Food item from search results
   * @param {number} food.id - Unique food serving ID
   * @param {string} food.food_name - Name of the food
   * @param {number} food.calories - Calories per serving
   */
  const addFoodToMeal = (food) => {
    const servingId = food.serving_id || food.id;

    if (!servingId) {
      alert('Unable to add food - missing serving information');
      return;
    }

    const existingIndex = mealFoods.findIndex(item => item.food_servings_id === servingId);

    if (existingIndex >= 0) {
      // Increase quantity if food already exists
      const updated = [...mealFoods];
      updated[existingIndex].quantity += 1;
      setMealFoods(updated);
    } else {
      // Convert search result to meal food format
      const foodServingData = {
        id: servingId,
        food_name: food.food_name || food.name,
        serving_description: food.serving_description || `${food.serving_size || 1} ${food.serving_unit || 'serving'}`,
        calories: food.calories || 0,
        protein_g: food.protein_g || food.protein || 0,
        carbs_g: food.carbs_g || food.carbs || 0,
        fat_g: food.fat_g || food.fat || 0
      };

      // Add new food
      const newMealFood = {
        id: null, // New item, no ID yet
        food_servings_id: servingId,
        quantity: 1,
        notes: '',
        food_servings: foodServingData
      };
      setMealFoods(prev => [...prev, newMealFood]);
    }

    setFoodSearch('');
    setSearchResults([]);
  };

  /**
   * Update the quantity of a food item in the meal
   * Removes item if quantity is set to 0 or negative
   * 
   * @param {number} index - Index of food item in mealFoods array
   * @param {number|string} quantity - New quantity value
   */
  const updateFoodQuantity = (index, quantity) => {
    if (quantity <= 0) {
      removeFoodFromMeal(index);
      return;
    }

    const updated = [...mealFoods];
    updated[index].quantity = parseFloat(quantity) || 0;
    setMealFoods(updated);
  };

  /**
   * Remove a food item from the meal
   * 
   * @param {number} index - Index of food item to remove from mealFoods array
   */
  const removeFoodFromMeal = (index) => {
    setMealFoods(mealFoods.filter((_, i) => i !== index));
  };



  /**
   * Save the meal to the database (create new or update existing)
   * 
   * Comprehensive meal saving operation that handles both meal creation and updates,
   * processes external foods from API results, and manages the meal_foods relationships.
   * Validates required fields before attempting database operations.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated, validation fails, or database operations fail
   * 
   * @description
   * Save process:
   * 1. Validate meal name and food count
   * 2. Create or update meal record in meals table
   * 3. For external foods (from OpenAI API), create permanent database records:
   *    - Insert into foods table
   *    - Insert into food_servings table
   *    - Replace temporary string IDs with permanent integer IDs
   * 4. Insert/update meal_foods relationships
   * 5. Add meal to user_meals table for new meals (makes it appear in MyMealsPage)
   * 6. Call onSave callback to refresh parent component
   * 
   * @example
   * // Save a new meal with chicken breast and rice
   * await handleSaveMeal();
   */
  const handleSaveMeal = async () => {
    if (!mealData.name.trim()) {
      alert('Please enter a meal name');
      return;
    }

    if (mealFoods.length === 0) {
      alert('Please add at least one food item to the meal');
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Save or update meal
      let mealId;
      if (editingMeal?.id) {
        // Update existing meal
        const { error: mealError } = await supabase
          .from('meals')
          .update({
            ...mealData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingMeal.id);

        if (mealError) throw mealError;
        mealId = editingMeal.id;

        // Delete existing meal foods
        const { error: deleteError } = await supabase
          .from('meal_foods')
          .delete()
          .eq('meal_id', mealId);

        if (deleteError) throw deleteError;
      } else {
        // Create new meal
        const { data: mealResult, error: mealError } = await supabase
          .from('meals')
          .insert([{
            ...mealData,
            user_id: user.id,
            is_premade: false
          }])
          .select()
          .single();

        if (mealError) throw mealError;
        mealId = mealResult.id;
      }

      // Process external foods first - save them to food_servings table to get real IDs
      const processedMealFoods = [];

      for (const item of mealFoods) {
        let finalFoodServingsId = item.food_servings_id;

        // Check if this is an external food (string ID starting with "ext_")
        if (typeof item.food_servings_id === 'string' && item.food_servings_id.startsWith('ext_')) {
          // Create food record first
          const { data: foodData, error: foodError } = await supabase
            .from('foods')
            .insert([{
              name: item.food_servings.food_name || item.food_servings.name,
              category: null
            }])
            .select()
            .single();

          if (foodError) throw foodError;

          // Create food_servings record
          const { data: servingData, error: servingError } = await supabase
            .from('food_servings')
            .insert([{
              food_id: foodData.id,
              serving_description: item.food_servings.serving_description,
              calories: item.food_servings.calories,
              protein_g: item.food_servings.protein_g,
              carbs_g: item.food_servings.carbs_g,
              fat_g: item.food_servings.fat_g
            }])
            .select()
            .single();

          if (servingError) throw servingError;

          finalFoodServingsId = servingData.id;
        }

        processedMealFoods.push({
          meal_id: mealId,
          food_servings_id: finalFoodServingsId,
          quantity: item.quantity,
          notes: item.notes
        });
      }

      // Insert meal foods with proper integer IDs
      const { error: foodsError } = await supabase
        .from('meal_foods')
        .insert(processedMealFoods);

      if (foodsError) throw foodsError;

      // Add meal to user_meals table so it shows up in MyMealsPage
      if (!editingMeal?.id) {
        const { error: userMealError } = await supabase
          .from('user_meals')
          .insert([{
            user_id: user.id,
            meal_id: mealId,
            is_favorite: false
          }]);

        if (userMealError) throw userMealError;
      }

      // Call onSave callback
      if (onSave) {
        onSave({
          id: mealId,
          ...mealData,
          nutrition,
          foods: mealFoods
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving meal:', error);
      alert('Error saving meal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="meal-builder-overlay">
      <div className="meal-builder-modal">
        <div className="meal-builder-header">
          <h2>
            <ChefHat className="icon" />
            {editingMeal ? 'Edit Meal' : 'Create New Meal'}
          </h2>
          <button onClick={onClose} className="close-btn">
            <X className="icon" />
          </button>
        </div>

        <div className="meal-builder-content">
          {/* Meal Details Section */}
          <div className="meal-details-section">
            <h3>Meal Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Meal Name *</label>
                <input
                  type="text"
                  value={mealData.name}
                  onChange={(e) => setMealData({ ...mealData, name: e.target.value })}
                  placeholder="Enter meal name"
                />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={mealData.category}
                  onChange={(e) => setMealData({ ...mealData, category: e.target.value })}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Food Search and List Section */}
          <div className="meal-foods-section">
            <h3>Foods</h3>

            {/* Food Search */}
            <div className="food-search">
              <div className="search-input-container">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search for foods to add..."
                  value={foodSearch}
                  onChange={(e) => {
                    setFoodSearch(e.target.value);
                    searchFoods(e.target.value);
                  }}
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div className="search-loading">
                  <div className="loading-spinner">Searching foods...</div>
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((food, index) => (
                    <div
                      key={`${food.id || food.serving_id}-${index}-${food.food_name || food.name}`}
                      className="search-result-item"
                      onClick={() => addFoodToMeal(food)}
                    >
                      <div className="food-info">
                        <span className="food-name">{food.food_name || food.name}</span>
                        <span className="food-serving">
                          {food.serving_description} - {food.calories} cal
                        </span>
                      </div>
                      <Plus className="add-icon" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Foods List */}
            <div className="selected-foods">
              {mealFoods.map((item, index) => (
                <div key={`${item.food_servings_id || 'missing'}-${index}`} className="food-item">
                  <div className="food-display">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => updateFoodQuantity(index, e.target.value)}
                      className="quantity-input-inline"
                    />
                    {/* Show serving description with food name */}
                    {(() => {
                      // Get food name from multiple possible sources
                      const foodName = item.food_servings.foods?.name ||
                        item.food_servings.food_name ||
                        item.food_servings.name ||
                        'Unknown Food';

                      // Handle foods without names silently

                      if (item.food_servings.serving_description) {
                        return foodName !== 'Unknown Food' ?
                          `${item.food_servings.serving_description.replace(/^\d+(\.\d+)?\s*/, '')} ${foodName}` :
                          item.food_servings.serving_description;
                      } else {
                        return foodName;
                      }
                    })()}
                  </div>
                  <button
                    onClick={() => removeFoodFromMeal(index)}
                    className="remove-btn"
                  >
                    <X className="icon" />
                  </button>
                </div>
              ))}

              {mealFoods.length === 0 && (
                <div className="no-foods">
                  <p>No foods added yet. Search and add foods above.</p>
                </div>
              )}
            </div>
          </div>

          {/* Nutrition Summary */}
          <div className="nutrition-summary">
            <h3>Nutrition Per Meal</h3>
            <div className="nutrition-grid">
              <div className="nutrition-item">
                <div className="nutrition-value">{Math.round(nutrition.calories)}</div>
                <div className="nutrition-label">Calories</div>
              </div>
              <div className="nutrition-item">
                <div className="nutrition-value">{Math.round(nutrition.protein)}g</div>
                <div className="nutrition-label">Protein</div>
              </div>
              <div className="nutrition-item">
                <div className="nutrition-value">{Math.round(nutrition.carbs)}g</div>
                <div className="nutrition-label">Carbs</div>
              </div>
              <div className="nutrition-item">
                <div className="nutrition-value">{Math.round(nutrition.fat)}g</div>
                <div className="nutrition-label">Fat</div>
              </div>
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="meal-builder-actions">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button
            onClick={handleSaveMeal}
            className="save-btn"
            disabled={isSaving || !mealData.name.trim() || mealFoods.length === 0}
          >
            <Save className="icon" />
            {isSaving ? 'Saving...' : (editingMeal ? 'Update Meal' : 'Save Meal')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealBuilder;
