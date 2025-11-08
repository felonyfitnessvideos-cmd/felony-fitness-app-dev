/**
 * Nutrition Recommendations & Deficiency Analyzer
 * 
 * Analyzes weekly nutrition intake and provides personalized recommendations
 * based on dietary deficiencies, user goals, and RDA targets.
 * 
 * @module nutritionRecommendations
 */

/**
 * Recommended Daily Allowance (RDA) targets for adults
 * Based on FDA guidelines and nutrition science
 */
export const RDA_TARGETS = {
  // Macronutrients (vary by individual goals)
  calories: { min: 1500, optimal: 2000, max: 3000 },
  protein_g: { min: 50, optimal: 100, max: 200 }, // 0.8-1.2g per lb bodyweight
  carbs_g: { min: 100, optimal: 250, max: 400 },
  fat_g: { min: 40, optimal: 65, max: 100 },
  fiber_g: { min: 25, optimal: 30, max: 50 },
  sugar_g: { min: 0, optimal: 25, max: 50 }, // Added sugars limit

  // Minerals (mg unless noted)
  sodium_mg: { min: 500, optimal: 1500, max: 2300 },
  calcium_mg: { min: 1000, optimal: 1200, max: 2500 },
  iron_mg: { min: 8, optimal: 18, max: 45 }, // Higher for women
  potassium_mg: { min: 2600, optimal: 3400, max: 5000 },
  magnesium_mg: { min: 310, optimal: 420, max: 700 },
  phosphorus_mg: { min: 700, optimal: 1250, max: 4000 },
  zinc_mg: { min: 8, optimal: 11, max: 40 },
  copper_mg: { min: 0.9, optimal: 1.3, max: 10 },
  selenium_mcg: { min: 55, optimal: 70, max: 400 },

  // Vitamins
  vitamin_a_mcg: { min: 700, optimal: 900, max: 3000 },
  vitamin_c_mg: { min: 75, optimal: 90, max: 2000 },
  vitamin_e_mg: { min: 15, optimal: 20, max: 1000 },
  vitamin_k_mcg: { min: 90, optimal: 120, max: 1000 },
  thiamin_mg: { min: 1.1, optimal: 1.2, max: 100 }, // B1
  riboflavin_mg: { min: 1.1, optimal: 1.3, max: 100 }, // B2
  niacin_mg: { min: 14, optimal: 16, max: 35 }, // B3
  vitamin_b6_mg: { min: 1.3, optimal: 1.7, max: 100 },
  folate_mcg: { min: 400, optimal: 600, max: 1000 }, // B9
  vitamin_b12_mcg: { min: 2.4, optimal: 3.0, max: 100 },
};

/**
 * Foods rich in specific nutrients
 * Used for targeted recommendations
 */
export const NUTRIENT_SOURCES = {
  protein_g: {
    category: 'Proteins',
    topFoods: ['Chicken Breast', 'Salmon', 'Eggs', 'Greek Yogurt', 'Lean Beef', 'Tuna', 'Turkey', 'Whey Protein'],
    description: 'Essential for muscle growth and repair',
  },
  fiber_g: {
    category: 'Vegetables',
    topFoods: ['Broccoli', 'Brussels Sprouts', 'Lentils', 'Black Beans', 'Oats', 'Quinoa', 'Chia Seeds'],
    description: 'Important for digestive health',
  },
  iron_mg: {
    category: 'Proteins',
    topFoods: ['Spinach', 'Red Meat', 'Lentils', 'Quinoa', 'Turkey', 'Chickpeas'],
    description: 'Critical for oxygen transport',
  },
  calcium_mg: {
    category: 'Dairy & Eggs',
    topFoods: ['Milk', 'Greek Yogurt', 'Cheese', 'Cottage Cheese', 'Kale', 'Sardines'],
    description: 'Essential for bone health',
  },
  vitamin_c_mg: {
    category: 'Fruits',
    topFoods: ['Oranges', 'Strawberries', 'Bell Peppers', 'Broccoli', 'Kiwi', 'Tomatoes'],
    description: 'Boosts immune system',
  },
  vitamin_a_mcg: {
    category: 'Vegetables',
    topFoods: ['Sweet Potatoes', 'Carrots', 'Spinach', 'Kale', 'Butternut Squash', 'Red Peppers'],
    description: 'Important for vision and immunity',
  },
  potassium_mg: {
    category: 'Fruits',
    topFoods: ['Bananas', 'Sweet Potatoes', 'Spinach', 'Avocados', 'Salmon', 'Beans'],
    description: 'Regulates blood pressure',
  },
  magnesium_mg: {
    category: 'Nuts & Seeds',
    topFoods: ['Almonds', 'Spinach', 'Cashews', 'Black Beans', 'Avocado', 'Dark Chocolate'],
    description: 'Supports muscle and nerve function',
  },
  vitamin_b12_mcg: {
    category: 'Proteins',
    topFoods: ['Salmon', 'Beef', 'Eggs', 'Milk', 'Chicken', 'Fortified Cereals'],
    description: 'Essential for nerve health',
  },
  folate_mcg: {
    category: 'Vegetables',
    topFoods: ['Lentils', 'Spinach', 'Broccoli', 'Asparagus', 'Black Beans', 'Avocado'],
    description: 'Important for cell growth',
  },
  zinc_mg: {
    category: 'Proteins',
    topFoods: ['Oysters', 'Beef', 'Pumpkin Seeds', 'Lentils', 'Chickpeas', 'Cashews'],
    description: 'Supports immune function',
  },
  vitamin_e_mg: {
    category: 'Nuts & Seeds',
    topFoods: ['Almonds', 'Sunflower Seeds', 'Avocado', 'Spinach', 'Olive Oil'],
    description: 'Powerful antioxidant',
  },
};

/**
 * Calculate weekly nutrient totals from meal plan entries
 * 
 * @param {Array} planEntries - Weekly meal plan entries with meal_foods data
 * @returns {Object} Nutrient totals for the week
 */
export function calculateWeeklyNutrientTotals(planEntries) {
  const totals = {
    // Macros
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    sugar_g: 0,
    
    // Minerals
    sodium_mg: 0,
    calcium_mg: 0,
    iron_mg: 0,
    potassium_mg: 0,
    magnesium_mg: 0,
    phosphorus_mg: 0,
    zinc_mg: 0,
    copper_mg: 0,
    selenium_mcg: 0,
    
    // Vitamins
    vitamin_a_mcg: 0,
    vitamin_c_mg: 0,
    vitamin_e_mg: 0,
    vitamin_k_mcg: 0,
    thiamin_mg: 0,
    riboflavin_mg: 0,
    niacin_mg: 0,
    vitamin_b6_mg: 0,
    folate_mcg: 0,
    vitamin_b12_mcg: 0,
  };

  planEntries.forEach(entry => {
    const servings = entry.servings || 1;
    const mealFoods = entry.meals?.meal_foods || [];

    mealFoods.forEach(mealFood => {
      const food = mealFood.food_servings;
      if (!food) return;

      const quantity = mealFood.quantity * servings;

      // Accumulate all nutrients
      Object.keys(totals).forEach(nutrient => {
        const value = food[nutrient];
        if (value !== null && value !== undefined && !isNaN(value)) {
          totals[nutrient] += value * quantity;
        }
      });
    });
  });

  return totals;
}

/**
 * Calculate daily averages from weekly totals
 * 
 * @param {Object} weeklyTotals - Weekly nutrient totals
 * @returns {Object} Daily average nutrient intake
 */
export function calculateDailyAverages(weeklyTotals) {
  const dailyAverages = {};
  Object.keys(weeklyTotals).forEach(nutrient => {
    dailyAverages[nutrient] = weeklyTotals[nutrient] / 7;
  });
  return dailyAverages;
}

/**
 * Identify nutrient deficiencies based on RDA targets
 * 
 * @param {Object} dailyAverages - Daily average nutrient intake
 * @returns {Array} Array of deficiency objects with severity and recommendations
 */
export function identifyDeficiencies(dailyAverages) {
  const deficiencies = [];

  Object.keys(RDA_TARGETS).forEach(nutrient => {
    const intake = dailyAverages[nutrient] || 0;
    const target = RDA_TARGETS[nutrient];

    // Calculate percentage of optimal intake
    const rawPercent = target?.optimal ? (intake / target.optimal) * 100 : 0;
    const percentOfTarget = Number.isFinite(rawPercent) ? rawPercent : 0;

    // Determine deficiency severity
    let severity = null;
    if (percentOfTarget < 50) {
      severity = 'critical'; // Less than 50% of optimal
    } else if (percentOfTarget < 75) {
      severity = 'moderate'; // 50-75% of optimal
    } else if (percentOfTarget < 90) {
      severity = 'mild'; // 75-90% of optimal
    }

    // Check for excess
    let excess = false;
    if (intake > target.max) {
      excess = true;
    }

    if (severity || excess) {
      const source = NUTRIENT_SOURCES[nutrient];
      const nutrientName = formatNutrientName(nutrient);
      const unit = getNutrientUnit(nutrient);
      
      deficiencies.push({
        nutrient,
        nutrientName,
        intake: Math.round(intake * 100) / 100,
        target: target.optimal,
        min: target.min,
        max: target.max,
        percentage: Math.round(percentOfTarget),
        percentOfTarget,
        unit,
        severity: excess ? 'excess' : severity,
        category: source?.category || 'Unknown',
        topFoods: source?.topFoods || [],
        foodSources: source?.topFoods || [],
        description: source?.description || '',
      });
    }
  });

  // Sort by severity (critical first)
  const severityOrder = { critical: 1, moderate: 2, mild: 3, excess: 4 };
  deficiencies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return deficiencies;
}

/**
 * Generate personalized meal recommendations based on deficiencies
 * 
 * @param {Array} deficiencies - Array of identified deficiencies
 * @param {Array} _availableMeals - User's available meals (reserved for future enhancement)
 * @returns {Array} Recommended meals with reasoning
 */
export function generateMealRecommendations(deficiencies, _availableMeals) {
  const recommendations = [];

  // Focus on top 3 most severe deficiencies
  const topDeficiencies = deficiencies.slice(0, 3).filter(d => d.severity !== 'excess');

  if (topDeficiencies.length === 0) {
    return [{
      type: 'success',
      message: 'Great job! Your nutrition is well-balanced.',
      suggestion: 'Maintain your current meal plan for consistent results.',
    }];
  }

  // Generate recommendations for each deficiency
  topDeficiencies.forEach(deficiency => {
    const { nutrient, intake, target, severity, topFoods, description } = deficiency;
    
    const shortfall = target - intake;
    const nutrientName = nutrient.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    recommendations.push({
      type: 'deficiency',
      severity,
      nutrient: nutrientName,
      current: Math.round(intake),
      target: Math.round(target),
      shortfall: Math.round(shortfall),
      description,
      topFoods,
      suggestion: `Add more ${topFoods.slice(0, 3).join(', ')} to increase your ${nutrientName} intake.`,
    });
  });

  // Check for excess nutrients
  const excessNutrients = deficiencies.filter(d => d.severity === 'excess');
  excessNutrients.forEach(excess => {
    const nutrientName = excess.nutrient.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    recommendations.push({
      type: 'excess',
      severity: 'warning',
      nutrient: nutrientName,
      current: Math.round(excess.intake),
      max: Math.round(excess.max),
      suggestion: `Consider reducing ${nutrientName} intake. Current consumption exceeds recommended maximum.`,
    });
  });

  return recommendations;
}

/**
 * Analyze complete weekly nutrition and generate report
 * 
 * @param {Array} planEntries - Weekly meal plan entries
 * @param {Array} availableMeals - User's available meals
 * @returns {Object} Complete nutrition analysis report
 */
export function analyzeWeeklyNutrition(planEntries, availableMeals = []) {
  // Calculate totals and averages
  const weeklyTotals = calculateWeeklyNutrientTotals(planEntries);
  const dailyAverages = calculateDailyAverages(weeklyTotals);
  
  // Identify deficiencies
  const deficiencies = identifyDeficiencies(dailyAverages);
  
  // Generate recommendations
  const recommendations = generateMealRecommendations(deficiencies, availableMeals);

  // Calculate overall health score (0-100)
  const totalNutrients = Object.keys(RDA_TARGETS).length;
  const adequateNutrients = Object.keys(dailyAverages).filter(nutrient => {
    const intake = dailyAverages[nutrient];
    const target = RDA_TARGETS[nutrient];
    return intake >= target.min && intake <= target.max;
  }).length;
  
  const healthScore = Math.round((adequateNutrients / totalNutrients) * 100);

  return {
    weeklyTotals,
    dailyAverages,
    deficiencies,
    recommendations,
    healthScore,
    summary: {
      totalNutrients,
      adequateNutrients,
      deficientNutrients: deficiencies.filter(d => d.severity !== 'excess').length,
      excessNutrients: deficiencies.filter(d => d.severity === 'excess').length,
    },
  };
}

/**
 * Format nutrient name for display
 * 
 * @param {string} nutrient - Nutrient key (e.g., 'protein_g')
 * @returns {string} Formatted name (e.g., 'Protein')
 */
export function formatNutrientName(nutrient) {
  return nutrient
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/ Mcg$/, ' (µg)')
    .replace(/ Mg$/, ' (mg)')
    .replace(/ G$/, ' (g)');
}

/**
 * Get severity color for UI display
 * 
 * @param {string} severity - Severity level
 * @returns {string} CSS color value
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'critical': return '#dc2626'; // red-600
    case 'moderate': return '#ea580c'; // orange-600
    case 'mild': return '#ca8a04'; // yellow-600
    case 'excess': return '#9333ea'; // purple-600
    default: return '#6b7280'; // gray-500
  }
}

/**
 * Get severity label for UI display
 * 
 * @param {string} severity - Severity level
 * @returns {string} Human-readable label
 */
export function getSeverityLabel(severity) {
  switch (severity) {
    case 'critical': return 'Critical';
    case 'moderate': return 'Moderate';
    case 'mild': return 'Mild';
    case 'excess': return 'Excess';
    default: return 'Unknown';
  }
}

/**
 * Get unit string for a nutrient
 * 
 * @param {string} nutrient - Nutrient key (e.g., 'protein_g', 'iron_mg')
 * @returns {string} Unit string (e.g., 'g', 'mg', 'µg', 'kcal')
 */
function getNutrientUnit(nutrient) {
  if (nutrient.endsWith('_mg')) return 'mg';
  if (nutrient.endsWith('_mcg')) return 'µg';
  if (nutrient.endsWith('_g')) return 'g';
  if (nutrient === 'calories') return 'kcal';
  return '';
}
