// Auto-generate with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
// Placeholder until Supabase project is configured

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          grade?: string | null;
          profile_type?: string | null;
          subscription_status?: string | null;
          maib_customer_id?: string | null;
          messages_used_this_month?: number | null;
          messages_reset_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      courses: {
        Row: {
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
        Insert: Omit<
          Database["public"]["Tables"]["courses"]["Row"],
          "id" | "created_at"
        > & { id?: string; created_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>;
      };
      conversations: {
        Row: {
          id: string;
          user_id: string | null;
          title: string | null;
          topic: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: Omit<
          Database["public"]["Tables"]["conversations"]["Row"],
          "id"
        > & { id?: string };
        Update: Partial<
          Database["public"]["Tables"]["conversations"]["Insert"]
        >;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string | null;
          role: string | null;
          content: string | null;
          has_image: boolean | null;
          image_url: string | null;
          tokens_input: number | null;
          tokens_output: number | null;
          created_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["messages"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string | null;
          period_start: string;
          period_type: string;
          message_count: number | null;
          exercise_count: number | null;
          simulation_count: number | null;
          updated_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["rate_limits"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rate_limits"]["Insert"]>;
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
        Returns: void;
      };
    };
    Enums: Record<string, never>;
  };
};
