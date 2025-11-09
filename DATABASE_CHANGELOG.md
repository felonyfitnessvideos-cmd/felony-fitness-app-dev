# Database Changelog

**Purpose**: Track all manual database changes so they can be replicated from Dev → Production

**Workflow**:
1. Make changes in **Dev database** (ytpblkbwgdbiserhrlqm)
2. Document them here
3. When ready to deploy, apply same changes to **Production database** (wkmrdelhoeqhsdifrarn)

---

## [2025-11-08] - Initial Production Deployment

### Schema Deployed
- **File**: `database-backups/production_schema_final.sql`
- **Changes**: Complete schema with all tables, RLS policies, functions, constraints
- **Status**: ✅ Deployed

### Data Needed (Pending)
- [ ] `exercises` table - Export from dev and import to production
- [ ] `foods` table - Export from dev and import to production  
- [ ] `food_servings` table - Export from dev and import to production
- [ ] `muscle_groups` table - Export from dev and import to production

### Edge Functions Deployed
- ✅ All 33 Edge Functions deployed to production via `npx supabase functions deploy`

---

## Template for Future Changes

### [YYYY-MM-DD] - Brief Description

**Changed Tables**:
- `table_name` - What changed (added column, modified constraint, etc.)

**SQL Commands** (to replicate in production):
```sql
-- Your SQL here
```

**Reason**: Why this change was needed

**Status**: ⏳ Pending / ✅ Applied to Production

---

## Notes

- Always test changes in Dev first
- Document SQL before applying to production
- Keep Edge Functions in sync with database schema
- Reference data (exercises, foods) should be exported/imported via SQL
