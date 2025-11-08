import { ChefHat, Clock, Copy, Edit, Filter, Heart, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import MealBuilder from '../components/MealBuilder';
import { MEAL_CATEGORIES, calculateMealNutrition } from '../constants/mealPlannerConstants';
import { supabase } from '../supabaseClient';
import './MyMealsPage.css';

/**
 * MyMealsPage component for managing user's personal meal library
 * 
 * This component provides a comprehensive meal management interface with:
 * - Display of user's saved meals with nutrition information
 * - Search and filtering by category, tags, and text
 * - Meal creation, editing, and deletion
 * - Favoriting and rating system
 * - Meal duplication functionality
 * - Integration with MealBuilder for meal creation/editing
 * 
 * @component
 * @returns {JSX.Element} Complete meal library management interface
 * 
 * @example
 * <MyMealsPage />
 */
const MyMealsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  /** @type {[Array, Function]} User's complete meal collection */
  const [meals, setMeals] = useState([]);
  
  /** @type {[Array, Function]} Filtered meals based on search/filter criteria */
  const [filteredMeals, setFilteredMeals] = useState([]);
  
  /** @type {[string, Function]} Text search term for meal filtering */
  const [searchTerm, setSearchTerm] = useState('');
  
  /** @type {[string, Function]} Selected category filter for meals */
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  /** @type {[boolean, Function]} Controls MealBuilder modal visibility */
  const [showMealBuilder, setShowMealBuilder] = useState(false);
  
  /** @type {[Object|null, Function]} Meal being edited (null for new meal) */
  const [editingMeal, setEditingMeal] = useState(null);
  
  /** @type {[boolean, Function]} Controls premade meals modal visibility */
  const [showPremadeMeals, setShowPremadeMeals] = useState(false);
  
  /** @type {[Array, Function]} List of premade meals available to users */
  const [premadeMeals, setPremadeMeals] = useState([]);
  
  /** @type {[boolean, Function]} Loading state for premade meals fetch */
  const [premadeMealsLoading, setPremadeMealsLoading] = useState(false);
  
  /** @type {[boolean, Function]} Loading state for meal data fetch */
  const [isLoading, setIsLoading] = useState(true);
  
  /** @type {[string|null, Function]} Success message for toast notifications */
  const [successMessage, setSuccessMessage] = useState(null);

  /** @constant {Array<Object>} Available meal categories for filtering */
  const categories = MEAL_CATEGORIES;

  /**
   * Filter meals based on search term and category
   * 
   * @returns {void}
   */
  const filterMeals = useCallback(() => {
    let filtered = meals;

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(meal =>
        meal.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meal.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        meal.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(meal => meal.category === selectedCategory);
    }

    setFilteredMeals(filtered);
  }, [meals, searchTerm, selectedCategory]);

  /**
   * Load user's meals from database with nutrition calculation
   * Fetches meals with associated foods and calculates nutrition totals
   * 
   * @async
   * @returns {Promise<void>}
   */
  const loadMeals = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get user's saved meals from user_meals table
      const { data: userSavedMeals, error: userMealsError } = await supabase
        .from('user_meals')
        .select(`
          is_favorite,
          custom_name,
          meals (
            *,
            meal_foods (
              id,
              food_servings_id,
              quantity,
              notes,
              food_servings (
                id,
                food_name,
                calories,
                protein_g,
                carbs_g,
                fat_g,
                serving_description
              )
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (userMealsError) throw userMealsError;

      // Process user saved meals only
      const userMealsData = userSavedMeals?.map(um => ({
        ...um.meals,
        user_meals: [{
          is_favorite: um.is_favorite,
          custom_name: um.custom_name
        }]
      })) || [];

      // Check each meal's structure for broken nutrition data
      userMealsData.forEach((meal) => {
        if (meal.meal_foods && meal.meal_foods.some(mf => !mf.food_servings)) {
          // Meal has broken food data - missing nutrition information
        }
      });

      const data = userMealsData;

      // Calculate nutrition for each meal and extract tags
      const mealsWithNutrition = data.map(meal => {
        const userMeal = meal.user_meals && meal.user_meals.length > 0 ? meal.user_meals[0] : null;
        const nutrition = calculateMealNutrition(meal.meal_foods);
        
        // Check nutrition calculation for meals with zero values
        if (nutrition.calories === 0 && meal.meal_foods && meal.meal_foods.length > 0) {
          // Meal with zero calories detected - handle silently
        }
        
        return {
          ...meal,
          nutrition,
          display_name: userMeal?.custom_name || meal.name,
          is_favorite: userMeal?.is_favorite || false
        };
      });

      setMeals(mealsWithNutrition);
    } catch (error) {
      if (import.meta.env?.DEV) {
        console.warn('MyMealsPage - Error loading meals:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Load premade meals available for users to add to their collection
   * 
   * @returns {Promise<void>}
   */
  const loadPremadeMeals = useCallback(async () => {
    try {
      setPremadeMealsLoading(true);
      const { data: premadeData, error } = await supabase
        .from('meals')
        .select(`
          *,
          meal_foods (
            id,
            food_servings_id,
            quantity,
            notes,
            food_servings (
              id,
              food_name,
              calories,
              protein_g,
              carbs_g,
              fat_g,
              serving_description
            )
          )
        `)
        .eq('is_premade', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate nutrition for each premade meal
      const premadeWithNutrition = premadeData.map(meal => ({
        ...meal,
        nutrition: calculateMealNutrition(meal.meal_foods)
      }));

      setPremadeMeals(premadeWithNutrition);
    } catch (error) {
      if (import.meta.env?.DEV) {
         
        console.warn('MyMealsPage - Error loading premade meals:', error);
      }
    } finally {
      setPremadeMealsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    filterMeals();
  }, [filterMeals]);




  /**
   * Toggle favorite status for a meal
   * 
   * Updates the is_favorite field in the user_meals table and immediately
   * updates the local state to reflect the change in the UI without requiring
   * a full data refresh.
   * 
   * @async
   * @param {number} mealId - ID of the meal to toggle favorite status for
   * @param {boolean} currentFavorite - Current favorite status to toggle from
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database update fails
   * 
   * @example
   * await toggleFavorite(123, false); // Mark meal 123 as favorite
   * await toggleFavorite(456, true);  // Remove meal 456 from favorites
   */
  const toggleFavorite = async (mealId, currentFavorite) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('user_meals')
        .update({ is_favorite: !currentFavorite })
        .eq('user_id', user.id)
        .eq('meal_id', mealId);

      if (error) throw error;

      // Update local state
      setMeals(meals.map(meal =>
        meal.id === mealId
          ? { ...meal, is_favorite: !currentFavorite }
          : meal
      ));
    } catch (error) {
      if (import.meta.env?.DEV) {
         
        console.warn('MyMealsPage - Error toggling favorite:', error);
      }
    }
  };

  /**
   * Create a duplicate copy of an existing meal
   * 
   * Performs a deep copy of a meal including all its foods and adds it to the user's
   * meal collection. The duplicate gets "(Copy)" appended to its name and is marked
   * as a user-created meal (not premade). Handles validation of food relationships
   * and creates proper database entries.
   * 
   * @async
   * @param {Object} meal - Complete meal object to duplicate
   * @param {string} meal.name - Original meal name (will have "(Copy)" appended)
   * @param {Array} meal.meal_foods - Array of meal_foods relationships to copy
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database operations fail
   * 
   * @example
   * await duplicateMeal(selectedMeal); // Creates "Chicken Salad (Copy)"
   */
  const duplicateMeal = async (meal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create a copy of the meal - only include actual database columns
      const mealCopy = {
        name: `${meal.name} (Copy)`,
        user_id: user.id,
        category: meal.category,
        tags: meal.tags,
        description: meal.description,
        instructions: meal.instructions,
        prep_time: meal.prep_time,
        cook_time: meal.cook_time,
        serving_size: meal.serving_size,
        serving_unit: meal.serving_unit,
        difficulty_level: meal.difficulty_level,
        image_url: meal.image_url,
        is_premade: false
      };

      const { data: newMeal, error: mealError } = await supabase
        .from('meals')
        .insert([mealCopy])
        .select()
        .single();

      if (mealError) throw mealError;

      // Copy meal foods
      if (meal.meal_foods && meal.meal_foods.length > 0) {
        // Filter out any foods that still have missing food_servings_id (shouldn't happen now)
        const validFoods = meal.meal_foods.filter(food => 
          food.food_servings_id
        );
        
        if (validFoods.length === 0) {
          // No valid foods to copy - all foods have missing food_servings_id
        } else {
          const mealFoodsCopy = validFoods.map(food => ({
            meal_id: newMeal.id,
            food_servings_id: food.food_servings_id,
            quantity: food.quantity,
            notes: food.notes || ''
          }));
          
          const { error: foodsError } = await supabase
            .from('meal_foods')
            .insert(mealFoodsCopy);

          if (foodsError) {
            // Clean up the orphaned meal record
            await supabase
              .from('meals')
              .delete()
              .eq('id', newMeal.id);
            throw foodsError;
          }
        }
      }

      // Add to user meals
      const { error: userMealError } = await supabase
        .from('user_meals')
        .insert([{
          user_id: user.id,
          meal_id: newMeal.id,
          is_favorite: false
        }]);

      if (userMealError) {
        // Clean up the orphaned meal record and its foods
        await supabase
          .from('meals')
          .delete()
          .eq('id', newMeal.id);
        throw userMealError;
      }

      await loadMeals();
    } catch (error) {
      if (import.meta.env?.DEV) {
         
        console.warn('MyMealsPage - Error duplicating meal:', error);
      }
      alert('Error duplicating meal. Please try again.');
    }
  };

  /**
   * Add a premade meal to user's personal collection
   * 
   * Creates a user_meals relationship to add a premade meal to the user's
   * collection without duplicating the meal data. Uses upsert with conflict
   * resolution to prevent duplicate entries and includes loading state to
   * prevent double-clicks. The meal remains premade but appears in the user's
   * meal library for use in meal planning.
   * 
   * @async
   * @param {Object} meal - Premade meal object to add
   * @param {number} meal.id - ID of the premade meal to add
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database operation fails
   * 
   * @example
   * await addPremadeMeal(premadeMeal); // Safely adds premade meal to user's collection
   */
  const addPremadeMeal = async (meal) => {
    if (premadeMealsLoading) return; // Prevent double-clicks
    
    try {
      setPremadeMealsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use upsert to avoid duplicate user_meals rows
      const { error: userMealError } = await supabase
        .from('user_meals')
        .upsert([{
          user_id: user.id,
          meal_id: meal.id,
          is_favorite: false
        }], {
          onConflict: 'user_id,meal_id',
          ignoreDuplicates: true
        });

      if (userMealError) throw userMealError;

      await loadMeals();
      
      // Show success notification
      setSuccessMessage('Added to My Meals!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding meal:', error);
      alert('Error adding meal. Please try again.');
    } finally {
      setPremadeMealsLoading(false);
    }
  };

  /**
   * Delete a meal or remove it from user's collection
   * 
   * Handles two scenarios:
   * 1. For user-created meals: Completely deletes the meal and all associated data
   * 2. For premade meals: Only removes the user_meals relationship (unsaves the meal)
   * 
   * Shows confirmation dialog before proceeding with deletion.
   * 
   * @async
   * @param {number} mealId - ID of the meal to delete or remove
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database operations fail
   * 
   * @example
   * await deleteMeal(123); // Deletes user's custom meal completely
   * await deleteMeal(456); // Removes premade meal from user's collection
   */
  const deleteMeal = async (mealId) => {
    if (!confirm('Are you sure you want to delete this meal?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if it's a user's own meal or just removing from saved meals
      const meal = meals.find(m => m.id === mealId);
      
      if (meal.user_id === user.id) {
        // Delete the meal entirely (will cascade to meal_foods and user_meals)
        const { error } = await supabase
          .from('meals')
          .delete()
          .eq('id', mealId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Just remove from user's saved meals
        const { error } = await supabase
          .from('user_meals')
          .delete()
          .eq('user_id', user.id)
          .eq('meal_id', mealId);

        if (error) throw error;
      }

      await loadMeals();
    } catch (error) {
      if (import.meta.env?.DEV) {
         
        console.warn('MyMealsPage - Error deleting meal:', error);
      }
      alert('Error deleting meal. Please try again.');
    }
  };

  const handleEditMeal = (meal) => {
    setEditingMeal(meal);
    setShowMealBuilder(true);
  };

  const handleMealSaved = () => {
    loadMeals();
    setShowMealBuilder(false);
    setEditingMeal(null);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
  };

  const formatTime = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getDifficultyStars = (level) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`difficulty-star ${i < level ? 'filled' : ''}`}
      />
    ));
  };

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-container">
        <p>Please log in to view your meals.</p>
        <button 
          onClick={() => navigate('/')} 
          className="create-meal-btn"
          style={{ marginTop: '20px' }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your meals...</p>
      </div>
    );
  }

  // When browsing premade meals we render a full-page view that replaces
  // the My Meals page until the user closes it. This prevents the modal
  // from opening at the bottom of the page and makes the premade browser
  // easier to navigate on small screens.
  if (showPremadeMeals) {
    return (
      <div className="my-meals-page premade-fullpage">
        {/* Success Toast */}
        {successMessage && (
          <div className="success-toast">
            {successMessage}
          </div>
        )}
        
        <div className="page-header">
          <div className="header-left">
            <h1>
              <ChefHat className="icon" />
              Browse Premade Meals
            </h1>
            <p>Choose from our collection of professionally crafted meals to add to your library.</p>
          </div>
          <div className="header-buttons">
            <button
              onClick={() => {
                setShowPremadeMeals(false);
                // Scroll to top when closing premade meals view
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="create-meal-btn"
            >
              Close
            </button>
          </div>
        </div>

        <div className="premade-meals-container">
          {premadeMealsLoading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading premade meals...</p>
            </div>
          ) : (
            <>
              {premadeMeals.length > 0 ? (
                <div className="premade-meals-grid">
                  {premadeMeals.map(meal => (
                    <div key={meal.id} className="premade-meal-card">
                      <div className="meal-info">
                        <h4 className="meal-name">{meal.name}</h4>
                        <div className="meal-category">{meal.category}</div>
                        {meal.description && (
                          <p className="meal-description">{meal.description}</p>
                        )}
                        <div className="meal-nutrition">
                          <div className="nutrition-item">
                            <span className="value">{meal.nutrition?.calories ? Math.round(meal.nutrition.calories) : '0'}</span>
                            <span className="label">cal</span>
                          </div>
                          <div className="nutrition-item">
                            <span className="value">{meal.nutrition?.protein ? Math.round(meal.nutrition.protein) : '0'}g</span>
                            <span className="label">protein</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => addPremadeMeal(meal)}
                        className="add-meal-btn"
                      >
                        <Plus className="icon" />
                        Add to My Meals
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-premade-meals">
                  <p>No premade meals available at the moment.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="my-meals-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>
            <ChefHat className="icon" />
            My Meals
          </h1>
          <p>Manage your saved meals and recipes</p>
        </div>
        <div className="header-buttons">
          <button
            onClick={() => {
              setEditingMeal(null);
              setShowMealBuilder(true);
            }}
            className="create-meal-btn"
          >
            <Plus className="icon" />
            Create New Meal
          </button>
          <button
            onClick={() => {
              loadPremadeMeals();
              setShowPremadeMeals(true);
              // Scroll to top when opening premade meals view
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="browse-premade-btn"
          >
            <ChefHat className="icon" />
            Browse Premade Meals
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-bar">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search meals by name, description, or tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-controls">
          {/* Category Filter */}
          <div className="filter-group">
            <label>Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || selectedCategory !== 'all') && (
            <button onClick={clearFilters} className="clear-filters-btn">
              <Filter className="icon" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Meals Grid */}
      <div className="meals-grid">
        {filteredMeals.map(meal => (
          <div key={meal.id} className="meal-card">
            {/* Meal Info */}
            <div className="meal-info">
              <div className="meal-header">
                <div className="meal-header-left">
                  <h3 className="meal-name">{meal.display_name}</h3>
                  <div className="meal-category">{meal.category}</div>
                </div>
                {/* Favorite Button */}
                <button
                  onClick={() => toggleFavorite(meal.id, meal.is_favorite)}
                  className={`favorite-btn ${meal.is_favorite ? 'favorited' : ''}`}
                >
                  <Heart className="icon" />
                </button>
              </div>

              {meal.description && (
                <p className="meal-description">{meal.description}</p>
              )}

              {/* Meal Meta */}
              <div className="meal-meta">
                {(meal.prep_time || meal.cook_time) && (
                  <div className="meal-time">
                    <Clock className="icon" />
                    <span>
                      {meal.prep_time && `${formatTime(meal.prep_time)} prep`}
                      {meal.prep_time && meal.cook_time && ' • '}
                      {meal.cook_time && `${formatTime(meal.cook_time)} cook`}
                    </span>
                  </div>
                )}

                {meal.difficulty_level && (
                  <div className="meal-difficulty">
                    {getDifficultyStars(meal.difficulty_level)}
                  </div>
                )}
              </div>

              {/* Nutrition Summary */}
              <div className="meal-nutrition">
                <div className="nutrition-item">
                  <span className="value">{meal.nutrition?.calories ? Math.round(meal.nutrition.calories) : '0'}</span>
                  <span className="label">cal</span>
                </div>
                <div className="nutrition-item">
                  <span className="value">{meal.nutrition?.protein ? Math.round(meal.nutrition.protein) : '0'}g</span>
                  <span className="label">protein</span>
                </div>
                <div className="nutrition-item">
                  <span className="value">{meal.nutrition?.carbs ? Math.round(meal.nutrition.carbs) : '0'}g</span>
                  <span className="label">carbs</span>
                </div>
                <div className="nutrition-item">
                  <span className="value">{meal.nutrition?.fat ? Math.round(meal.nutrition.fat) : '0'}g</span>
                  <span className="label">fat</span>
                </div>
              </div>
            </div>

            {/* Meal Actions */}
            <div className="meal-actions">
              <button
                onClick={() => handleEditMeal(meal)}
                className="action-btn edit"
                title="Edit meal"
              >
                <Edit className="icon" />
              </button>
              <button
                onClick={() => duplicateMeal(meal)}
                className="action-btn duplicate"
                title="Duplicate meal"
              >
                <Copy className="icon" />
              </button>
              <button
                onClick={() => deleteMeal(meal.id)}
                className="action-btn delete"
                title="Delete meal"
              >
                <Trash2 className="icon" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredMeals.length === 0 && !isLoading && (
        <div className="empty-state">
          {meals.length === 0 ? (
            <>
              <ChefHat className="empty-icon" />
              <h3>No Saved Meals Yet</h3>
              <p>Create your first meal or browse premade meals to get started.</p>
              <button
                onClick={() => setShowMealBuilder(true)}
                className="create-meal-btn"
              >
                <Plus className="icon" />
                Create Your First Meal
              </button>
            </>
          ) : (
            <>
              <Search className="empty-icon" />
              <h3>No Meals Found</h3>
              <p>Try adjusting your search or filters to find what you're looking for.</p>
              <button onClick={clearFilters} className="clear-filters-btn">
                <Filter className="icon" />
                Clear All Filters
              </button>
            </>
          )}
        </div>
      )}

      {/* Meal Builder Modal */}
      <MealBuilder
        isOpen={showMealBuilder}
        onClose={() => {
          setShowMealBuilder(false);
          setEditingMeal(null);
        }}
        onSave={handleMealSaved}
        editingMeal={editingMeal}
      />
    </div>
  );
};

export default MyMealsPage;
