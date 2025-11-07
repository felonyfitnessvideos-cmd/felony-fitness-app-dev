-- Cleanup script: Delete nutrition_logs entries with NULL food_serving_id
-- These are broken entries that can't be displayed in the UI
-- First, let's see what we're about to delete
SELECT id,
    created_at,
    meal_type,
    food_serving_id,
    quantity_consumed
FROM nutrition_logs
WHERE food_serving_id IS NULL
    AND meal_type != 'Water' -- Don't delete water logs (they don't need food_serving_id)
ORDER BY created_at DESC;
-- Uncomment the following line to actually delete them:
-- DELETE FROM nutrition_logs WHERE food_serving_id IS NULL AND meal_type != 'Water';