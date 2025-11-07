export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      body_metrics: {
        Row: {
          body_fat_percentage: number | null
          created_at: string | null
          id: string
          measurement_date: string | null
          muscle_mass_lbs: number | null
          notes: string | null
          user_id: string | null
          weight_lbs: number | null
        }
        Insert: {
          body_fat_percentage?: number | null
          created_at?: string | null
          id?: string
          measurement_date?: string | null
          muscle_mass_lbs?: number | null
          notes?: string | null
          user_id?: string | null
          weight_lbs?: number | null
        }
        Update: {
          body_fat_percentage?: number | null
          created_at?: string | null
          id?: string
          measurement_date?: string | null
          muscle_mass_lbs?: number | null
          notes?: string | null
          user_id?: string | null
          weight_lbs?: number | null
        }
        Relationships: []
      }
      cycle_sessions: {
        Row: {
          actual_date: string | null
          created_at: string | null
          day_index: number | null
          id: string
          is_complete: boolean | null
          is_deload: boolean | null
          mesocycle_id: string | null
          planned_intensity: number | null
          planned_volume_multiplier: number | null
          routine_id: string | null
          scheduled_date: string
          session_type: string | null
          updated_at: string | null
          user_id: string | null
          week_index: number | null
        }
        Insert: {
          actual_date?: string | null
          created_at?: string | null
          day_index?: number | null
          id?: string
          is_complete?: boolean | null
          is_deload?: boolean | null
          mesocycle_id?: string | null
          planned_intensity?: number | null
          planned_volume_multiplier?: number | null
          routine_id?: string | null
          scheduled_date: string
          session_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          week_index?: number | null
        }
        Update: {
          actual_date?: string | null
          created_at?: string | null
          day_index?: number | null
          id?: string
          is_complete?: boolean | null
          is_deload?: boolean | null
          mesocycle_id?: string | null
          planned_intensity?: number | null
          planned_volume_multiplier?: number | null
          routine_id?: string | null
          scheduled_date?: string
          session_type?: string | null
          updated_at?: string | null
          user_id?: string | null
          week_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cycle_sessions_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_sessions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          message_type: string | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          equipment_needed: string | null
          exercise_type: string | null
          id: string
          instructions: string | null
          name: string
          primary_muscle: string | null
          secondary_muscle: string | null
          tertiary_muscle: string | null
          thumbnail_url: string | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          equipment_needed?: string | null
          exercise_type?: string | null
          id?: string
          instructions?: string | null
          name: string
          primary_muscle?: string | null
          secondary_muscle?: string | null
          tertiary_muscle?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          equipment_needed?: string | null
          exercise_type?: string | null
          id?: string
          instructions?: string | null
          name?: string
          primary_muscle?: string | null
          secondary_muscle?: string | null
          tertiary_muscle?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      food_servings: {
        Row: {
          calcium_mg: number | null
          calories: number | null
          carbs_g: number | null
          copper_mg: number | null
          created_at: string | null
          fat_g: number | null
          fiber_g: number | null
          folate_mcg: number | null
          food_name: string
          id: string
          iron_mg: number | null
          magnesium_mg: number | null
          niacin_mg: number | null
          phosphorus_mg: number | null
          potassium_mg: number | null
          protein_g: number | null
          riboflavin_mg: number | null
          selenium_mcg: number | null
          serving_description: string | null
          sodium_mg: number | null
          sugar_g: number | null
          thiamin_mg: number | null
          updated_at: string | null
          vitamin_a_mcg: number | null
          vitamin_b12_mcg: number | null
          vitamin_b6_mg: number | null
          vitamin_c_mg: number | null
          vitamin_e_mg: number | null
          vitamin_k_mcg: number | null
          zinc_mg: number | null
        }
        Insert: {
          calcium_mg?: number | null
          calories?: number | null
          carbs_g?: number | null
          copper_mg?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          folate_mcg?: number | null
          food_name: string
          id?: string
          iron_mg?: number | null
          magnesium_mg?: number | null
          niacin_mg?: number | null
          phosphorus_mg?: number | null
          potassium_mg?: number | null
          protein_g?: number | null
          riboflavin_mg?: number | null
          selenium_mcg?: number | null
          serving_description?: string | null
          sodium_mg?: number | null
          sugar_g?: number | null
          thiamin_mg?: number | null
          updated_at?: string | null
          vitamin_a_mcg?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_b6_mg?: number | null
          vitamin_c_mg?: number | null
          vitamin_e_mg?: number | null
          vitamin_k_mcg?: number | null
          zinc_mg?: number | null
        }
        Update: {
          calcium_mg?: number | null
          calories?: number | null
          carbs_g?: number | null
          copper_mg?: number | null
          created_at?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          folate_mcg?: number | null
          food_name?: string
          id?: string
          iron_mg?: number | null
          magnesium_mg?: number | null
          niacin_mg?: number | null
          phosphorus_mg?: number | null
          potassium_mg?: number | null
          protein_g?: number | null
          riboflavin_mg?: number | null
          selenium_mcg?: number | null
          serving_description?: string | null
          sodium_mg?: number | null
          sugar_g?: number | null
          thiamin_mg?: number | null
          updated_at?: string | null
          vitamin_a_mcg?: number | null
          vitamin_b12_mcg?: number | null
          vitamin_b6_mg?: number | null
          vitamin_c_mg?: number | null
          vitamin_e_mg?: number | null
          vitamin_k_mcg?: number | null
          zinc_mg?: number | null
        }
        Relationships: []
      }
      foods: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string | null
          data_sources: string | null
          enrichment_status: string | null
          id: string
          last_enrichment: string | null
          name: string
          quality_score: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          data_sources?: string | null
          enrichment_status?: string | null
          id?: string
          last_enrichment?: string | null
          name: string
          quality_score?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string | null
          data_sources?: string | null
          enrichment_status?: string | null
          id?: string
          last_enrichment?: string | null
          name?: string
          quality_score?: number | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string | null
          current_value: number | null
          goal_description: string | null
          id: string
          isWeightGoal: boolean | null
          notes: string | null
          status: string | null
          target_date: string | null
          target_value: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          goal_description?: string | null
          id?: string
          isWeightGoal?: boolean | null
          notes?: string | null
          status?: string | null
          target_date?: string | null
          target_value?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          goal_description?: string | null
          id?: string
          isWeightGoal?: boolean | null
          notes?: string | null
          status?: string | null
          target_date?: string | null
          target_value?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meal_foods: {
        Row: {
          created_at: string | null
          food_serving_id: string | null
          id: string
          meal_id: string | null
          notes: string | null
          quantity: number
        }
        Insert: {
          created_at?: string | null
          food_serving_id?: string | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string | null
          food_serving_id?: string | null
          id?: string
          meal_id?: string | null
          notes?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "meal_foods_food_serving_id_fkey"
            columns: ["food_serving_id"]
            isOneToOne: false
            referencedRelation: "food_servings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_foods_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          category: string | null
          cook_time_minutes: number | null
          created_at: string | null
          description: string | null
          difficulty_level: number | null
          id: string
          image_url: string | null
          instructions: string | null
          is_favorite: boolean | null
          is_public: boolean | null
          name: string
          prep_time_minutes: number | null
          serving_size: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          cook_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_favorite?: boolean | null
          is_public?: boolean | null
          name: string
          prep_time_minutes?: number | null
          serving_size?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          cook_time_minutes?: number | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_favorite?: boolean | null
          is_public?: boolean | null
          name?: string
          prep_time_minutes?: number | null
          serving_size?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mesocycle_weeks: {
        Row: {
          created_at: string | null
          day_index: number | null
          deload: boolean | null
          id: string
          mesocycle_id: string | null
          notes: string | null
          routine_id: string | null
          session_order: number | null
          week_index: number | null
        }
        Insert: {
          created_at?: string | null
          day_index?: number | null
          deload?: boolean | null
          id?: string
          mesocycle_id?: string | null
          notes?: string | null
          routine_id?: string | null
          session_order?: number | null
          week_index?: number | null
        }
        Update: {
          created_at?: string | null
          day_index?: number | null
          deload?: boolean | null
          id?: string
          mesocycle_id?: string | null
          notes?: string | null
          routine_id?: string | null
          session_order?: number | null
          week_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mesocycle_weeks_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mesocycle_weeks_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      mesocycles: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          focus: string | null
          id: string
          is_active: boolean | null
          is_complete: boolean | null
          name: string
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          weeks: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          focus?: string | null
          id?: string
          is_active?: boolean | null
          is_complete?: boolean | null
          name: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          weeks?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          focus?: string | null
          id?: string
          is_active?: boolean | null
          is_complete?: boolean | null
          name?: string
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          weeks?: number | null
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          primary_muscle: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          primary_muscle?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          primary_muscle?: string | null
        }
        Relationships: []
      }
      nutrition_enrichment_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          food_id: string | null
          food_name: string | null
          id: string
          priority: number | null
          processed_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          food_id?: string | null
          food_name?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          food_id?: string | null
          food_name?: string | null
          id?: string
          priority?: number | null
          processed_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      nutrition_logs: {
        Row: {
          created_at: string | null
          food_serving_id: string | null
          id: string
          log_date: string | null
          meal_type: string | null
          notes: string | null
          quantity_consumed: number | null
          user_id: string | null
          water_oz_consumed: number | null
        }
        Insert: {
          created_at?: string | null
          food_serving_id?: string | null
          id?: string
          log_date?: string | null
          meal_type?: string | null
          notes?: string | null
          quantity_consumed?: number | null
          user_id?: string | null
          water_oz_consumed?: number | null
        }
        Update: {
          created_at?: string | null
          food_serving_id?: string | null
          id?: string
          log_date?: string | null
          meal_type?: string | null
          notes?: string | null
          quantity_consumed?: number | null
          user_id?: string | null
          water_oz_consumed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_logs_food_serving_id_fkey"
            columns: ["food_serving_id"]
            isOneToOne: false
            referencedRelation: "food_servings"
            referencedColumns: ["id"]
          },
        ]
      }
      nutrition_pipeline_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          foods_processed: number | null
          foods_total: number | null
          id: string
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          foods_processed?: number | null
          foods_total?: number | null
          id?: string
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          foods_processed?: number | null
          foods_total?: number | null
          id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          id: number
          plan_name: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          plan_name?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          plan_name?: string | null
        }
        Relationships: []
      }
      pro_routines: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string | null
          routine_name: string | null
          routine_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string | null
          routine_name?: string | null
          routine_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string | null
          routine_name?: string | null
          routine_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      routine_exercises: {
        Row: {
          created_at: string | null
          exercise_id: string | null
          exercise_order: number
          id: string
          notes: string | null
          reps: string | null
          rest_seconds: number | null
          routine_id: string | null
          sets: number | null
          target_sets: number
          weight_kg: number | null
        }
        Insert: {
          created_at?: string | null
          exercise_id?: string | null
          exercise_order?: number
          id?: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          routine_id?: string | null
          sets?: number | null
          target_sets?: number
          weight_kg?: number | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string | null
          exercise_order?: number
          id?: string
          notes?: string | null
          reps?: string | null
          rest_seconds?: number | null
          routine_id?: string | null
          sets?: number | null
          target_sets?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_exercises_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_routines: {
        Row: {
          created_at: string | null
          id: string
          routine_id: string | null
          scheduled_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          routine_id?: string | null
          scheduled_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          routine_id?: string | null
          scheduled_date?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_routines_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      trainer_clients: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          status: string | null
          trainer_id: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          status?: string | null
          trainer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_meals: {
        Row: {
          created_at: string | null
          id: string
          is_favorite: boolean | null
          meal_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          meal_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          meal_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_meals_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          activity_level: string | null
          address: string | null
          city: string | null
          created_at: string | null
          current_weight_lbs: number | null
          daily_calorie_goal: number | null
          daily_carb_goal: number | null
          daily_carb_goal_g: number | null
          daily_fat_goal: number | null
          daily_fat_goal_g: number | null
          daily_protein_goal: number | null
          daily_protein_goal_g: number | null
          daily_water_goal: number | null
          daily_water_goal_oz: number | null
          date_of_birth: string | null
          diet_preference: string | null
          email: string | null
          first_name: string | null
          fitness_goal: string | null
          height_cm: number | null
          id: string
          is_admin: boolean | null
          is_client: boolean | null
          is_trainer: boolean | null
          last_name: string | null
          phone: string | null
          plan_type: number | null
          sex: string | null
          state: string | null
          target_weight_lbs: number | null
          theme: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          activity_level?: string | null
          address?: string | null
          city?: string | null
          created_at?: string | null
          current_weight_lbs?: number | null
          daily_calorie_goal?: number | null
          daily_carb_goal?: number | null
          daily_carb_goal_g?: number | null
          daily_fat_goal?: number | null
          daily_fat_goal_g?: number | null
          daily_protein_goal?: number | null
          daily_protein_goal_g?: number | null
          daily_water_goal?: number | null
          daily_water_goal_oz?: number | null
          date_of_birth?: string | null
          diet_preference?: string | null
          email?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          height_cm?: number | null
          id: string
          is_admin?: boolean | null
          is_client?: boolean | null
          is_trainer?: boolean | null
          last_name?: string | null
          phone?: string | null
          plan_type?: number | null
          sex?: string | null
          state?: string | null
          target_weight_lbs?: number | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          activity_level?: string | null
          address?: string | null
          city?: string | null
          created_at?: string | null
          current_weight_lbs?: number | null
          daily_calorie_goal?: number | null
          daily_carb_goal?: number | null
          daily_carb_goal_g?: number | null
          daily_fat_goal?: number | null
          daily_fat_goal_g?: number | null
          daily_protein_goal?: number | null
          daily_protein_goal_g?: number | null
          daily_water_goal?: number | null
          daily_water_goal_oz?: number | null
          date_of_birth?: string | null
          diet_preference?: string | null
          email?: string | null
          first_name?: string | null
          fitness_goal?: string | null
          height_cm?: number | null
          id?: string
          is_admin?: boolean | null
          is_client?: boolean | null
          is_trainer?: boolean | null
          last_name?: string | null
          phone?: string | null
          plan_type?: number | null
          sex?: string | null
          state?: string | null
          target_weight_lbs?: number | null
          theme?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_plan_type_fkey"
            columns: ["plan_type"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tags: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          tag_id: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          tag_id?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          tag_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          user_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          user_email?: string | null
        }
        Relationships: []
      }
      workout_log_entries: {
        Row: {
          completed: boolean | null
          created_at: string | null
          distance_meters: number | null
          duration_seconds: number | null
          exercise_id: string | null
          id: string
          log_id: string | null
          notes: string | null
          reps: number | null
          reps_completed: number | null
          rpe_rating: number | null
          set_number: number
          weight_lbs: number | null
          weight_lifted_kg: number | null
          workout_log_id: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          id?: string
          log_id?: string | null
          notes?: string | null
          reps?: number | null
          reps_completed?: number | null
          rpe_rating?: number | null
          set_number: number
          weight_lbs?: number | null
          weight_lifted_kg?: number | null
          workout_log_id?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          distance_meters?: number | null
          duration_seconds?: number | null
          exercise_id?: string | null
          id?: string
          log_id?: string | null
          notes?: string | null
          reps?: number | null
          reps_completed?: number | null
          rpe_rating?: number | null
          set_number?: number
          weight_lbs?: number | null
          weight_lifted_kg?: number | null
          workout_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_log_entries_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_log_entries_workout_log_id_fkey"
            columns: ["workout_log_id"]
            isOneToOne: false
            referencedRelation: "workout_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_logs: {
        Row: {
          calories_burned: number | null
          created_at: string | null
          cycle_session_id: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_complete: boolean | null
          log_date: string
          mood_rating: number | null
          notes: string | null
          routine_id: string | null
          started_at: string | null
          total_reps: number | null
          total_volume_kg: number | null
          user_id: string | null
          workout_name: string | null
        }
        Insert: {
          calories_burned?: number | null
          created_at?: string | null
          cycle_session_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_complete?: boolean | null
          log_date?: string
          mood_rating?: number | null
          notes?: string | null
          routine_id?: string | null
          started_at?: string | null
          total_reps?: number | null
          total_volume_kg?: number | null
          user_id?: string | null
          workout_name?: string | null
        }
        Update: {
          calories_burned?: number | null
          created_at?: string | null
          cycle_session_id?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_complete?: boolean | null
          log_date?: string
          mood_rating?: number | null
          notes?: string | null
          routine_id?: string | null
          started_at?: string | null
          total_reps?: number | null
          total_volume_kg?: number | null
          user_id?: string | null
          workout_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_logs_cycle_session_id_fkey"
            columns: ["cycle_session_id"]
            isOneToOne: false
            referencedRelation: "cycle_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_logs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "workout_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_routines: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty_level: string | null
          estimated_duration_minutes: number | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          name: string | null
          routine_name: string
          routine_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string | null
          routine_name: string
          routine_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty_level?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          name?: string | null
          routine_name?: string
          routine_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_conversations: {
        Args: never
        Returns: {
          conversation_user_id: string
          conversation_user_name: string
          is_trainer: boolean
          last_message: string
          last_message_time: string
          unread_count: number
        }[]
      }
      get_enrichment_status: {
        Args: never
        Returns: {
          enriched_foods: number
          enrichment_percentage: number
          failed_foods: number
          pending_foods: number
          total_foods: number
        }[]
      }
      get_quality_distribution: {
        Args: never
        Returns: {
          food_count: number
          percentage: number
          quality_level: string
        }[]
      }
      get_random_tip: {
        Args: never
        Returns: {
          category: string
          tip: string
        }[]
      }
      get_user_tags: {
        Args: { target_user_id?: string }
        Returns: {
          assigned_at: string
          assigned_by: string
          tag_color: string
          tag_description: string
          tag_id: string
          tag_name: string
        }[]
      }
      log_food_item: {
        Args: {
          p_external_food?: Json
          p_food_serving_id?: string
          p_log_date?: string
          p_meal_type?: string
          p_quantity_consumed?: number
          p_user_id?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
