/**
 * Hand-written database types for the biasly schema.
 *
 * There is no Supabase CLI in this project, so `supabase gen types` is not
 * available: this file is maintained by hand and must be kept column-for-column
 * (nullability included) in step with `supabase/schema.sql` (AGENTS.md
 * section 7).
 */

/** `article_analyses.sentiment_label` (AGENTS.md section 19). */
export type SentimentLabel = "positive" | "neutral" | "negative";

/** `article_analyses.bias_label` (AGENTS.md section 19). */
export type BiasLabel = "left" | "center" | "right" | "mixed" | "unclear";

/** `logs.level`. */
export type LogLevel = "info" | "warn" | "error";

/**
 * `logs.scope`. Stored as free text so later pipeline stages can add their own
 * without a migration; these are the values the current stages emit.
 */
export type LogScope = "scrape" | "analyze" | "scheduler" | "cron";

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
      sources: {
        Row: {
          id: string;
          name: string;
          listing_url: string;
          parser_strategy: string | null;
          is_active: boolean;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          listing_url: string;
          parser_strategy?: string | null;
          is_active?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          listing_url?: string;
          parser_strategy?: string | null;
          is_active?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          source_id: string;
          url: string;
          canonical_url: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at: string;
          analyzed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          url: string;
          canonical_url?: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          url?: string;
          canonical_url?: string | null;
          title?: string;
          image_url?: string;
          published_at?: string;
          raw_text?: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      article_analyses: {
        Row: {
          id: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: string;
          bias_score: number;
          bias_label: string;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes: string | null;
          loaded_terms: string[];
          disclaimer: string | null;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabel;
          bias_score: number;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes?: string | null;
          loaded_terms?: string[];
          disclaimer?: string | null;
          model: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          summary?: string;
          sentiment_score?: number;
          sentiment_label?: SentimentLabel;
          bias_score?: number;
          bias_label?: BiasLabel;
          left_percentage?: number;
          center_percentage?: number;
          right_percentage?: number;
          confidence?: number;
          framing_notes?: string | null;
          loaded_terms?: string[];
          disclaimer?: string | null;
          model?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_analyses_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: number;
          level: string;
          scope: string;
          message: string;
          context: Json | null;
          run_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: never;
          level?: LogLevel;
          scope: string;
          message: string;
          context?: Json | null;
          run_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: never;
          level?: LogLevel;
          scope?: string;
          message?: string;
          context?: Json | null;
          run_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      oxylabs_schedules: {
        Row: {
          id: string;
          source_id: string;
          /** Text, not a number: 64-bit id, AGENTS.md section 18. */
          schedule_id: string;
          cron_expression: string;
          is_active: boolean;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          schedule_id: string;
          cron_expression: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          schedule_id?: string;
          cron_expression?: string;
          is_active?: boolean;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: true;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: {
          id: string;
          schedule_id: string;
          /** Text, not a number: 64-bit id, AGENTS.md section 18. */
          job_id: string;
          result_status: string | null;
          run_at: string | null;
          processed_at: string | null;
          articles_inserted: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          job_id: string;
          result_status?: string | null;
          run_at?: string | null;
          processed_at?: string | null;
          articles_inserted?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          job_id?: string;
          result_status?: string | null;
          run_at?: string | null;
          processed_at?: string | null;
          articles_inserted?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["schedule_id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type Tables = Database["public"]["Tables"];

export type SourceRow = Tables["sources"]["Row"];
export type ArticleRow = Tables["articles"]["Row"];
export type ArticleAnalysisRow = Tables["article_analyses"]["Row"];
export type LogRow = Tables["logs"]["Row"];
export type OxylabsScheduleRow = Tables["oxylabs_schedules"]["Row"];
export type OxylabsScheduleRunRow = Tables["oxylabs_schedule_runs"]["Row"];

export type ArticleInsert = Tables["articles"]["Insert"];
export type ArticleAnalysisInsert = Tables["article_analyses"]["Insert"];
export type LogInsert = Tables["logs"]["Insert"];
