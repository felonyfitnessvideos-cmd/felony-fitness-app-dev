-- Migration: Consolidate foods table columns into food_servings
-- Date: 2025-11-07
-- Purpose: Add metadata fields from foods table to food_servings for complete denormalization
-- This enables single-table queries and eliminates broken JOIN operations
-- Add columns from foods table
ALTER TABLE food_servings
ADD COLUMN IF NOT EXISTS brand TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS data_sources TEXT DEFAULT 'user_input',
    ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS last_enrichment TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user_input';
-- Add PDCAAS (Protein Digestibility-Corrected Amino Acid Score)
-- Range: 0.0 to 1.0, where 1.0 is highest quality protein
-- Examples: Whey protein = 1.0, Beef = 0.92, Soy = 0.91, Wheat = 0.42
ALTER TABLE food_servings
ADD COLUMN IF NOT EXISTS pdcaas_score DECIMAL(3, 2) DEFAULT 0.00 CHECK (
        pdcaas_score >= 0
        AND pdcaas_score <= 1.0
    );
-- Set explicit defaults for all nutrition columns (no nulls allowed)
-- This ensures data quality and simplifies client-side calculations
-- Core macronutrients - default to 0 if not specified
ALTER TABLE food_servings
ALTER COLUMN calories
SET DEFAULT 0.00,
    ALTER COLUMN protein_g
SET DEFAULT 0.00,
    ALTER COLUMN carbs_g
SET DEFAULT 0.00,
    ALTER COLUMN fat_g
SET DEFAULT 0.00,
    ALTER COLUMN fiber_g
SET DEFAULT 0.00,
    ALTER COLUMN sugar_g
SET DEFAULT 0.00;
-- Micronutrients - default to 0 if not specified
ALTER TABLE food_servings
ALTER COLUMN sodium_mg
SET DEFAULT 0.00,
    ALTER COLUMN calcium_mg
SET DEFAULT 0.00,
    ALTER COLUMN iron_mg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_c_mg
SET DEFAULT 0.00,
    ALTER COLUMN potassium_mg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_a_mcg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_e_mg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_k_mcg
SET DEFAULT 0.00,
    ALTER COLUMN thiamin_mg
SET DEFAULT 0.00,
    ALTER COLUMN riboflavin_mg
SET DEFAULT 0.00,
    ALTER COLUMN niacin_mg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_b6_mg
SET DEFAULT 0.00,
    ALTER COLUMN folate_mcg
SET DEFAULT 0.00,
    ALTER COLUMN vitamin_b12_mcg
SET DEFAULT 0.00,
    ALTER COLUMN magnesium_mg
SET DEFAULT 0.00,
    ALTER COLUMN phosphorus_mg
SET DEFAULT 0.00,
    ALTER COLUMN zinc_mg
SET DEFAULT 0.00,
    ALTER COLUMN copper_mg
SET DEFAULT 0.00,
    ALTER COLUMN selenium_mcg
SET DEFAULT 0.00;
-- Update existing NULL values to 0 (data cleanup)
-- Consolidated UPDATE for better performance (single table scan instead of 19)
UPDATE food_servings
SET calories = COALESCE(calories, 0.00),
    protein_g = COALESCE(protein_g, 0.00),
    carbs_g = COALESCE(carbs_g, 0.00),
    fat_g = COALESCE(fat_g, 0.00),
    fiber_g = COALESCE(fiber_g, 0.00),
    sugar_g = COALESCE(sugar_g, 0.00),
    sodium_mg = COALESCE(sodium_mg, 0.00),
    calcium_mg = COALESCE(calcium_mg, 0.00),
    iron_mg = COALESCE(iron_mg, 0.00),
    vitamin_c_mg = COALESCE(vitamin_c_mg, 0.00),
    potassium_mg = COALESCE(potassium_mg, 0.00),
    vitamin_a_mcg = COALESCE(vitamin_a_mcg, 0.00),
    vitamin_e_mg = COALESCE(vitamin_e_mg, 0.00),
    vitamin_k_mcg = COALESCE(vitamin_k_mcg, 0.00),
    thiamin_mg = COALESCE(thiamin_mg, 0.00),
    riboflavin_mg = COALESCE(riboflavin_mg, 0.00),
    niacin_mg = COALESCE(niacin_mg, 0.00),
    vitamin_b6_mg = COALESCE(vitamin_b6_mg, 0.00),
    folate_mcg = COALESCE(folate_mcg, 0.00),
    vitamin_b12_mcg = COALESCE(vitamin_b12_mcg, 0.00),
    magnesium_mg = COALESCE(magnesium_mg, 0.00),
    phosphorus_mg = COALESCE(phosphorus_mg, 0.00),
    zinc_mg = COALESCE(zinc_mg, 0.00),
    copper_mg = COALESCE(copper_mg, 0.00),
    selenium_mcg = COALESCE(selenium_mcg, 0.00)
WHERE calories IS NULL
    OR protein_g IS NULL
    OR carbs_g IS NULL
    OR fat_g IS NULL
    OR fiber_g IS NULL
    OR sugar_g IS NULL
    OR sodium_mg IS NULL
    OR calcium_mg IS NULL
    OR iron_mg IS NULL
    OR vitamin_c_mg IS NULL
    OR potassium_mg IS NULL
    OR vitamin_a_mcg IS NULL
    OR vitamin_e_mg IS NULL
    OR vitamin_k_mcg IS NULL
    OR thiamin_mg IS NULL
    OR riboflavin_mg IS NULL
    OR niacin_mg IS NULL
    OR vitamin_b6_mg IS NULL
    OR folate_mcg IS NULL
    OR vitamin_b12_mcg IS NULL
    OR magnesium_mg IS NULL
    OR phosphorus_mg IS NULL
    OR zinc_mg IS NULL
    OR copper_mg IS NULL
    OR selenium_mcg IS NULL;
-- Make nutrition columns NOT NULL after setting defaults
ALTER TABLE food_servings
ALTER COLUMN calories
SET NOT NULL,
    ALTER COLUMN protein_g
SET NOT NULL,
    ALTER COLUMN carbs_g
SET NOT NULL,
    ALTER COLUMN fat_g
SET NOT NULL,
    ALTER COLUMN fiber_g
SET NOT NULL,
    ALTER COLUMN sugar_g
SET NOT NULL,
    ALTER COLUMN sodium_mg
SET NOT NULL,
    ALTER COLUMN calcium_mg
SET NOT NULL,
    ALTER COLUMN iron_mg
SET NOT NULL,
    ALTER COLUMN vitamin_c_mg
SET NOT NULL,
    ALTER COLUMN potassium_mg
SET NOT NULL,
    ALTER COLUMN vitamin_a_mcg
SET NOT NULL,
    ALTER COLUMN vitamin_e_mg
SET NOT NULL,
    ALTER COLUMN vitamin_k_mcg
SET NOT NULL,
    ALTER COLUMN thiamin_mg
SET NOT NULL,
    ALTER COLUMN riboflavin_mg
SET NOT NULL,
    ALTER COLUMN niacin_mg
SET NOT NULL,
    ALTER COLUMN vitamin_b6_mg
SET NOT NULL,
    ALTER COLUMN folate_mcg
SET NOT NULL,
    ALTER COLUMN vitamin_b12_mcg
SET NOT NULL,
    ALTER COLUMN magnesium_mg
SET NOT NULL,
    ALTER COLUMN phosphorus_mg
SET NOT NULL,
    ALTER COLUMN zinc_mg
SET NOT NULL,
    ALTER COLUMN copper_mg
SET NOT NULL,
    ALTER COLUMN selenium_mcg
SET NOT NULL;
-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_food_servings_category ON food_servings(category);
-- Create index on brand for faster filtering
CREATE INDEX IF NOT EXISTS idx_food_servings_brand ON food_servings(brand);
-- Create index on source for analytics
CREATE INDEX IF NOT EXISTS idx_food_servings_source ON food_servings(source);
-- Create index on quality_score for filtering high-quality foods
CREATE INDEX IF NOT EXISTS idx_food_servings_quality_score ON food_servings(quality_score);
-- Create composite index for enrichment pipeline queries
CREATE INDEX IF NOT EXISTS idx_food_servings_enrichment ON food_servings(enrichment_status, last_enrichment);
-- Add comment explaining the consolidation
COMMENT ON TABLE food_servings IS 'Consolidated food and serving data table. Previously split between foods and food_servings tables, now denormalized for performance and simplicity. Each row represents a specific serving size of a food item with complete nutritional information.';
COMMENT ON COLUMN food_servings.pdcaas_score IS 'Protein Digestibility-Corrected Amino Acid Score (0.0-1.0). Measures protein quality. 1.0 = highest quality (whey, egg), 0.9+ = high (beef, soy), 0.7+ = good (legumes), <0.7 = lower quality (grains). Used for protein quality analytics.';
COMMENT ON COLUMN food_servings.data_sources IS 'Comma-separated list of data sources: user_input, openai, fatsecret, usda, manual_entry';
COMMENT ON COLUMN food_servings.quality_score IS 'Data quality score 0-100. Based on completeness of nutrition data, source reliability, and verification status.';
COMMENT ON COLUMN food_servings.enrichment_status IS 'Status of data enrichment: pending, in_progress, completed, failed, not_needed';
COMMENT ON COLUMN food_servings.source IS 'Primary data source: user_input, external_api, manual_entry, imported, verified_database';