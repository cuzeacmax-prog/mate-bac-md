// Placeholder types — replace with: npx supabase gen types typescript --project-id YOUR_ID > src/types/supabase.ts
// Kept minimal/explicit to avoid TypeScript circular reference issues.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  grade: string | null;
  profile_type: string | null;
  subscription_status: string | null;
  maib_customer_id: string | null;
  messages_used_this_month: number | null;
  messages_reset_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CourseRow = {
  id: string;
  slug: string;
  name: string;
  grade: string | null;
  subject: string | null;
  profile_type: string | null;
  description: string | null;
  active: boolean | null;
  price_monthly: number | null;
  created_at: string | null;
};

type CourseModuleRow = {
  id: string;
  course_id: string;
  name: string;
  order_index: number;
  description: string | null;
};

type ConversationRow = {
  id: string;
  user_id: string;
  title: string | null;
  topic: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string | null;
  has_image: boolean | null;
  image_url: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  created_at: string | null;
};

type RateLimitRow = {
  id: string;
  user_id: string;
  period_start: string;
  period_type: string;
  message_count: number | null;
  exercise_count: number | null;
  simulation_count: number | null;
  updated_at: string | null;
};

type ApiUsageLogRow = {
  id: string;
  user_id: string;
  model: string | null;
  task_name: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  endpoint: string | null;
  created_at: string | null;
};

type AiModelConfigRow = {
  id: string;
  task_name: string;
  display_name: string;
  provider: 'anthropic' | 'google' | 'openai';
  model_name: string;
  max_tokens: number;
  temperature: number;
  system_prompt_key: string | null;
  price_input_per_1m: number;
  price_output_per_1m: number;
  description: string | null;
  is_active: boolean;
  fallback_task_name: string | null;
  created_at: string;
  updated_at: string;
};

type SystemConfigRow = {
  id: string;
  key: string;
  value: Json;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

type TikzTemplateRow = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  latex_source: string;
  required_params: Json;
  optional_params: Json;
  calculator_function: string | null;
  preview_svg: string | null;
  default_params: Json | null;
  pedagogical_notes: Json;
  search_keywords: Json;
  example_problems: Json;
  is_active: boolean | null;
  version: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SolvedExerciseRow = {
  id: string;
  template_id: string | null;
  statement: string;
  solution: string;
  tikz_source: string | null;
  svg_static: string | null;
  svg_thumbnail: string | null;
  topic: string;
  subtopic: string | null;
  difficulty: number | null;
  grade_level: number | null;
  source: string | null;
  tags: Json;
  reviewed_by_admin: boolean | null;
  needs_review: boolean | null;
  view_count: number | null;
  helpful_count: number | null;
  not_helpful_count: number | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type GapAnalysisRow = {
  id: string;
  query: string;
  user_id: string | null;
  conversation_id: string | null;
  max_similarity_found: number | null;
  top_match_id: string | null;
  detected_topic: string | null;
  detected_subtopic: string | null;
  resolved: boolean | null;
  resolved_with_exercise_id: string | null;
  created_at: string | null;
};

type AdminFeedbackRow = {
  id: string;
  admin_id: string | null;
  message_id: string | null;
  rating: "good" | "bad" | "needs_improvement";
  ideal_response: string | null;
  notes: string | null;
  created_at: string | null;
};

// ── ETAPA 10 / 11 table row types ────────────────────────────────────────────

type UserProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  grade_level: number | null;
  target_bac_score: number | null;
  initial_bac_prediction: number | null;
  current_bac_prediction: number | null;
  bac_prediction_updated_at: string | null;
  onboarding_completed: boolean | null;
  onboarding_completed_at: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  referral_code: string | null;
  referred_by: string | null;
  streak_current: number | null;
  streak_longest: number | null;
  streak_last_activity_date: string | null;
  total_exercises_solved: number | null;
  total_chat_messages: number | null;
  ai_cost_total_usd: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TopicMasteryRow = {
  id: string;
  user_id: string;
  topic_id: string;
  topic_display_name: string;
  mastery_score: number;
  exercises_attempted: number | null;
  exercises_correct: number | null;
  needs_review: boolean | null;
  last_practiced_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DiagnosticSessionRow = {
  id: string;
  user_id: string;
  grade_level: number;
  target_bac_score: number | null;
  exercises_log: Json;
  total_questions: number | null;
  correct_count: number | null;
  initial_bac_prediction: number | null;
  weaknesses: string[] | null;
  completed_at: string | null;
  created_at: string | null;
};

type DiagnosticExerciseRow = {
  id: string;
  topic_id: string;
  grade_level: number;
  difficulty: number;
  prompt: string;
  options: Json;
  correct_letter: string;
  explanation: string | null;
  source: string | null;
  created_at: string | null;
};

type ExerciseAttemptRow = {
  id: string;
  user_id: string;
  exercise_id: string | null;
  topic_id: string;
  difficulty: number | null;
  is_correct: boolean;
  time_spent_seconds: number | null;
  session_type: string | null;
  created_at: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at"> & {
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<ProfileRow, "id">>;
        Relationships: [];
      };
      courses: {
        Row: CourseRow;
        Insert: Omit<CourseRow, "id" | "created_at"> & { id?: string; created_at?: string | null };
        Update: Partial<Omit<CourseRow, "id">>;
        Relationships: [];
      };
      course_modules: {
        Row: CourseModuleRow;
        Insert: Omit<CourseModuleRow, "id"> & { id?: string };
        Update: Partial<Omit<CourseModuleRow, "id">>;
        Relationships: [];
      };
      conversations: {
        Row: ConversationRow;
        Insert: Omit<ConversationRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<ConversationRow, "id">>;
        Relationships: [];
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, "id" | "created_at"> & { id?: string; created_at?: string | null };
        Update: Partial<Omit<MessageRow, "id">>;
        Relationships: [];
      };
      rate_limits: {
        Row: RateLimitRow;
        Insert: Omit<RateLimitRow, "id"> & { id?: string };
        Update: Partial<Omit<RateLimitRow, "id">>;
        Relationships: [];
      };
      api_usage_log: {
        Row: ApiUsageLogRow;
        Insert: Omit<ApiUsageLogRow, "id" | "created_at"> & { id?: string; created_at?: string | null };
        Update: Partial<Omit<ApiUsageLogRow, "id">>;
        Relationships: [];
      };
      admin_feedback: {
        Row: AdminFeedbackRow;
        Insert: Omit<AdminFeedbackRow, "id" | "created_at"> & { id?: string; created_at?: string | null };
        Update: Partial<Omit<AdminFeedbackRow, "id">>;
        Relationships: [];
      };
      ai_model_config: {
        Row: AiModelConfigRow;
        Insert: Omit<AiModelConfigRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<AiModelConfigRow, "id" | "created_at">>;
        Relationships: [];
      };
      system_config: {
        Row: SystemConfigRow;
        Insert: Omit<SystemConfigRow, "id" | "updated_at"> & { id?: string; updated_at?: string };
        Update: Partial<Omit<SystemConfigRow, "id">>;
        Relationships: [];
      };
      tikz_templates: {
        Row: TikzTemplateRow;
        Insert: Omit<TikzTemplateRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<TikzTemplateRow, "id">>;
        Relationships: [];
      };
      solved_exercises: {
        Row: SolvedExerciseRow;
        Insert: Omit<SolvedExerciseRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<SolvedExerciseRow, "id">>;
        Relationships: [];
      };
      gap_analysis: {
        Row: GapAnalysisRow;
        Insert: Omit<GapAnalysisRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string | null;
        };
        Update: Partial<Omit<GapAnalysisRow, "id">>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Omit<UserProfileRow, "id" | "created_at" | "updated_at"> & {
          id: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<UserProfileRow, "id">>;
        Relationships: [];
      };
      topic_mastery: {
        Row: TopicMasteryRow;
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          topic_display_name: string;
          mastery_score?: number;
          exercises_attempted?: number | null;
          exercises_correct?: number | null;
          needs_review?: boolean | null;
          last_practiced_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Omit<TopicMasteryRow, "id">>;
        Relationships: [];
      };
      diagnostic_sessions: {
        Row: DiagnosticSessionRow;
        Insert: {
          id?: string;
          user_id: string;
          grade_level: number;
          target_bac_score?: number | null;
          exercises_log?: Json;
          total_questions?: number | null;
          correct_count?: number | null;
          initial_bac_prediction?: number | null;
          weaknesses?: string[] | null;
          completed_at?: string | null;
          created_at?: string | null;
        };
        Update: Partial<Omit<DiagnosticSessionRow, "id">>;
        Relationships: [];
      };
      diagnostic_exercises: {
        Row: DiagnosticExerciseRow;
        Insert: Omit<DiagnosticExerciseRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string | null;
        };
        Update: Partial<Omit<DiagnosticExerciseRow, "id">>;
        Relationships: [];
      };
      exercise_attempts: {
        Row: ExerciseAttemptRow;
        Insert: Omit<ExerciseAttemptRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string | null;
        };
        Update: Partial<Omit<ExerciseAttemptRow, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_rate_limit: {
        Args: { p_user_id: string; p_action_type: string };
        Returns: boolean;
      };
      increment_rate_limit: {
        Args: { p_user_id: string; p_action_type: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
};
