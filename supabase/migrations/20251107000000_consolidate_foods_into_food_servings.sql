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
UPDATE food_servings
SET calories = 0.00
WHERE calories IS NULL;
UPDATE food_servings
SET protein_g = 0.00
WHERE protein_g IS NULL;
UPDATE food_servings
SET carbs_g = 0.00
WHERE carbs_g IS NULL;
UPDATE food_servings
SET fat_g = 0.00
WHERE fat_g IS NULL;
UPDATE food_servings
SET fiber_g = 0.00
WHERE fiber_g IS NULL;
UPDATE food_servings
SET sugar_g = 0.00
WHERE sugar_g IS NULL;
UPDATE food_servings
SET sodium_mg = 0.00
WHERE sodium_mg IS NULL;
UPDATE food_servings
SET calcium_mg = 0.00
WHERE calcium_mg IS NULL;
UPDATE food_servings
SET iron_mg = 0.00
WHERE iron_mg IS NULL;
UPDATE food_servings
SET vitamin_c_mg = 0.00
WHERE vitamin_c_mg IS NULL;
UPDATE food_servings
SET potassium_mg = 0.00
WHERE potassium_mg IS NULL;
UPDATE food_servings
SET vitamin_a_mcg = 0.00
WHERE vitamin_a_mcg IS NULL;
UPDATE food_servings
SET vitamin_e_mg = 0.00
WHERE vitamin_e_mg IS NULL;
UPDATE food_servings
SET vitamin_k_mcg = 0.00
WHERE vitamin_k_mcg IS NULL;
UPDATE food_servings
SET thiamin_mg = 0.00
WHERE thiamin_mg IS NULL;
UPDATE food_servings
SET riboflavin_mg = 0.00
WHERE riboflavin_mg IS NULL;
UPDATE food_servings
SET niacin_mg = 0.00
WHERE niacin_mg IS NULL;
UPDATE food_servings
SET vitamin_b6_mg = 0.00
WHERE vitamin_b6_mg IS NULL;
UPDATE food_servings
SET folate_mcg = 0.00
WHERE folate_mcg IS NULL;
UPDATE food_servings
SET vitamin_b12_mcg = 0.00
WHERE vitamin_b12_mcg IS NULL;
UPDATE food_servings
SET magnesium_mg = 0.00
WHERE magnesium_mg IS NULL;
UPDATE food_servings
SET phosphorus_mg = 0.00
WHERE phosphorus_mg IS NULL;
UPDATE food_servings
SET zinc_mg = 0.00
WHERE zinc_mg IS NULL;
UPDATE food_servings
SET copper_mg = 0.00
WHERE copper_mg IS NULL;
UPDATE food_servings
SET selenium_mcg = 0.00
WHERE selenium_mcg IS NULL;
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