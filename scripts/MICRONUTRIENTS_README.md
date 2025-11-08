# Micronutrient Population Script

This script fetches comprehensive nutrition data from the USDA FoodData Central API and populates the vitamin/mineral columns in the `food_servings` table.

## Prerequisites

1. **USDA API Key** (Free)
   - Sign up at: https://fdc.nal.usda.gov/api-key-signup.html
   - You'll receive an API key via email instantly

2. **Supabase Service Key**
   - Found in Supabase Dashboard → Settings → API → Service Role Key
   - **Warning**: This key bypasses RLS, keep it secret!

## Setup

1. **Add environment variables to `.env.local`**:
   ```env
   USDA_API_KEY=your_usda_api_key_here
   SUPABASE_SERVICE_KEY=your_service_role_key_here
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   npm install dotenv @supabase/supabase-js
   ```

## Usage

Run the script:
```bash
node scripts/populate-micronutrients.js
```

## What It Does

1. **Fetches all foods** from `food_servings` table
2. **Identifies foods** missing micronutrient data (checks if `vitamin_a_mcg` is NULL)
3. **Searches USDA API** for each food by name
4. **Matches foods** to USDA FoodData Central entries
5. **Extracts nutrients**:
   - **Vitamins**: A, C, E, K, B1 (thiamin), B2 (riboflavin), B3 (niacin), B6, B9 (folate), B12
   - **Minerals**: Sodium, Calcium, Iron, Potassium, Magnesium, Phosphorus, Zinc, Copper, Selenium
6. **Updates database** with complete nutrition data

## Expected Output

```
🚀 Micronutrient Population Script

✓ Environment variables validated

📥 Fetching foods from database...
✓ Found 373 foods in database

📊 200 foods need micronutrient data

📦 Processing batch 1/20

🔍 Processing: Chicken Breast, Skinless
   ✓ Found match: Chicken, broiler, meat only, raw (FDC ID: 171116)
   ✓ Extracted 18 nutrients
   ✅ Updated successfully

...

============================================================
📊 Final Statistics:
============================================================
Total foods processed:    200
✅ Successfully updated:  180 (90%)
⚠️  No USDA match found:  15 (7.5%)
❌ Failed:                5 (2.5%)
============================================================

✅ Micronutrient population complete!
```

## Rate Limiting

- **Processes 10 foods per batch**
- **1 second delay between batches**
- **200ms delay between individual items**
- Should take ~5-10 minutes for 373 foods

## Handling Failures

### No USDA Match Found
Some custom/branded foods may not have USDA matches. Options:
1. Manually add data later
2. Use a different API (Nutritionix, EDAMAM)
3. Leave as NULL (feature will work with available data)

### Failed Updates
If updates fail:
1. Check Supabase connection
2. Verify service key has write permissions
3. Check RLS policies on `food_servings` table

## Re-Running the Script

The script is **idempotent** - it only processes foods missing micronutrient data (checks `vitamin_a_mcg IS NULL`). Safe to run multiple times.

## Next Steps

After populating micronutrients:
1. Verify data in Supabase dashboard
2. Build the deficiency analyzer feature
3. Create meal recommendations based on nutrient gaps

## Troubleshooting

### "USDA_API_KEY not set"
- Make sure you created `.env.local` in the project root
- Verify the API key is correct (no spaces/quotes)

### "Rate limit exceeded"
- Increase `DELAY_MS` in the script (line 284)
- Process in smaller batches

### "No matches found for most foods"
- USDA database uses specific naming conventions
- May need to adjust search terms (e.g., "Chicken Breast" vs "Chicken, broiler, breast, meat only")
- Consider adding synonyms/alternative names

## API Limits

USDA FoodData Central:
- **1,000 requests per hour** (free tier)
- **No daily limit**
- If you need more, contact USDA for higher limits

## Support

For issues or questions:
- USDA API Docs: https://fdc.nal.usda.gov/api-guide.html
- USDA Support: https://www.nal.usda.gov/fnic/contact-us
