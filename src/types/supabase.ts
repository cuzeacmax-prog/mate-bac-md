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

type AdminFeedbackRow = {
  id: string;
  admin_id: string | null;
  message_id: string | null;
  rating: "good" | "bad" | "needs_improvement";
  ideal_response: string | null;
  notes: string | null;
  created_at: string | null;
};

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
