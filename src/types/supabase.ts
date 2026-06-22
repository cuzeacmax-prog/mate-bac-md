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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_feedback: {
        Row: {
          admin_id: string | null
          created_at: string | null
          id: string
          ideal_response: string | null
          message_id: string | null
          notes: string | null
          rating: string
          status: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          ideal_response?: string | null
          message_id?: string | null
          notes?: string | null
          rating: string
          status?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string | null
          id?: string
          ideal_response?: string | null
          message_id?: string | null
          notes?: string | null
          rating?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_feedback_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_config: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          fallback_task_name: string | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          model_name: string
          price_input_per_1m: number
          price_output_per_1m: number
          provider: string
          system_prompt_key: string | null
          task_name: string
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          fallback_task_name?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model_name: string
          price_input_per_1m?: number
          price_output_per_1m?: number
          provider: string
          system_prompt_key?: string | null
          task_name: string
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          fallback_task_name?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          model_name?: string
          price_input_per_1m?: number
          price_output_per_1m?: number
          provider?: string
          system_prompt_key?: string | null
          task_name?: string
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_config_fallback_task_name_fkey"
            columns: ["fallback_task_name"]
            isOneToOne: false
            referencedRelation: "ai_model_config"
            referencedColumns: ["task_name"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: number
          properties: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: number
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: number
          properties?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_log: {
        Row: {
          cached_input_tokens: number | null
          cost_usd: number | null
          created_at: string | null
          endpoint: string | null
          id: string
          latency_ms_total: number | null
          latency_ms_ttfb: number | null
          model: string | null
          task_name: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          cached_input_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          latency_ms_total?: number | null
          latency_ms_ttfb?: number | null
          model?: string | null
          task_name?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          cached_input_tokens?: number | null
          cost_usd?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          latency_ms_total?: number | null
          latency_ms_ttfb?: number | null
          model?: string | null
          task_name?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bac_simulations: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          estimated_grade: number | null
          exercises: Json | null
          feedback: string | null
          final_score: number | null
          id: string
          profile_type: string | null
          solutions: Json | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          estimated_grade?: number | null
          exercises?: Json | null
          feedback?: string | null
          final_score?: number | null
          id?: string
          profile_type?: string | null
          solutions?: Json | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          estimated_grade?: number | null
          exercises?: Json | null
          feedback?: string | null
          final_score?: number | null
          id?: string
          profile_type?: string | null
          solutions?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bac_simulations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_interactions: {
        Row: {
          ai_response: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_minimized: boolean | null
          mode: string | null
          parent_message_id: string | null
          selected_step_id: string | null
          selected_text: string
          updated_at: string | null
          user_id: string | null
          user_question: string
        }
        Insert: {
          ai_response?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_minimized?: boolean | null
          mode?: string | null
          parent_message_id?: string | null
          selected_step_id?: string | null
          selected_text: string
          updated_at?: string | null
          user_id?: string | null
          user_question: string
        }
        Update: {
          ai_response?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_minimized?: boolean | null
          mode?: string | null
          parent_message_id?: string | null
          selected_step_id?: string | null
          selected_text?: string
          updated_at?: string | null
          user_id?: string | null
          user_question?: string
        }
        Relationships: []
      }
      concept_construction_pattern: {
        Row: {
          concept: string | null
          concept_id: string | null
          created_at: string | null
          derived_from: string | null
          drafted_by: string | null
          human_status: string | null
          id: string
          kind: string | null
          marked: boolean | null
          pattern: Json | null
          title: string | null
          trigger_type: string | null
        }
        Insert: {
          concept?: string | null
          concept_id?: string | null
          created_at?: string | null
          derived_from?: string | null
          drafted_by?: string | null
          human_status?: string | null
          id?: string
          kind?: string | null
          marked?: boolean | null
          pattern?: Json | null
          title?: string | null
          trigger_type?: string | null
        }
        Update: {
          concept?: string | null
          concept_id?: string | null
          created_at?: string | null
          derived_from?: string | null
          drafted_by?: string | null
          human_status?: string | null
          id?: string
          kind?: string | null
          marked?: boolean | null
          pattern?: Json | null
          title?: string | null
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_construction_pattern_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_content_proposals: {
        Row: {
          concept_id: string
          conditii: string | null
          confidence: string | null
          created_at: string | null
          definitie: string | null
          exemplu: string | null
          formule_latex: Json
          id: string
          note: string | null
          source_pages: number[] | null
        }
        Insert: {
          concept_id: string
          conditii?: string | null
          confidence?: string | null
          created_at?: string | null
          definitie?: string | null
          exemplu?: string | null
          formule_latex?: Json
          id?: string
          note?: string | null
          source_pages?: number[] | null
        }
        Update: {
          concept_id?: string
          conditii?: string | null
          confidence?: string | null
          created_at?: string | null
          definitie?: string | null
          exemplu?: string | null
          formule_latex?: Json
          id?: string
          note?: string | null
          source_pages?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "concept_content_proposals_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_dedup_proposals: {
        Row: {
          canonical_name: string
          confidence: string | null
          created_at: string | null
          grade: number
          id: string
          kind: string | null
          min_pdf_page: number | null
          note: string | null
          raw_names: Json
          sub_points: Json
          variant_count: number
        }
        Insert: {
          canonical_name: string
          confidence?: string | null
          created_at?: string | null
          grade: number
          id?: string
          kind?: string | null
          min_pdf_page?: number | null
          note?: string | null
          raw_names?: Json
          sub_points?: Json
          variant_count?: number
        }
        Update: {
          canonical_name?: string
          confidence?: string | null
          created_at?: string | null
          grade?: number
          id?: string
          kind?: string | null
          min_pdf_page?: number | null
          note?: string | null
          raw_names?: Json
          sub_points?: Json
          variant_count?: number
        }
        Relationships: []
      }
      concept_edge_proposals: {
        Row: {
          confidence: string | null
          created_at: string | null
          from_concept: string
          id: string
          note: string | null
          relation: string
          to_concept: string
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          from_concept: string
          id?: string
          note?: string | null
          relation?: string
          to_concept: string
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          from_concept?: string
          id?: string
          note?: string | null
          relation?: string
          to_concept?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_edge_proposals_from_concept_fkey"
            columns: ["from_concept"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_edge_proposals_to_concept_fkey"
            columns: ["to_concept"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_edges: {
        Row: {
          from_concept: string
          id: string
          relation: string
          to_concept: string
        }
        Insert: {
          from_concept: string
          id?: string
          relation: string
          to_concept: string
        }
        Update: {
          from_concept?: string
          id?: string
          relation?: string
          to_concept?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_edges_from_concept_fkey"
            columns: ["from_concept"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "concept_edges_to_concept_fkey"
            columns: ["to_concept"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_family_membership: {
        Row: {
          concept_id: string
          created_by: string
          module: string
          root_slug: string
        }
        Insert: {
          concept_id: string
          created_by?: string
          module: string
          root_slug: string
        }
        Update: {
          concept_id?: string
          created_by?: string
          module?: string
          root_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_family_membership_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concept_inventory_raw: {
        Row: {
          created_at: string | null
          first_seen_pdf_page: number | null
          grade: number
          id: string
          module: string | null
          name: string
          occurrences: number | null
          subtopic: string | null
        }
        Insert: {
          created_at?: string | null
          first_seen_pdf_page?: number | null
          grade: number
          id?: string
          module?: string | null
          name: string
          occurrences?: number | null
          subtopic?: string | null
        }
        Update: {
          created_at?: string | null
          first_seen_pdf_page?: number | null
          grade?: number
          id?: string
          module?: string | null
          name?: string
          occurrences?: number | null
          subtopic?: string | null
        }
        Relationships: []
      }
      concept_mastery: {
        Row: {
          concept_id: string
          evidence_count: number
          last_evidence_at: string | null
          mastery: number
          source: string[]
          user_id: string
        }
        Insert: {
          concept_id: string
          evidence_count?: number
          last_evidence_at?: string | null
          mastery?: number
          source?: string[]
          user_id: string
        }
        Update: {
          concept_id?: string
          evidence_count?: number
          last_evidence_at?: string | null
          mastery?: number
          source?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "concept_mastery_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      concepts: {
        Row: {
          body: string | null
          content_origin: string | null
          created_at: string | null
          embedding: string | null
          grade_level: number
          id: string
          kind: string
          module: string | null
          name: string
          needs_reextraction: boolean
          notation: Json | null
          order_in_grade: number
          slug: string
          status: string
          sub_points: Json
          subtopic: string | null
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          content_origin?: string | null
          created_at?: string | null
          embedding?: string | null
          grade_level: number
          id?: string
          kind: string
          module?: string | null
          name: string
          needs_reextraction?: boolean
          notation?: Json | null
          order_in_grade: number
          slug: string
          status?: string
          sub_points?: Json
          subtopic?: string | null
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          content_origin?: string | null
          created_at?: string | null
          embedding?: string | null
          grade_level?: number
          id?: string
          kind?: string
          module?: string | null
          name?: string
          needs_reextraction?: boolean
          notation?: Json | null
          order_in_grade?: number
          slug?: string
          status?: string
          sub_points?: Json
          subtopic?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          summary: string | null
          summary_through: number
          title: string | null
          topic: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          summary?: string | null
          summary_through?: number
          title?: string | null
          topic?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          summary?: string | null
          summary_through?: number
          title?: string | null
          topic?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          description: string | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          course_id: string
          description?: string | null
          id?: string
          name: string
          order_index: number
        }
        Update: {
          course_id?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          grade: string | null
          id: string
          name: string
          price_monthly: number | null
          profile_type: string | null
          slug: string
          subject: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name: string
          price_monthly?: number | null
          profile_type?: string | null
          slug: string
          subject?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          grade?: string | null
          id?: string
          name?: string
          price_monthly?: number | null
          profile_type?: string | null
          slug?: string
          subject?: string | null
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          actual_minutes: number | null
          challenge_date: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          estimated_minutes: number | null
          exercises: Json
          exercises_completed: number | null
          exercises_correct: number | null
          id: string
          user_id: string | null
        }
        Insert: {
          actual_minutes?: number | null
          challenge_date: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          estimated_minutes?: number | null
          exercises: Json
          exercises_completed?: number | null
          exercises_correct?: number | null
          id?: string
          user_id?: string | null
        }
        Update: {
          actual_minutes?: number | null
          challenge_date?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          estimated_minutes?: number | null
          exercises?: Json
          exercises_completed?: number | null
          exercises_correct?: number | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_exercises: {
        Row: {
          converted_etapa70: string | null
          correct_answer: string
          correct_letter: string
          created_at: string | null
          difficulty: number | null
          distractors: Json
          explanation: string | null
          grade_level: number
          id: string
          original_etapa70: Json | null
          prompt: string
          source_scenario_id: string | null
          topic_id: string
        }
        Insert: {
          converted_etapa70?: string | null
          correct_answer: string
          correct_letter: string
          created_at?: string | null
          difficulty?: number | null
          distractors: Json
          explanation?: string | null
          grade_level: number
          id?: string
          original_etapa70?: Json | null
          prompt: string
          source_scenario_id?: string | null
          topic_id: string
        }
        Update: {
          converted_etapa70?: string | null
          correct_answer?: string
          correct_letter?: string
          created_at?: string | null
          difficulty?: number | null
          distractors?: Json
          explanation?: string | null
          grade_level?: number
          id?: string
          original_etapa70?: Json | null
          prompt?: string
          source_scenario_id?: string | null
          topic_id?: string
        }
        Relationships: []
      }
      diagnostic_sessions: {
        Row: {
          completed_at: string | null
          correct_count: number | null
          exercises_log: Json | null
          final_difficulty: number | null
          grade_level: number
          id: string
          initial_bac_prediction: number | null
          started_at: string | null
          target_bac_score: number | null
          topics_covered: string[] | null
          total_questions: number | null
          user_id: string | null
          weaknesses: string[] | null
        }
        Insert: {
          completed_at?: string | null
          correct_count?: number | null
          exercises_log?: Json | null
          final_difficulty?: number | null
          grade_level: number
          id?: string
          initial_bac_prediction?: number | null
          started_at?: string | null
          target_bac_score?: number | null
          topics_covered?: string[] | null
          total_questions?: number | null
          user_id?: string | null
          weaknesses?: string[] | null
        }
        Update: {
          completed_at?: string | null
          correct_count?: number | null
          exercises_log?: Json | null
          final_difficulty?: number | null
          grade_level?: number
          id?: string
          initial_bac_prediction?: number | null
          started_at?: string | null
          target_bac_score?: number | null
          topics_covered?: string[] | null
          total_questions?: number | null
          user_id?: string | null
          weaknesses?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          course_id: string | null
          created_at: string | null
          difficulty: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          module_id: string | null
          source_profile: string | null
          source_type: string | null
          source_year: number | null
          subtopic: string | null
          topic: string | null
        }
        Insert: {
          content?: string | null
          course_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          module_id?: string | null
          source_profile?: string | null
          source_type?: string | null
          source_year?: number | null
          subtopic?: string | null
          topic?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string | null
          created_at?: string | null
          difficulty?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          module_id?: string | null
          source_profile?: string | null
          source_type?: string | null
          source_year?: number | null
          subtopic?: string | null
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_list: {
        Row: {
          converted_user_id: string | null
          email: string
          id: string
          metadata: Json | null
          signed_up_at: string | null
          source: string | null
          unsubscribed: boolean | null
        }
        Insert: {
          converted_user_id?: string | null
          email: string
          id?: string
          metadata?: Json | null
          signed_up_at?: string | null
          source?: string | null
          unsubscribed?: boolean | null
        }
        Update: {
          converted_user_id?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          signed_up_at?: string | null
          source?: string | null
          unsubscribed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "email_list_converted_user_id_fkey"
            columns: ["converted_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_answer_link: {
        Row: {
          answer_id: string
          created_at: string | null
          exercise_id: string
          id: string
          match_confidence: string | null
          subpart: string | null
        }
        Insert: {
          answer_id: string
          created_at?: string | null
          exercise_id: string
          id?: string
          match_confidence?: string | null
          subpart?: string | null
        }
        Update: {
          answer_id?: string
          created_at?: string | null
          exercise_id?: string
          id?: string
          match_confidence?: string | null
          subpart?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_answer_link_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "exercise_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_answer_link_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_answer_link_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercise_answers: {
        Row: {
          answer_text: string | null
          confidence: string | null
          created_at: string | null
          id: string
          pdf_page: number | null
          problem_number: string | null
          source: string | null
          test_or_section: string | null
        }
        Insert: {
          answer_text?: string | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          pdf_page?: number | null
          problem_number?: string | null
          source?: string | null
          test_or_section?: string | null
        }
        Update: {
          answer_text?: string | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          pdf_page?: number | null
          problem_number?: string | null
          source?: string | null
          test_or_section?: string | null
        }
        Relationships: []
      }
      exercise_attempts: {
        Row: {
          attempted_at: string | null
          correct_answer: string | null
          difficulty: number | null
          exercise_id: string | null
          hints_used: number | null
          id: string
          is_correct: boolean | null
          metadata: Json | null
          session_type: string | null
          time_spent_seconds: number | null
          topic_id: string | null
          user_answer: string | null
          user_id: string | null
        }
        Insert: {
          attempted_at?: string | null
          correct_answer?: string | null
          difficulty?: number | null
          exercise_id?: string | null
          hints_used?: number | null
          id?: string
          is_correct?: boolean | null
          metadata?: Json | null
          session_type?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_answer?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_at?: string | null
          correct_answer?: string | null
          difficulty?: number | null
          exercise_id?: string | null
          hints_used?: number | null
          id?: string
          is_correct?: boolean | null
          metadata?: Json | null
          session_type?: string | null
          time_spent_seconds?: number | null
          topic_id?: string | null
          user_answer?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_concept_link: {
        Row: {
          concept_id: string
          created_at: string
          created_by: string
          exercise_id: string
          id: string
          module_ok: boolean
          rank: number
          similarity: number
        }
        Insert: {
          concept_id: string
          created_at?: string
          created_by?: string
          exercise_id: string
          id?: string
          module_ok?: boolean
          rank: number
          similarity: number
        }
        Update: {
          concept_id?: string
          created_at?: string
          created_by?: string
          exercise_id?: string
          id?: string
          module_ok?: boolean
          rank?: number
          similarity?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_concept_link_concept_id_fkey1"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_concept_link_exercise_id_fkey1"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_concept_link_exercise_id_fkey1"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercise_concept_link_legacy: {
        Row: {
          concept_id: string
          created_at: string | null
          exercise_id: string
          id: string
          method: string | null
          rank: number | null
          similarity: number | null
        }
        Insert: {
          concept_id: string
          created_at?: string | null
          exercise_id: string
          id?: string
          method?: string | null
          rank?: number | null
          similarity?: number | null
        }
        Update: {
          concept_id?: string
          created_at?: string | null
          exercise_id?: string
          id?: string
          method?: string | null
          rank?: number | null
          similarity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_concept_link_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_concept_link_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_concept_link_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercise_concepts: {
        Row: {
          concept_id: string
          exercise_id: string
        }
        Insert: {
          concept_id: string
          exercise_id: string
        }
        Update: {
          concept_id?: string
          exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_concepts_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_concepts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_figure_spec: {
        Row: {
          classifier_verdict: string | null
          created_at: string | null
          exercise_id: string
          human_status: string | null
          id: string
          spec: Json | null
          valid: boolean | null
          validation_error: string | null
        }
        Insert: {
          classifier_verdict?: string | null
          created_at?: string | null
          exercise_id: string
          human_status?: string | null
          id?: string
          spec?: Json | null
          valid?: boolean | null
          validation_error?: string | null
        }
        Update: {
          classifier_verdict?: string | null
          created_at?: string | null
          exercise_id?: string
          human_status?: string | null
          id?: string
          spec?: Json | null
          valid?: boolean | null
          validation_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_figure_spec_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_figure_spec_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercise_raw: {
        Row: {
          confidence: string | null
          created_at: string | null
          exercise_number: string | null
          given_answer: string | null
          has_figure: boolean | null
          id: string
          module: string | null
          pdf_page: number | null
          section: string | null
          source: string | null
          statement: string | null
          subparts: Json
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          exercise_number?: string | null
          given_answer?: string | null
          has_figure?: boolean | null
          id?: string
          module?: string | null
          pdf_page?: number | null
          section?: string | null
          source?: string | null
          statement?: string | null
          subparts?: Json
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          exercise_number?: string | null
          given_answer?: string | null
          has_figure?: boolean | null
          id?: string
          module?: string | null
          pdf_page?: number | null
          section?: string | null
          source?: string | null
          statement?: string | null
          subparts?: Json
        }
        Relationships: []
      }
      exercise_verification: {
        Row: {
          computed_latex: string | null
          created_at: string | null
          exercise_id: string
          human_note: string | null
          human_status: string | null
          id: string
          method: string | null
          note: string | null
          subpart: string | null
          verified: boolean | null
        }
        Insert: {
          computed_latex?: string | null
          created_at?: string | null
          exercise_id: string
          human_note?: string | null
          human_status?: string | null
          id?: string
          method?: string | null
          note?: string | null
          subpart?: string | null
          verified?: boolean | null
        }
        Update: {
          computed_latex?: string | null
          created_at?: string | null
          exercise_id?: string
          human_note?: string | null
          human_status?: string | null
          id?: string
          method?: string | null
          note?: string | null
          subpart?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_verification_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_verification_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      exercises: {
        Row: {
          answer: string | null
          created_at: string | null
          difficulty: number | null
          embedding: string | null
          grade_level: number | null
          id: string
          solution: string | null
          source: string | null
          statement: string
          status: string
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          difficulty?: number | null
          embedding?: string | null
          grade_level?: number | null
          id?: string
          solution?: string | null
          source?: string | null
          statement: string
          status?: string
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          difficulty?: number | null
          embedding?: string | null
          grade_level?: number | null
          id?: string
          solution?: string | null
          source?: string | null
          statement?: string
          status?: string
        }
        Relationships: []
      }
      figura_autor: {
        Row: {
          condition: string
          created_at: string | null
          desired_kind: string | null
          desired_ref: string | null
          exercise_id: string | null
          gates: Json | null
          id: string
          input_kind: string | null
          iteratii: number | null
          remarci: Json | null
          render_png: string | null
          slug: string | null
          spec_generat: Json | null
          status: string | null
          updated_at: string | null
          verdict_uman: string | null
        }
        Insert: {
          condition: string
          created_at?: string | null
          desired_kind?: string | null
          desired_ref?: string | null
          exercise_id?: string | null
          gates?: Json | null
          id?: string
          input_kind?: string | null
          iteratii?: number | null
          remarci?: Json | null
          render_png?: string | null
          slug?: string | null
          spec_generat?: Json | null
          status?: string | null
          updated_at?: string | null
          verdict_uman?: string | null
        }
        Update: {
          condition?: string
          created_at?: string | null
          desired_kind?: string | null
          desired_ref?: string | null
          exercise_id?: string | null
          gates?: Json | null
          id?: string
          input_kind?: string | null
          iteratii?: number | null
          remarci?: Json | null
          render_png?: string | null
          slug?: string | null
          spec_generat?: Json | null
          status?: string | null
          updated_at?: string | null
          verdict_uman?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "figura_autor_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "figura_autor_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercise_servable"
            referencedColumns: ["exercise_id"]
          },
        ]
      }
      gap_analysis: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          detected_subtopic: string | null
          detected_topic: string | null
          id: string
          max_similarity_found: number | null
          query: string
          query_embedding: string | null
          resolved: boolean | null
          resolved_with_exercise_id: string | null
          top_match_id: string | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          detected_subtopic?: string | null
          detected_topic?: string | null
          id?: string
          max_similarity_found?: number | null
          query: string
          query_embedding?: string | null
          resolved?: boolean | null
          resolved_with_exercise_id?: string | null
          top_match_id?: string | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          detected_subtopic?: string | null
          detected_topic?: string | null
          id?: string
          max_similarity_found?: number | null
          query?: string
          query_embedding?: string | null
          resolved?: boolean | null
          resolved_with_exercise_id?: string | null
          top_match_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gap_analysis_resolved_with_exercise_id_fkey"
            columns: ["resolved_with_exercise_id"]
            isOneToOne: false
            referencedRelation: "solved_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gap_analysis_top_match_id_fkey"
            columns: ["top_match_id"]
            isOneToOne: false
            referencedRelation: "solved_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      katex_error_report: {
        Row: {
          concept_id: string | null
          concept_name: string | null
          created_at: string | null
          error: string | null
          grade_level: number | null
          id: string
          raw: string | null
          source: string | null
        }
        Insert: {
          concept_id?: string | null
          concept_name?: string | null
          created_at?: string | null
          error?: string | null
          grade_level?: number | null
          id?: string
          raw?: string | null
          source?: string | null
        }
        Update: {
          concept_id?: string | null
          concept_name?: string | null
          created_at?: string | null
          error?: string | null
          grade_level?: number | null
          id?: string
          raw?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "katex_error_report_concept_id_fkey"
            columns: ["concept_id"]
            isOneToOne: false
            referencedRelation: "concepts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          has_image: boolean | null
          id: string
          image_url: string | null
          role: string
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          role: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          has_image?: boolean | null
          id?: string
          image_url?: string | null
          role?: string
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_bac_attempts: {
        Row: {
          completed_at: string | null
          detailed_feedback: Json | null
          duration_seconds: number | null
          exercises_data: Json
          grade_level: number
          id: string
          is_completed: boolean | null
          started_at: string
          total_score: number | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          detailed_feedback?: Json | null
          duration_seconds?: number | null
          exercises_data: Json
          grade_level: number
          id?: string
          is_completed?: boolean | null
          started_at?: string
          total_score?: number | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          detailed_feedback?: Json | null
          duration_seconds?: number | null
          exercises_data?: Json
          grade_level?: number
          id?: string
          is_completed?: boolean | null
          started_at?: string
          total_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mock_bac_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          channel: string | null
          clicked_at: string | null
          id: string
          metadata: Json | null
          notification_type: string
          opened_at: string | null
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          clicked_at?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          opened_at?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          clicked_at?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          opened_at?: string | null
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_attempts: {
        Row: {
          amount_lei: number
          completed_at: string | null
          created_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          payment_provider: string
          plan_tier: string
          provider_payment_id: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          amount_lei: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_provider: string
          plan_tier: string
          provider_payment_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          amount_lei?: number
          completed_at?: string | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          payment_provider?: string
          plan_tier?: string
          provider_payment_id?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          grade: string | null
          id: string
          maib_customer_id: string | null
          messages_reset_at: string | null
          messages_used_this_month: number | null
          phone: string | null
          profile_type: string | null
          subscription_status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          grade?: string | null
          id: string
          maib_customer_id?: string | null
          messages_reset_at?: string | null
          messages_used_this_month?: number | null
          phone?: string | null
          profile_type?: string | null
          subscription_status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          grade?: string | null
          id?: string
          maib_customer_id?: string | null
          messages_reset_at?: string | null
          messages_used_this_month?: number | null
          phone?: string | null
          profile_type?: string | null
          subscription_status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      progress: {
        Row: {
          attempts: number | null
          correct_attempts: number | null
          id: string
          last_practiced: string | null
          mastery_score: number | null
          topic: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attempts?: number | null
          correct_attempts?: number | null
          id?: string
          last_practiced?: string | null
          mastery_score?: number | null
          topic: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attempts?: number | null
          correct_attempts?: number | null
          id?: string
          last_practiced?: string | null
          mastery_score?: number | null
          topic?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          keys: Json
          last_used_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          keys: Json
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          keys?: Json
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          exercise_count: number | null
          id: string
          message_count: number | null
          period_start: string
          period_type: string
          simulation_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          exercise_count?: number | null
          id?: string
          message_count?: number | null
          period_start: string
          period_type: string
          simulation_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          exercise_count?: number | null
          id?: string
          message_count?: number | null
          period_start?: string
          period_type?: string
          simulation_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string | null
          reward_granted_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          reward_granted_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string | null
          reward_granted_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      solution_methods: {
        Row: {
          common_mistakes: Json | null
          created_at: string | null
          description: string | null
          difficulty: number | null
          embedding: string | null
          examples: Json | null
          exercise_type: string
          exercise_type_label: string
          forbidden_shortcuts: string[] | null
          grade_level: number
          id: string
          importance_score: number | null
          method_name: string
          notation_rules: Json | null
          region: string | null
          required_elements: Json | null
          required_tools: string[] | null
          steps: Json
          subtopic: string | null
          topic: string
          updated_at: string | null
          usage_count: number | null
          validated: boolean | null
          validated_by: string | null
        }
        Insert: {
          common_mistakes?: Json | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          embedding?: string | null
          examples?: Json | null
          exercise_type: string
          exercise_type_label: string
          forbidden_shortcuts?: string[] | null
          grade_level: number
          id?: string
          importance_score?: number | null
          method_name: string
          notation_rules?: Json | null
          region?: string | null
          required_elements?: Json | null
          required_tools?: string[] | null
          steps?: Json
          subtopic?: string | null
          topic: string
          updated_at?: string | null
          usage_count?: number | null
          validated?: boolean | null
          validated_by?: string | null
        }
        Update: {
          common_mistakes?: Json | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          embedding?: string | null
          examples?: Json | null
          exercise_type?: string
          exercise_type_label?: string
          forbidden_shortcuts?: string[] | null
          grade_level?: number
          id?: string
          importance_score?: number | null
          method_name?: string
          notation_rules?: Json | null
          region?: string | null
          required_elements?: Json | null
          required_tools?: string[] | null
          steps?: Json
          subtopic?: string | null
          topic?: string
          updated_at?: string | null
          usage_count?: number | null
          validated?: boolean | null
          validated_by?: string | null
        }
        Relationships: []
      }
      solved_exercises: {
        Row: {
          created_at: string | null
          created_by: string | null
          difficulty: number | null
          embedding: string | null
          grade_level: number | null
          helpful_count: number | null
          id: string
          needs_review: boolean | null
          not_helpful_count: number | null
          reviewed_by_admin: boolean | null
          solution: string
          source: string | null
          statement: string
          subtopic: string | null
          svg_static: string | null
          svg_thumbnail: string | null
          tags: Json
          template_id: string | null
          tikz_source: string | null
          topic: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          embedding?: string | null
          grade_level?: number | null
          helpful_count?: number | null
          id?: string
          needs_review?: boolean | null
          not_helpful_count?: number | null
          reviewed_by_admin?: boolean | null
          solution: string
          source?: string | null
          statement: string
          subtopic?: string | null
          svg_static?: string | null
          svg_thumbnail?: string | null
          tags?: Json
          template_id?: string | null
          tikz_source?: string | null
          topic: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          difficulty?: number | null
          embedding?: string | null
          grade_level?: number | null
          helpful_count?: number | null
          id?: string
          needs_review?: boolean | null
          not_helpful_count?: number | null
          reviewed_by_admin?: boolean | null
          solution?: string
          source?: string | null
          statement?: string
          subtopic?: string | null
          svg_static?: string | null
          svg_thumbnail?: string | null
          tags?: Json
          template_id?: string | null
          tikz_source?: string | null
          topic?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "solved_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "tikz_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_log: {
        Row: {
          activity_date: string
          created_at: string | null
          exercises_count: number | null
          id: string
          minutes_studied: number | null
          user_id: string | null
        }
        Insert: {
          activity_date: string
          created_at?: string | null
          exercises_count?: number | null
          id?: string
          minutes_studied?: number | null
          user_id?: string | null
        }
        Update: {
          activity_date?: string
          created_at?: string | null
          exercises_count?: number | null
          id?: string
          minutes_studied?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streak_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_lei: number | null
          created_at: string | null
          duration_days: number | null
          event_type: string | null
          id: string
          metadata: Json | null
          payment_id: string | null
          payment_provider: string | null
          tier: string
          user_id: string | null
        }
        Insert: {
          amount_lei?: number | null
          created_at?: string | null
          duration_days?: number | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider?: string | null
          tier: string
          user_id?: string | null
        }
        Update: {
          amount_lei?: number | null
          created_at?: string | null
          duration_days?: number | null
          event_type?: string | null
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider?: string | null
          tier?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tikz_templates: {
        Row: {
          calculator_function: string | null
          category: string
          created_at: string | null
          created_by: string | null
          default_params: Json | null
          description: string | null
          display_name: string
          example_problems: Json
          id: string
          is_active: boolean | null
          latex_source: string
          name: string
          optional_params: Json
          pedagogical_notes: Json
          preview_svg: string | null
          required_params: Json
          search_keywords: Json
          subcategory: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          calculator_function?: string | null
          category: string
          created_at?: string | null
          created_by?: string | null
          default_params?: Json | null
          description?: string | null
          display_name: string
          example_problems?: Json
          id?: string
          is_active?: boolean | null
          latex_source: string
          name: string
          optional_params?: Json
          pedagogical_notes?: Json
          preview_svg?: string | null
          required_params?: Json
          search_keywords?: Json
          subcategory?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          calculator_function?: string | null
          category?: string
          created_at?: string | null
          created_by?: string | null
          default_params?: Json | null
          description?: string | null
          display_name?: string
          example_problems?: Json
          id?: string
          is_active?: boolean | null
          latex_source?: string
          name?: string
          optional_params?: Json
          pedagogical_notes?: Json
          preview_svg?: string | null
          required_params?: Json
          search_keywords?: Json
          subcategory?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          created_at: string | null
          exercises_attempted: number | null
          exercises_correct: number | null
          id: string
          last_practice_at: string | null
          mastery_score: number | null
          needs_review: boolean | null
          next_review_at: string | null
          topic_display_name: string
          topic_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          exercises_attempted?: number | null
          exercises_correct?: number | null
          id?: string
          last_practice_at?: string | null
          mastery_score?: number | null
          needs_review?: boolean | null
          next_review_at?: string | null
          topic_display_name: string
          topic_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          exercises_attempted?: number | null
          exercises_correct?: number | null
          id?: string
          last_practice_at?: string | null
          mastery_score?: number | null
          needs_review?: boolean | null
          next_review_at?: string | null
          topic_display_name?: string
          topic_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_mastery_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_fingerprint: string
          id: string
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_fingerprint: string
          id?: string
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_fingerprint?: string
          id?: string
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_focus: {
        Row: {
          concept_ids: string[]
          created_at: string
          expires_at: string
          label: string | null
          user_id: string
        }
        Insert: {
          concept_ids?: string[]
          created_at?: string
          expires_at: string
          label?: string | null
          user_id: string
        }
        Update: {
          concept_ids?: string[]
          created_at?: string
          expires_at?: string
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          ai_cost_reset_at: string | null
          avatar_url: string | null
          bac_prediction_updated_at: string | null
          created_at: string | null
          current_bac_prediction: number | null
          email: string | null
          full_name: string | null
          goal: string | null
          grade_level: number | null
          id: string
          initial_bac_prediction: number | null
          is_pilot: boolean
          last_active_at: string | null
          monthly_ai_cost_cents: number | null
          notification_preferences: Json | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          parent_email: string | null
          referral_code: string | null
          referred_by_user_id: string | null
          streak_current: number | null
          streak_freeze_last_granted_at: string | null
          streak_freezes_available: number | null
          streak_last_activity_date: string | null
          streak_longest: number | null
          subscription_cancelled_at: string | null
          subscription_expires_at: string | null
          subscription_started_at: string | null
          subscription_tier: string | null
          target_bac_score: number | null
          total_exercises_solved: number | null
          total_minutes_studied: number | null
          trial_started_at: string | null
          trial_used: boolean | null
          updated_at: string | null
        }
        Insert: {
          ai_cost_reset_at?: string | null
          avatar_url?: string | null
          bac_prediction_updated_at?: string | null
          created_at?: string | null
          current_bac_prediction?: number | null
          email?: string | null
          full_name?: string | null
          goal?: string | null
          grade_level?: number | null
          id: string
          initial_bac_prediction?: number | null
          is_pilot?: boolean
          last_active_at?: string | null
          monthly_ai_cost_cents?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          parent_email?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          streak_current?: number | null
          streak_freeze_last_granted_at?: string | null
          streak_freezes_available?: number | null
          streak_last_activity_date?: string | null
          streak_longest?: number | null
          subscription_cancelled_at?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_tier?: string | null
          target_bac_score?: number | null
          total_exercises_solved?: number | null
          total_minutes_studied?: number | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ai_cost_reset_at?: string | null
          avatar_url?: string | null
          bac_prediction_updated_at?: string | null
          created_at?: string | null
          current_bac_prediction?: number | null
          email?: string | null
          full_name?: string | null
          goal?: string | null
          grade_level?: number | null
          id?: string
          initial_bac_prediction?: number | null
          is_pilot?: boolean
          last_active_at?: string | null
          monthly_ai_cost_cents?: number | null
          notification_preferences?: Json | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          parent_email?: string | null
          referral_code?: string | null
          referred_by_user_id?: string | null
          streak_current?: number | null
          streak_freeze_last_granted_at?: string | null
          streak_freezes_available?: number | null
          streak_last_activity_date?: string | null
          streak_longest?: number | null
          subscription_cancelled_at?: string | null
          subscription_expires_at?: string | null
          subscription_started_at?: string | null
          subscription_tier?: string | null
          target_bac_score?: number | null
          total_exercises_solved?: number | null
          total_minutes_studied?: number | null
          trial_started_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_referred_by_user_id_fkey"
            columns: ["referred_by_user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      exercise_servable: {
        Row: {
          exercise_id: string | null
          provenance: string | null
          tier: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: boolean
      }
      frontier_concepts: {
        Args: { p_grade: number; p_limit?: number; p_user_id: string }
        Returns: {
          concept_id: string
          grade_level: number
          mastery: number
          name: string
          prereq_ok: number
          prereq_total: number
          servable_exercises: number
          slug: string
          verified_exercises: number
        }[]
      }
      increment_rate_limit: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: undefined
      }
      match_concepts_for_exercise: {
        Args: { match_count: number; query_embedding: string }
        Returns: {
          concept_id: string
          similarity: number
        }[]
      }
      match_concepts_for_exercise_grade: {
        Args: { grade: number; match_count: number; query_embedding: string }
        Returns: {
          concept_id: string
          similarity: number
        }[]
      }
      match_concepts_in_set: {
        Args: { ids: string[]; match_count: number; query_embedding: string }
        Returns: {
          concept_id: string
          similarity: number
        }[]
      }
      match_exercises: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          difficulty: number
          grade_level: number
          id: string
          similarity: number
          solution: string
          statement: string
          svg_static: string
          topic: string
        }[]
      }
      match_solution_methods: {
        Args: {
          filter_grade?: number
          filter_topic?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          common_mistakes: Json
          description: string
          examples: Json
          exercise_type: string
          exercise_type_label: string
          grade_level: number
          id: string
          importance_score: number
          method_name: string
          notation_rules: Json
          required_tools: string[]
          similarity: number
          steps: Json
          topic: string
        }[]
      }
      month_cost: { Args: { p_user_id: string }; Returns: number }
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
