# Programs System Migration Reference

**Date:** 2025-11-09  
**Migration:** `20251109000000_create_programs_system.sql`

---

## Current Schema (Before Migration)

### `trainer_clients` (7 columns)

```
• id (uuid)
• trainer_id (uuid)
• client_id (uuid)
• status (text)
• notes (text)
• created_at (timestamptz)
• updated_at (timestamptz)
```

### `programs`

- Table exists but is EMPTY (partial migration)
- Needs to be DROPPED and recreated

### `scheduled_routines`

- Table exists but is EMPTY
- Needs new columns added

### `workout_routines` (12 columns)

```
• id (uuid)
• user_id (uuid)
• routine_name (text)
• name (text)
• description (text)
• estimated_duration_minutes (integer)
• routine_type (text)
• is_active (boolean)
• is_public (boolean)
• created_at (timestamptz)
• updated_at (timestamptz)
• difficulty_level (text)
```

---

## New Schema (After Migration)

### `programs` (NEW - 11 columns)

```
• id (uuid) - PRIMARY KEY
• name (text) - NOT NULL
• description (text)
• exercise_pool (jsonb) - DEFAULT '[]'
• difficulty_level (text) - CHECK constraint
• estimated_weeks (integer) - CHECK constraint
• program_type (text) - CHECK constraint
• trainer_id (uuid) - REFERENCES auth.users(id)  ⭐ Changed from created_by
• is_active (boolean) - DEFAULT true
• is_template (boolean) - DEFAULT false
• created_at (timestamptz)
• updated_at (timestamptz)
```

**Indexes:**

- `idx_programs_trainer_id` ⭐ Changed from idx_programs_created_by
- `idx_programs_difficulty`
- `idx_programs_is_active`
- `idx_programs_program_type`
- `idx_programs_is_template`

**RLS Policies:**

- Anyone can view active template programs
- Trainers can view their own programs
- Trainers can create programs
- Trainers can update their own programs
- Trainers can delete their own programs

---

### `trainer_clients` (ENHANCED - 18 columns total)

**Existing 7 columns remain unchanged**

**NEW columns added:**

```
• assigned_program_id (uuid) - REFERENCES programs(id)
• weekly_frequency (integer) - DEFAULT 3, CHECK 1-7
• program_start_date (date)
• program_end_date (date)
• program_status (text) - DEFAULT 'not_started', CHECK constraint
• progress_percentage (integer) - DEFAULT 0, CHECK 0-100
• generated_routine_ids (text[]) - DEFAULT '{}'
• last_workout_date (date)
• total_workouts_completed (integer) - DEFAULT 0
• current_week (integer) - DEFAULT 1
• program_notes (text)
```

**New Indexes:**

- `idx_trainer_clients_assigned_program`
- `idx_trainer_clients_program_status`
- `idx_trainer_clients_program_start_date`

---

### `scheduled_routines` (ENHANCED - adds 7 columns)

**NEW columns added:**

```
• trainer_client_id (uuid) - REFERENCES trainer_clients(id)
• trainer_id (uuid) - REFERENCES auth.users(id)
• client_id (uuid) - REFERENCES auth.users(id)
• source_program_id (uuid) - REFERENCES programs(id)
• google_event_id (text)
• deep_link_url (text)
• reminder_sent (boolean) - DEFAULT false
• status (text) - DEFAULT 'scheduled', CHECK constraint
```

**New Indexes:**

- `idx_scheduled_routines_trainer_client_id`
- `idx_scheduled_routines_trainer_id`
- `idx_scheduled_routines_client_id`
- `idx_scheduled_routines_source_program`
- `idx_scheduled_routines_status`
- `idx_scheduled_routines_reminder_sent` (partial - WHERE reminder_sent = FALSE)

---

## Helper Functions

### `calculate_program_end_date(p_start_date, p_estimated_weeks)`

Calculates program end date based on start date and duration.

### `update_client_program_progress()` (TRIGGER FUNCTION)

Automatically updates `trainer_clients` progress when workouts are completed.

**Trigger:** `update_client_program_progress_trigger`

- Fires AFTER UPDATE OF status ON scheduled_routines
- Only when status changes to 'completed'
- Updates: progress_percentage, total_workouts_completed, last_workout_date

---

## Sample Data

6 template programs inserted:

1. Beginner Strength Foundation (8 weeks)
2. Intermediate Hypertrophy Builder (12 weeks)
3. Advanced Powerlifting Protocol (16 weeks)
4. Endurance Conditioning (8 weeks)
5. Functional Mobility & Flexibility (6 weeks)
6. Active Recovery & Regeneration (4 weeks)

All have empty `exercise_pool` - trainers will populate with exercises.

---

## Key Changes from Original Design

⭐ **Changed `created_by` to `trainer_id`** for consistency with `trainer_clients` table naming convention

⭐ **DROP and recreate `programs` table** instead of `CREATE IF NOT EXISTS` to handle partial migration

All other design elements remain the same!
