import { Calendar, ChefHat, Copy, Plus, Share2, ShoppingCart, Target, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import MealBuilder from '../components/MealBuilder';
import { DAYS_OF_WEEK, getWeekDates, MEAL_TYPES } from '../constants/mealPlannerConstants';
import { supabase } from '../supabaseClient';
import { analyzeWeeklyNutrition } from '../utils/nutritionRecommendations';
import './WeeklyMealPlannerPage.css';

/**
 * WeeklyMealPlannerPage component for managing weekly meal plans
 * 
 * This component provides a comprehensive weekly meal planning interface with:
 * - 7-day meal planning grid with multiple meal slots per day
 * - Week navigation (previous/next week)
 * - Meal assignment from user's meal library
 * - Real-time nutrition calculation and goal tracking
 * - Meal editing and removal functionality
 * - Integration with MealBuilder for creating new meals
 * 
 * @component
 * @returns {JSX.Element} Complete weekly meal planner interface
 * 
 * @example
 * <WeeklyMealPlannerPage />
 */
const WeeklyMealPlannerPage = () => {
  /** @type {Object} Current authenticated user */
  const { user } = useAuth();

  /** @type {[Date[], Function]} Current week's date array for meal planning */
  const [currentWeek, setCurrentWeek] = useState(() => getWeekDates(new Date()));

  /** @type {[Object|null, Function]} Currently active meal plan */
  const [activePlan, setActivePlan] = useState(null);

  /** @type {[Array, Function]} User's available meal plans */
  const [_mealPlans, setMealPlans] = useState([]);

  /** @type {[Array, Function]} Meal entries for the current week/plan */
  const [planEntries, setPlanEntries] = useState([]);

  /** @type {[Array, Function]} User's saved meals library */
  const [userMeals, setUserMeals] = useState([]);

  /** @type {[Object|null, Function]} Currently selected meal for assignment */
  const [_selectedMeal, _setSelectedMeal] = useState(null);

  /** @type {[Object|null, Function]} Selected time slot for meal assignment */
  const [selectedSlot, setSelectedSlot] = useState(null);

  /** @type {[boolean, Function]} Controls MealBuilder modal visibility */
  const [showMealBuilder, setShowMealBuilder] = useState(false);

  /** @type {[boolean, Function]} Controls meal selector modal visibility */
  const [showMealSelector, setShowMealSelector] = useState(false);

  /** @type {[boolean, Function]} Controls shopping list modal visibility */
  const [showShoppingList, setShowShoppingList] = useState(false);

  /** @type {[boolean, Function]} Controls recommendations modal visibility */
  const [showRecommendations, setShowRecommendations] = useState(false);

  /** @type {[Object|null, Function]} Nutrition analysis and recommendations */
  const [nutritionAnalysis, setNutritionAnalysis] = useState(null);

  /** @type {[Object, Function]} Calculated nutrition totals by day */
  const [weeklyNutrition, setWeeklyNutrition] = useState({});

  /** @type {[Object|null, Function]} User's nutrition goals for comparison */
  const [_nutritionGoals, setNutritionGoals] = useState(null);

  /** @type {[string, Function]} Selected meal category filter */
  const [selectedCategory, setSelectedCategory] = useState('all');

  /** @type {[boolean, Function]} Loading state for initial data fetch */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load initial data including nutrition goals, meal plans, and user meals
   * 
   * @async
   * @returns {Promise<void>}
   */
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load nutrition goals
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('daily_calorie_goal, daily_protein_goal, daily_carb_goal, daily_fat_goal')
        .eq('id', user.id)
        .single();

      if (profile) {
        setNutritionGoals({
          calories: profile.daily_calorie_goal,
          protein: profile.daily_protein_goal,
          carbs: profile.daily_carb_goal,
          fat: profile.daily_fat_goal
        });
      }

      // Note: Meal plans and user meals are loaded in separate useEffects
      // to avoid circular dependencies with useCallback
    } catch (error) {
      if (import.meta.env?.DEV) {

        console.warn('WeeklyMealPlannerPage - Error loading initial data:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load plan entries for the current week and active plan
   * 
   * @async
   * @returns {Promise<void>}
   */
  const loadPlanEntries = useCallback(async () => {
    if (!activePlan) return;

    try {
      const startDate = currentWeek[0].toISOString().split('T')[0];
      const endDate = currentWeek[6].toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('weekly_meal_plan_entries')
        .select(`
          *,
          meals (
            id,
            name,
            category,
            meal_foods (
              quantity,
              food_servings (
                id,
                food_name,
                serving_description,
                category,
                calories,
                protein_g,
                carbs_g,
                fat_g,
                fiber_g,
                sugar_g,
                sodium_mg,
                calcium_mg,
                iron_mg,
                potassium_mg,
                magnesium_mg,
                phosphorus_mg,
                zinc_mg,
                copper_mg,
                selenium_mcg,
                vitamin_a_mcg,
                vitamin_c_mg,
                vitamin_e_mg,
                vitamin_k_mcg,
                thiamin_mg,
                riboflavin_mg,
                niacin_mg,
                vitamin_b6_mg,
                folate_mcg,
                vitamin_b12_mcg
              )
            )
          )
        `)
        .eq('plan_id', activePlan.id)
        .gte('plan_date', startDate)
        .lte('plan_date', endDate);

      if (error) throw error;
      setPlanEntries(data || []);
    } catch (error) {
      if (import.meta.env?.DEV) {

        console.warn('WeeklyMealPlannerPage - Error loading plan entries:', error);
      }
    }
  }, [activePlan, currentWeek]);

  /**
   * Calculate weekly nutrition totals
   * 
   * @returns {void}
   */
  const calculateWeeklyNutrition = useCallback(() => {
    const dailyNutrition = {};

    // Initialize each day
    currentWeek.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      dailyNutrition[dateStr] = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    });

    // Calculate nutrition for each entry
    planEntries.forEach(entry => {
      const dateStr = entry.plan_date;
      const servings = entry.servings || 1;

      if (!dailyNutrition[dateStr]) return;

      entry.meals.meal_foods.forEach(mealFood => {
        const food = mealFood.food_servings;
        const quantity = mealFood.quantity * servings;

        dailyNutrition[dateStr].calories += (food.calories * quantity || 0);
        dailyNutrition[dateStr].protein += (food.protein_g * quantity || 0);
        dailyNutrition[dateStr].carbs += (food.carbs_g * quantity || 0);
        dailyNutrition[dateStr].fat += (food.fat_g * quantity || 0);
      });
    });

    setWeeklyNutrition(dailyNutrition);
  }, [planEntries, currentWeek]);

  /**
   * Load initial data required for the meal planner
   * Fetches nutrition goals, meal plans, and user meals
   * 
   * @async
   * @returns {Promise<void>}
   */


  /**
   * Load user's meal plans from database and set active plan
   * 
   * Fetches all weekly meal plans for the current user and determines which plan
   * should be active. If no plan is marked as active, makes the most recent plan
   * active automatically.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database query fails
   * 
   * @description
   * Plan activation logic:
   * 1. Look for a plan marked with is_active=true
   * 2. If none found, activate the most recent plan
   * 3. Update activePlan state to trigger plan entries loading
   * 
   * @example
   * await loadMealPlans(); // Loads plans and sets active plan
   */
  const loadMealPlans = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('weekly_meal_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setMealPlans(data);

      // Set active plan
      const active = data.find(plan => plan.is_active);
      if (active) {
        setActivePlan(active);
      } else if (data.length > 0) {
        // Make the first plan active if none are active (just set it locally, don't call Edge Function during init)
        setActivePlan(data[0]);
      }
    } catch (error) {
      if (import.meta.env?.DEV) {

        console.warn('WeeklyMealPlannerPage - Error loading meal plans:', error);
      }
    }
  }, []); // No dependencies - avoiding circular dependency with setActiveMealPlan

  /**
   * Load user's saved meals for meal selection in planner
   * 
   * Fetches all meals from the user's personal collection (saved meals) with
   * nutrition data for display in the meal selector. Excludes premade meals
   * that haven't been saved to the user's collection.
   * 
   * @async
   * @returns {Promise<void>}  
   * @throws {Error} When user is not authenticated or database query fails
   * 
   * @description
   * Loads meals with:
   * - Complete meal metadata (name, category, etc.)
   * - Associated meal_foods with nutrition data
   * - User preferences (favorite status, custom names)
   * - Calculated nutrition totals for display
   * 
   * @example
   * await loadUserMeals(); // Populates userMeals state for meal selector
   */
  const loadUserMeals = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's saved meals from user_meals table
      const { data: userSavedMeals, error: userMealsError } = await supabase
        .from('user_meals')
        .select(`
          is_favorite,
          custom_name,
          meals (
            *,
            meal_foods (
              quantity,
              food_servings (
                calories,
                protein_g,
                carbs_g,
                fat_g
              )
            )
          )
        `)
        .eq('user_id', user.id);

      if (userMealsError) throw userMealsError;

      // Process user saved meals only (no premade meals in meal planner)
      const userMealsData = userSavedMeals.map(um => ({
        ...um.meals,
        user_meals: [{
          is_favorite: um.is_favorite,
          custom_name: um.custom_name
        }]
      }));

      const data = userMealsData;
      const error = null;

      if (error) throw error;

      // Calculate nutrition for each meal and handle user_meals relationship
      const mealsWithNutrition = data.map(meal => {
        const userMeal = meal.user_meals && meal.user_meals.length > 0 ? meal.user_meals[0] : null;
        return {
          ...meal,
          nutrition: calculateMealNutrition(meal.meal_foods),
          display_name: userMeal?.custom_name || meal.name,
          is_favorite: userMeal?.is_favorite || false,
        };
      });

      setUserMeals(mealsWithNutrition);
    } catch (error) {
      console.error('Error loading user meals:', error);
      setUserMeals([]); // Ensure we set empty array on error
    }
  }, []);

  // Load initial data on component mount
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load meal plans after initial data
  useEffect(() => {
    loadMealPlans();
  }, [loadMealPlans]);

  // Load user meals after initial data
  useEffect(() => {
    loadUserMeals();
  }, [loadUserMeals]);

  // Load plan entries when active plan or week changes
  useEffect(() => {
    if (activePlan) {
      loadPlanEntries();
    }
  }, [activePlan, currentWeek, loadPlanEntries]);

  // Recalculate nutrition totals when plan entries change
  useEffect(() => {
    calculateWeeklyNutrition();
  }, [planEntries, calculateWeeklyNutrition]);

  /**
   * Calculate total nutrition values for a meal based on its foods and servings
   * 
   * @param {Array} mealFoods - Array of meal_foods with quantities and nutrition data
   * @param {number} [servings=1] - Number of servings to multiply nutrition by
   * @returns {Object} Calculated nutrition totals (calories, protein, carbs, fat)
   * 
   * @example
   * const nutrition = calculateMealNutrition(meal.meal_foods, 2);
   * // Returns: { calories: 600, protein: 40, carbs: 20, fat: 15 }
   */
  const calculateMealNutrition = (mealFoods, servings = 1) => {
    return mealFoods.reduce((acc, item) => {
      const food = item.food_servings;
      const quantity = item.quantity || 0;

      return {
        calories: acc.calories + (food.calories * quantity * servings || 0),
        protein: acc.protein + (food.protein_g * quantity * servings || 0),
        carbs: acc.carbs + (food.carbs_g * quantity * servings || 0),
        fat: acc.fat + (food.fat_g * quantity * servings || 0)
      };
    }, {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    });
  };

  /**
   * Generate shopping list from current week's meal plan
   * 
   * Aggregates all ingredients from meals in the active plan for the current week,
   * combines duplicate food items with summed quantities, and groups by food category.
   * 
   * @returns {Object} Shopping list grouped by category with food items and quantities
   * 
   * @example
   * const shoppingList = generateShoppingList();
   * // Returns: { "Proteins": [{ name: "Chicken Breast", quantity: 3, unit: "servings" }], ... }
   */
  const generateShoppingList = useCallback(() => {
    const ingredientMap = new Map();
    
    // Aggregate all ingredients from plan entries
    planEntries.forEach(entry => {
      const servings = entry.servings || 1;
      const mealFoods = entry.meals?.meal_foods || [];
      
      mealFoods.forEach(mealFood => {
        const food = mealFood.food_servings;
        if (!food) return; // Skip if food_servings is missing
        
        const foodId = food.id;
        const quantity = mealFood.quantity * servings;
        
        if (ingredientMap.has(foodId)) {
          // Add to existing quantity
          const existing = ingredientMap.get(foodId);
          existing.quantity += quantity;
        } else {
          // Add new ingredient
          ingredientMap.set(foodId, {
            id: foodId,
            name: food.food_name,
            quantity: quantity,
            category: food.category || 'Other',
            serving_description: food.serving_description
          });
        }
      });
    });

    // Group by category
    const groupedList = {};
    ingredientMap.forEach(item => {
      const category = item.category || 'Other';
      if (!groupedList[category]) {
        groupedList[category] = [];
      }
      groupedList[category].push(item);
    });

    // Sort categories and items within each category
    const sortedList = {};
    Object.keys(groupedList).sort().forEach(category => {
      sortedList[category] = groupedList[category].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
    });

    return sortedList;
  }, [planEntries]);

  /**
   * Share shopping list via Web Share API or copy to clipboard
   * 
   * Attempts to use the native Web Share API (works on mobile and some desktop browsers).
   * Falls back to copying the list to clipboard if Web Share is not available.
   * 
   * @async
   * @returns {Promise<void>}
   * 
   * @description
   * Formats the shopping list as plain text with categories and items, then:
   * - Uses navigator.share() if available (mobile-friendly)
   * - Falls back to clipboard copy with success message
   * - Shows error message if both methods fail
   * 
   * @example
   * await shareShoppingList();
   * // Mobile: Opens native share sheet
   * // Desktop: Copies to clipboard
   */
  const shareShoppingList = useCallback(async () => {
    const shoppingList = generateShoppingList();
    
    // Format shopping list as text
    let listText = `Shopping List - Week of ${currentWeek[0].toLocaleDateString()}\n\n`;
    
    Object.entries(shoppingList).forEach(([category, items]) => {
      listText += `${category.toUpperCase()}\n`;
      items.forEach(item => {
        const qty = Math.round(item.quantity * 10) / 10;
        listText += `  • ${item.name} - ${qty}× ${item.serving_description}\n`;
      });
      listText += '\n';
    });
    
    const totalItems = Object.values(shoppingList).reduce((sum, items) => sum + items.length, 0);
    listText += `Total: ${totalItems} items\n`;

    try {
      // Try Web Share API first (works on mobile)
      if (navigator.share) {
        await navigator.share({
          title: 'Shopping List',
          text: listText
        });
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(listText);
        alert('Shopping list copied to clipboard!');
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        // AbortError means user cancelled the share dialog, which is fine
        console.error('Failed to share shopping list:', error);
        alert('Failed to share shopping list. Please try again.');
      }
    }
  }, [generateShoppingList, currentWeek]);

  /**
   * Create a new weekly meal plan for the current week
   * 
   * Creates a new meal plan covering the currently displayed week (Monday-Sunday)
   * and automatically sets it as the active plan. Deactivates any existing active
   * plans to ensure only one plan is active at a time.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} When user is not authenticated or database operations fail
   * 
   * @description
   * Plan creation process:
   * 1. Calculate start/end dates from current week
   * 2. Generate descriptive plan name with week date
   * 3. Deactivate existing active plans
   * 4. Create new plan marked as active
   * 5. Update local state and reload plans
   * 
   * @example
   * await createNewMealPlan(); // Creates "Meal Plan - Week of 12/4/2023"
   */
  const createNewMealPlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const startDate = currentWeek[0].toISOString().split('T')[0];
      const endDate = currentWeek[6].toISOString().split('T')[0];
      const planName = `Meal Plan - Week of ${currentWeek[0].toLocaleDateString()}`;

      const { data, error } = await supabase
        .from('weekly_meal_plans')
        .insert([{
          user_id: user.id,
          name: planName,
          start_date: startDate,
          end_date: endDate,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      setActivePlan(data);
      await loadMealPlans();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      alert('Error creating meal plan. Please try again.');
    }
  };

  /**
   * Duplicate last week's meal plan to the current week
   * 
   * Copies all meal entries from the previous week (7 days before current week's start)
   * to the current week's meal plan. This is useful for users following consistent
   * meal patterns (bulking, cutting, etc.) who want to repeat the same weekly meals.
   * 
   * @async
   * @returns {Promise<void>}
   * @throws {Error} When no active plan exists or database operations fail
   * 
   * @description
   * Duplication process:
   * 1. Verify active plan exists for current week
   * 2. Calculate previous week's date range
   * 3. Fetch all meal entries from previous week
   * 4. Create copies with updated dates (same day of week, new week)
   * 5. Insert all entries in bulk
   * 6. Reload plan entries to update UI
   * 
   * @example
   * await duplicateLastWeek();
   * // Copies Monday breakfast from last week to this Monday, etc.
   */
  const duplicateLastWeek = async () => {
    if (!activePlan) {
      alert('Please create a meal plan first.');
      return;
    }

    try {
      // Calculate last week's date range
      const lastWeekStart = new Date(currentWeek[0]);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(currentWeek[6]);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

      const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0];
      const lastWeekEndStr = lastWeekEnd.toISOString().split('T')[0];

      // Fetch last week's meal entries
      const { data: lastWeekEntries, error: fetchError } = await supabase
        .from('weekly_meal_plan_entries')
        .select('meal_id, plan_date, meal_type, servings, notes')
        .eq('plan_id', activePlan.id)
        .gte('plan_date', lastWeekStartStr)
        .lte('plan_date', lastWeekEndStr);

      if (fetchError) throw fetchError;

      if (!lastWeekEntries || lastWeekEntries.length === 0) {
        alert('No meals found in the previous week to duplicate.');
        return;
      }

      // Create new entries with dates shifted forward by 7 days
      const newEntries = lastWeekEntries.map(entry => {
        const oldDate = new Date(entry.plan_date);
        const newDate = new Date(oldDate);
        newDate.setDate(newDate.getDate() + 7);

        return {
          plan_id: activePlan.id,
          meal_id: entry.meal_id,
          plan_date: newDate.toISOString().split('T')[0],
          meal_type: entry.meal_type,
          servings: entry.servings,
          notes: entry.notes
        };
      });

      // Insert all new entries
      const { error: insertError } = await supabase
        .from('weekly_meal_plan_entries')
        .insert(newEntries);

      if (insertError) throw insertError;

      // Reload plan entries to show duplicated meals
      await loadPlanEntries();
      alert(`Successfully duplicated ${newEntries.length} meals from last week!`);
    } catch (error) {
      console.error('Error duplicating last week:', error);
      alert('Error duplicating last week. Please try again.');
    }
  };

  /**
   * Get nutrition recommendations based on weekly intake vs RDA targets
   * Analyzes deficiencies and provides personalized meal suggestions
   */
  const getRecommendations = useCallback(async () => {
    if (!planEntries || planEntries.length === 0) {
      alert('Add some meals to your plan first to get recommendations.');
      return;
    }

    try {
      // Analyze weekly nutrition with all available meals for recommendations
      const analysis = analyzeWeeklyNutrition(planEntries, userMeals);
      
      setNutritionAnalysis(analysis);
      setShowRecommendations(true);
    } catch (error) {
      console.error('Error analyzing nutrition:', error);
      alert('Error generating recommendations. Please try again.');
    }
  }, [planEntries, userMeals]);

  // === Render Functions ===
  const handleSlotClick = (date, mealType) => {
    setSelectedSlot({ date: date.toISOString().split('T')[0], mealType });

    // Auto-select the appropriate category based on meal type
    const categoryMap = {
      breakfast: 'breakfast',
      lunch: 'lunch',
      dinner: 'dinner',
      snack1: 'snack',
      snack2: 'snack'
    };
    setSelectedCategory(categoryMap[mealType] || 'all');

    setShowMealSelector(true);
  };



  /**
   * Add a selected meal to a specific time slot in the meal plan
   * 
   * Creates a meal_plan_entries record linking a meal to a specific date and meal type
   * within the active meal plan. Allows specifying the number of servings.
   * Also ensures the meal is added to user_meals if not already present.
   * 
   * @async
   * @param {Object} meal - Complete meal object to add to the plan
   * @param {number} meal.id - Database ID of the meal to add
   * @param {number} [servings=1] - Number of servings to plan for this meal
   * @returns {Promise<void>}
   * @throws {Error} When no active plan, no selected slot, or database operation fails
   * 
   * @description
   * Requires both activePlan and selectedSlot to be set (from handleSlotClick).
   * After successful addition:
   * 1. Ensures meal is in user's collection (user_meals)
   * 2. Adds meal to the weekly plan (weekly_meal_plan_entries)
   * 3. Reloads plan entries to show the new meal
   * 4. Closes the meal selector modal
   * 5. Clears the selected slot state
   * 
   * @example
   * await addMealToSlot(chickenSalad, 2); // Adds 2 servings of chicken salad
   */
  const addMealToSlot = async (meal, servings = 1) => {
    if (!activePlan || !selectedSlot) return;

    try {
      // First, ensure the meal is in user_meals (so it shows up in My Meals page)
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

      if (userMealError) {
        console.error('Error adding meal to user collection:', userMealError);
        // Continue anyway - meal might already be in user_meals
      }

      // Then add to the meal plan
      const { error } = await supabase
        .from('weekly_meal_plan_entries')
        .insert([{
          plan_id: activePlan.id,
          meal_id: meal.id,
          plan_date: selectedSlot.date,
          meal_type: selectedSlot.mealType,
          servings: servings
        }]);

      if (error) throw error;

      await loadPlanEntries();
      setShowMealSelector(false);
      setSelectedSlot(null);
    } catch (error) {
      console.error('Error adding meal to plan:', error);
      
      // Provide more specific error messages
      if (error.code === '23505') {
        alert('This meal is already in that time slot.');
      } else {
        alert('Error adding meal to plan. Please try again.');
      }
    }
  };

  const removeMealFromSlot = async (entryId) => {
    try {
      const { error } = await supabase
        .from('weekly_meal_plan_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      await loadPlanEntries();
    } catch (error) {
      if (import.meta.env?.DEV) {

        console.warn('WeeklyMealPlannerPage - Error removing meal from plan:', error);
      }
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeek[0]);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentWeek(getWeekDates(newDate));
  };

  /**
   * Convert meal type key to display-friendly label
   * 
   * @param {string} mealType - Internal meal type identifier
   * @returns {string} Human-readable meal type label
   * 
   * @example
   * formatMealType('snack1'); // Returns "Snack 1"
   * formatMealType('breakfast'); // Returns "Breakfast"
   */
  const formatMealType = (mealType) => {
    const typeMap = {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack1: 'Snack 1',
      snack2: 'Snack 2'
    };
    return typeMap[mealType] || mealType;
  };

  /**
   * Get all meal entries for a specific date and meal type
   * 
   * @param {Date} date - Date to search for entries
   * @param {string} mealType - Meal type to filter by (breakfast, lunch, etc.)
   * @returns {Array} Array of meal plan entry objects
   * 
   * @example
   * const breakfastMeals = getMealsByTypeAndDate(new Date(), 'breakfast');
   */
  const getMealsByTypeAndDate = (date, mealType) => {
    const dateStr = date.toISOString().split('T')[0];
    return planEntries.filter(entry =>
      entry.plan_date === dateStr && entry.meal_type === mealType
    );
  };

  /**
   * Get calculated nutrition totals for a specific day
   * 
   * @param {Date} date - Date to get nutrition totals for
   * @returns {Object} Daily nutrition totals (calories, protein, carbs, fat)
   * 
   * @example
   * const todayNutrition = getDayNutrition(new Date());
   * // Access nutrition values: todayNutrition.calories, todayNutrition.protein, etc.
   */
  const getDayNutrition = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return weeklyNutrition[dateStr] || {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading meal planner...</p>
      </div>
    );
  }

  return (
    <div className="weekly-meal-planner">
      {/* Header */}
      <div className="planner-header">
        <div className="header-left">
          <h1>
            <Calendar className="icon" />
            Weekly Meal Planner
          </h1>
          <div className="week-navigation">
            <button onClick={() => navigateWeek(-1)} className="nav-btn">←</button>
            <span className="week-display">
              {currentWeek[0].toLocaleDateString()} - {currentWeek[6].toLocaleDateString()}
            </span>
            <button onClick={() => navigateWeek(1)} className="nav-btn">→</button>
          </div>
        </div>

        <div className="header-actions">
          <button onClick={() => setShowMealBuilder(true)} className="create-meal-btn">
            <Plus className="icon" />
            Create Meal
          </button>

          {activePlan && (
            <button className="duplicate-week-btn" onClick={duplicateLastWeek}>
              <Copy className="icon" />
              Duplicate Last Week
            </button>
          )}

          {!activePlan && (
            <button onClick={createNewMealPlan} className="create-plan-btn">
              <Plus className="icon" />
              Create Plan
            </button>
          )}
        </div>
      </div>

      {/* Active Plan Info */}
      {activePlan && (
        <div className="active-plan-info">
          <div className="plan-details">
            <h3>{activePlan.name}</h3>
            <p>{activePlan.start_date} to {activePlan.end_date}</p>
          </div>
          <div className="plan-actions">
            <button className="shopping-list-btn" onClick={() => setShowShoppingList(true)}>
              <ShoppingCart className="icon" />
              Shopping List
            </button>
            <button className="recommendations-btn" onClick={getRecommendations}>
              <Target className="icon" />
              Get Recommendations
            </button>
          </div>
        </div>
      )}

      {/* Meal Planning Grid */}
      {activePlan ? (
        <div className="meal-planning-grid">
          <div className="grid-header">
            <div className="meal-type-column">Meal</div>
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="day-column">{day}</div>
            ))}
          </div>

          {MEAL_TYPES.map(mealType => (
            <div key={mealType} className="meal-row">
              <div className="meal-type-label">
                {formatMealType(mealType)}
              </div>

              {currentWeek.map((date, dayIndex) => (
                <div
                  key={`${mealType}-${dayIndex}`}
                  className="meal-slot"
                  onClick={() => handleSlotClick(date, mealType)}
                >
                  {getMealsByTypeAndDate(date, mealType).map(entry => (
                    <div key={entry.id} className="meal-entry">
                      <div className="meal-name">{entry.meals.name}</div>
                      <div className="meal-servings">
                        {entry.servings} {entry.meals?.serving_unit || 'servings'}
                      </div>
                      <div className="meal-calories">
                        {Math.round(calculateMealNutrition(entry.meals.meal_foods, entry.servings).calories)} cal
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMealFromSlot(entry.id);
                        }}
                        className="remove-meal-btn"
                        title="Remove meal from plan"
                      >
                        <Trash2 className="icon" />
                      </button>
                    </div>
                  ))}

                  {getMealsByTypeAndDate(date, mealType).length === 0 && (
                    <div className="empty-slot">
                      <Plus className="icon" />
                      Add meal
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Daily Nutrition Summary Row */}
          <div className="nutrition-summary-row">
            <div className="meal-type-label">Daily Total</div>
            {currentWeek.map((date, dayIndex) => {
              const nutrition = getDayNutrition(date);
              return (
                <div key={`nutrition-${dayIndex}`} className="day-nutrition">
                  <div className="nutrition-item">
                    <span className="value">{Math.round(nutrition.calories)}</span>
                    <span className="label">cal</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="value">{Math.round(nutrition.protein)}g</span>
                    <span className="label">protein</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="value">{Math.round(nutrition.carbs)}g</span>
                    <span className="label">carbs</span>
                  </div>
                  <div className="nutrition-item">
                    <span className="value">{Math.round(nutrition.fat)}g</span>
                    <span className="label">fat</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="no-plan-message">
          <ChefHat className="icon large" />
          <h3>No Meal Plan Active</h3>
          <p>Create a new meal plan to start planning your weekly meals.</p>
          <button onClick={createNewMealPlan} className="create-plan-btn">
            <Plus className="icon" />
            Create Your First Plan
          </button>
        </div>
      )}

      {/* Meal Builder Modal */}
      <MealBuilder
        isOpen={showMealBuilder}
        onClose={() => setShowMealBuilder(false)}
        onSave={(_meal) => {
          loadUserMeals();
          setShowMealBuilder(false);
        }}
      />

      {/* Meal Selector Modal */}
      {showMealSelector && (
        <div className="meal-selector-overlay">
          <div className="meal-selector-modal">
            <div className="meal-selector-header">
              <h3>
                {selectedCategory === 'all'
                  ? 'Select a Meal'
                  : `Select a ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Meal`
                }
              </h3>
              <button onClick={() => setShowMealSelector(false)} className="close-btn">
                <X className="icon" />
              </button>
            </div>

            <div className="meal-selector-content">
              {/* Only show category tabs if selectedCategory is 'all' - when adding to specific meal slot, don't show tabs */}
              {selectedCategory === 'all' && (
                <div className="meal-categories">
                  {['all', 'breakfast', 'lunch', 'dinner', 'snack'].map(category => (
                    <button
                      key={category}
                      className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(category)}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              <div className="meal-list">
                {(() => {
                  // Debug: Log filtering process
                  const filteredMeals = userMeals.filter(meal => {
                    const matches = selectedCategory === 'all' || meal.category === selectedCategory;
                    return matches;
                  });

                  if (filteredMeals.length === 0) {
                    return (
                      <div className="no-meals-found">
                        <p>No {selectedCategory === 'all' ? '' : selectedCategory} meals found.</p>
                        <button
                          className="create-meal-btn"
                          onClick={() => {
                            setShowMealSelector(false);
                            setShowMealBuilder(true);
                          }}
                        >
                          <Plus className="icon" />
                          Create New Meal
                        </button>
                      </div>
                    );
                  }

                  return filteredMeals.map(meal => (
                    <div
                      key={meal.id}
                      className="meal-option"
                      onClick={() => addMealToSlot(meal)}
                    >
                      <div className="meal-info">
                        <div className="meal-name">{meal.display_name || meal.name}</div>
                        <div className="meal-description">{meal.description}</div>
                        <div className="meal-nutrition">
                          {Math.round(meal.nutrition.calories)} cal •
                          {Math.round(meal.nutrition.protein)}g protein •
                          {Math.round(meal.nutrition.carbs)}g carbs •
                          {Math.round(meal.nutrition.fat)}g fat
                        </div>
                      </div>
                      <div className="meal-meta">
                        <span className="meal-category">{meal.category}</span>
                        {meal.is_premade && <span className="premade-badge">Premade</span>}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shopping List Modal */}
      {showShoppingList && (
        <div className="meal-selector-overlay">
          <div className="meal-selector-modal shopping-list-modal">
            <div className="meal-selector-header">
              <h3>
                <ShoppingCart className="icon" />
                Shopping List - Week of {currentWeek[0].toLocaleDateString()}
              </h3>
              <div className="header-actions">
                <button 
                  onClick={shareShoppingList} 
                  className="share-btn"
                  title="Share shopping list"
                >
                  <Share2 className="icon" />
                </button>
                <button 
                  onClick={() => setShowShoppingList(false)} 
                  className="close-btn"
                  title="Close"
                >
                  <X className="icon" />
                </button>
              </div>
            </div>

            <div className="meal-selector-content">
              {(() => {
                const shoppingList = generateShoppingList();
                const hasItems = Object.keys(shoppingList).length > 0;

                if (!hasItems) {
                  return (
                    <div className="no-meals-found">
                      <p>No meals planned for this week yet.</p>
                      <p className="help-text">Add meals to your weekly plan to generate a shopping list.</p>
                    </div>
                  );
                }

                return (
                  <div className="shopping-list-content">
                    {Object.entries(shoppingList).map(([category, items]) => (
                      <div key={category} className="shopping-category">
                        <h4 className="category-title">{category}</h4>
                        <div className="shopping-items">
                          {items.map(item => (
                            <div key={item.id} className="shopping-item">
                              <input 
                                type="checkbox" 
                                id={`item-${item.id}`}
                                className="shopping-checkbox"
                              />
                              <label htmlFor={`item-${item.id}`} className="shopping-item-label">
                                <span className="item-name">{item.name}</span>
                                <span className="item-quantity">
                                  {Math.round(item.quantity * 10) / 10}× {item.serving_description}
                                </span>
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    
                    <div className="shopping-list-summary">
                      <p className="item-count">
                        Total: {Object.values(shoppingList).reduce((sum, items) => sum + items.length, 0)} items
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Nutrition Recommendations Modal */}
      {showRecommendations && nutritionAnalysis && (
        <div className="meal-selector-overlay">
          <div className="meal-selector-modal recommendations-modal">
            <div className="meal-selector-header">
              <h3>
                <Target className="icon" />
                Nutrition Recommendations
              </h3>
              <button 
                onClick={() => setShowRecommendations(false)} 
                className="close-btn"
                title="Close"
              >
                <X className="icon" />
              </button>
            </div>

            <div className="meal-selector-content recommendations-content">
              {/* Health Score */}
              <div className="health-score-section">
                <div className="health-score-circle">
                  <div className="score-value">{nutritionAnalysis.healthScore}</div>
                  <div className="score-label">Health Score</div>
                </div>
                <p className="score-description">
                  {nutritionAnalysis.healthScore >= 90 && "Excellent! Your nutrition is well-balanced."}
                  {nutritionAnalysis.healthScore >= 75 && nutritionAnalysis.healthScore < 90 && "Good nutrition with room for improvement."}
                  {nutritionAnalysis.healthScore >= 60 && nutritionAnalysis.healthScore < 75 && "Fair nutrition. Consider the recommendations below."}
                  {nutritionAnalysis.healthScore < 60 && "Your nutrition needs attention. Follow the recommendations."}
                </p>
              </div>

              {/* Recommendations */}
              {nutritionAnalysis.recommendations && nutritionAnalysis.recommendations.length > 0 && (
                <div className="recommendations-section">
                  <h4>Personalized Recommendations</h4>
                  {nutritionAnalysis.recommendations.map((rec, index) => (
                    <div key={index} className={`recommendation-card ${rec.type}`}>
                      <div className="recommendation-header">
                        {rec.type === 'deficiency' && '🔻'}
                        {rec.type === 'excess' && '⚠️'}
                        {rec.type === 'success' && '✅'}
                        <strong>{rec.type === 'deficiency' ? 'Deficiency Detected' : rec.type === 'excess' ? 'Excess Intake' : 'Well Balanced'}</strong>
                      </div>
                      <p className="recommendation-text">{rec.suggestion}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Deficiency Details */}
              {nutritionAnalysis.deficiencies && nutritionAnalysis.deficiencies.length > 0 && (
                <div className="deficiencies-section">
                  <h4>Nutrient Analysis</h4>
                  <div className="deficiency-list">
                    {nutritionAnalysis.deficiencies.map((def, index) => (
                      <div key={index} className={`deficiency-item severity-${def.severity}`}>
                        <div className="deficiency-header">
                          <span className="nutrient-name">{def.nutrientName}</span>
                          <span className={`severity-badge ${def.severity}`}>
                            {def.severity.charAt(0).toUpperCase() + def.severity.slice(1)}
                          </span>
                        </div>
                        <div className="deficiency-details">
                          <div className="intake-bar">
                            <div 
                              className="intake-fill" 
                              style={{ width: `${Math.min(def.percentOfTarget, 100)}%` }}
                            />
                          </div>
                          <div className="intake-text">
                            Daily Average: <strong>{def.intake.toFixed(1)} {def.unit}</strong> 
                            {' '} / Target: {def.target} {def.unit}
                            {' '}({def.percentOfTarget.toFixed(0)}%)
                          </div>
                        </div>
                        {def.foodSources && def.foodSources.length > 0 && (
                          <div className="food-sources">
                            <strong>Top Sources:</strong> {def.foodSources.join(', ')}
                          </div>
                        )}
                        {def.description && (
                          <p className="nutrient-description">{def.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Averages Summary */}
              <div className="daily-averages-section">
                <h4>Daily Nutrition Averages</h4>
                <div className="averages-grid">
                  <div className="average-item">
                    <span className="average-label">Calories</span>
                    <span className="average-value">{nutritionAnalysis.dailyAverages.calories?.toFixed(0) || 0} kcal</span>
                  </div>
                  <div className="average-item">
                    <span className="average-label">Protein</span>
                    <span className="average-value">{nutritionAnalysis.dailyAverages.protein_g?.toFixed(1) || 0} g</span>
                  </div>
                  <div className="average-item">
                    <span className="average-label">Carbs</span>
                    <span className="average-value">{nutritionAnalysis.dailyAverages.carbs_g?.toFixed(1) || 0} g</span>
                  </div>
                  <div className="average-item">
                    <span className="average-label">Fat</span>
                    <span className="average-value">{nutritionAnalysis.dailyAverages.fat_g?.toFixed(1) || 0} g</span>
                  </div>
                  <div className="average-item">
                    <span className="average-label">Fiber</span>
                    <span className="average-value">{nutritionAnalysis.dailyAverages.fiber_g?.toFixed(1) || 0} g</span>
                  </div>
                </div>
              </div>

              {/* Note about micronutrients */}
              {nutritionAnalysis.deficiencies && nutritionAnalysis.deficiencies.filter(d => d.nutrient !== 'protein_g' && d.nutrient !== 'carbs_g' && d.nutrient !== 'fat_g' && d.nutrient !== 'fiber_g' && d.nutrient !== 'calories').length === 0 && (
                <div className="micronutrient-note">
                  <p>
                    <strong>Note:</strong> Vitamin and mineral analysis will be available once food micronutrient data is populated. 
                    Currently showing macronutrient analysis (protein, carbs, fat, fiber).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default WeeklyMealPlannerPage;
