-- Meal Planner Data Audit
-- Date: 2025-11-07
-- Description: Comprehensive audit of meal planning data structure and relationships
-- =====================================================
-- 1. FOOD_SERVINGS TABLE (Backbone)
-- =====================================================
SELECT 'FOOD_SERVINGS' as table_name,
    COUNT(*) as total_rows,
    COUNT(
        CASE
            WHEN calories IS NULL THEN 1
        END
    ) as missing_calories,
    COUNT(
        CASE
            WHEN protein_g IS NULL THEN 1
        END
    ) as missing_protein,
    COUNT(
        CASE
            WHEN carbs_g IS NULL THEN 1
        END
    ) as missing_carbs,
    COUNT(
        CASE
            WHEN fat_g IS NULL THEN 1
        END
    ) as missing_fat
FROM public.food_servings;
-- =====================================================
-- 2. MEALS TABLE
-- =====================================================
SELECT 'MEALS' as table_name,
    COUNT(*) as total_meals,
    COUNT(
        CASE
            WHEN is_premade = true THEN 1
        END
    ) as premade_meals,
    COUNT(
        CASE
            WHEN is_premade = false
            OR is_premade IS NULL THEN 1
        END
    ) as user_created_meals,
    COUNT(
        CASE
            WHEN user_id IS NULL THEN 1
        END
    ) as meals_with_no_user
FROM public.meals;
-- =====================================================
-- 3. MEAL_FOODS TABLE (Critical Junction)
-- =====================================================
SELECT 'MEAL_FOODS' as table_name,
    COUNT(*) as total_meal_foods,
    COUNT(DISTINCT meal_id) as meals_with_foods,
    COUNT(DISTINCT food_servings_id) as unique_foods_used,
    COUNT(
        CASE
            WHEN quantity IS NULL
            OR quantity = 0 THEN 1
        END
    ) as missing_or_zero_quantity
FROM public.meal_foods;
-- =====================================================
-- 4. ORPHANED MEALS (No meal_foods entries)
-- =====================================================
SELECT 'ORPHANED MEALS' as audit_category,
    COUNT(*) as meals_without_ingredients
FROM public.meals m
WHERE NOT EXISTS (
        SELECT 1
        FROM public.meal_foods mf
        WHERE mf.meal_id = m.id
    );
-- List orphaned premade meals
SELECT m.id,
    m.name,
    m.category,
    m.is_premade
FROM public.meals m
WHERE m.is_premade = true
    AND NOT EXISTS (
        SELECT 1
        FROM public.meal_foods mf
        WHERE mf.meal_id = m.id
    )
ORDER BY m.category,
    m.name;
-- =====================================================
-- 5. USER_MEALS TABLE
-- =====================================================
SELECT 'USER_MEALS' as table_name,
    COUNT(*) as total_user_meals,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT meal_id) as unique_meals_saved,
    COUNT(
        CASE
            WHEN is_favorite = true THEN 1
        END
    ) as favorited_meals
FROM public.user_meals;
-- =====================================================
-- 6. BROKEN RELATIONSHIPS
-- =====================================================
-- meal_foods pointing to non-existent meals
SELECT 'BROKEN MEAL_FOODS -> MEALS' as issue,
    COUNT(*) as broken_count
FROM public.meal_foods mf
WHERE NOT EXISTS (
        SELECT 1
        FROM public.meals m
        WHERE m.id = mf.meal_id
    );
-- meal_foods pointing to non-existent food_servings
SELECT 'BROKEN MEAL_FOODS -> FOOD_SERVINGS' as issue,
    COUNT(*) as broken_count
FROM public.meal_foods mf
WHERE NOT EXISTS (
        SELECT 1
        FROM public.food_servings fs
        WHERE fs.id = mf.food_servings_id
    );
-- user_meals pointing to non-existent meals
SELECT 'BROKEN USER_MEALS -> MEALS' as issue,
    COUNT(*) as broken_count
FROM public.user_meals um
WHERE NOT EXISTS (
        SELECT 1
        FROM public.meals m
        WHERE m.id = um.meal_id
    );
-- =====================================================
-- 7. WEEKLY MEAL PLAN TABLES
-- =====================================================
SELECT 'WEEKLY_MEAL_PLANS' as table_name,
    COUNT(*) as total_plans,
    COUNT(
        CASE
            WHEN is_active = true THEN 1
        END
    ) as active_plans,
    COUNT(DISTINCT user_id) as users_with_plans
FROM public.weekly_meal_plans;
SELECT 'WEEKLY_MEAL_PLAN_ENTRIES' as table_name,
    COUNT(*) as total_entries,
    COUNT(DISTINCT plan_id) as plans_with_entries,
    COUNT(DISTINCT meal_id) as unique_meals_in_plans
FROM public.weekly_meal_plan_entries;
-- =====================================================
-- 8. SAMPLE DATA INSPECTION
-- =====================================================
-- Show one complete meal with all relationships
SELECT m.name as meal_name,
    m.category,
    m.is_premade,
    mf.quantity,
    fs.food_name,
    fs.calories,
    fs.protein_g,
    fs.carbs_g,
    fs.fat_g
FROM public.meals m
    LEFT JOIN public.meal_foods mf ON mf.meal_id = m.id
    LEFT JOIN public.food_servings fs ON fs.id = mf.food_servings_id
WHERE EXISTS (
        SELECT 1
        FROM public.meal_foods
        WHERE meal_id = m.id
    )
LIMIT 10;
-- =====================================================
-- 9. SUMMARY
-- =====================================================
SELECT '=== AUDIT SUMMARY ===' as section,
    (
        SELECT COUNT(*)
        FROM public.food_servings
    ) as food_servings_count,
    (
        SELECT COUNT(*)
        FROM public.meals
    ) as meals_count,
    (
        SELECT COUNT(*)
        FROM public.meal_foods
    ) as meal_foods_count,
    (
        SELECT COUNT(*)
        FROM public.user_meals
    ) as user_meals_count,
    (
        SELECT COUNT(*)
        FROM public.weekly_meal_plans
    ) as meal_plans_count,
    (
        SELECT COUNT(*)
        FROM public.weekly_meal_plan_entries
    ) as plan_entries_count,
    (
        SELECT COUNT(*)
        FROM public.meals
        WHERE NOT EXISTS (
                SELECT 1
                FROM public.meal_foods
                WHERE meal_id = meals.id
            )
    ) as orphaned_meals;