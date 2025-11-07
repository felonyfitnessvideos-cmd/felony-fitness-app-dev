-- Debug nutrition logs to see what's happening with missing food items
-- This query will show all nutrition logs with their associated food_servings data
-- First, check if logs exist
SELECT nl.id,
    nl.created_at,
    nl.meal_type,
    nl.food_serving_id,
    nl.quantity_consumed,
    fs.food_name,
    fs.serving_description,
    fs.calories
FROM nutrition_logs nl
    LEFT JOIN food_servings fs ON nl.food_serving_id = fs.id
WHERE nl.created_at >= CURRENT_DATE
ORDER BY nl.created_at DESC;
-- Check if there are any logs with NULL food_serving_id or missing food_servings
SELECT nl.id,
    nl.created_at,
    nl.meal_type,
    nl.food_serving_id,
    nl.quantity_consumed,
    CASE
        WHEN fs.id IS NULL THEN 'MISSING FOOD_SERVINGS'
        ELSE 'OK'
    END as status
FROM nutrition_logs nl
    LEFT JOIN food_servings fs ON nl.food_serving_id = fs.id
WHERE nl.created_at >= CURRENT_DATE
    AND fs.id IS NULL;
-- Find coffee entries specifically
SELECT nl.id,
    nl.created_at,
    nl.meal_type,
    nl.food_serving_id,
    nl.quantity_consumed,
    fs.food_name,
    fs.serving_description
FROM nutrition_logs nl
    LEFT JOIN food_servings fs ON nl.food_serving_id = fs.id
WHERE nl.created_at >= CURRENT_DATE
    AND (
        fs.food_name ILIKE '%coffee%'
        OR fs.food_name ILIKE '%milk%'
    );