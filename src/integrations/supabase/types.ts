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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      action_status: {
        Row: {
          id: string
          item_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_key: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          answer: string
          created_at: string
          id: string
          provider: string | null
          question: string
          replay_date: string | null
          role: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          provider?: string | null
          question: string
          replay_date?: string | null
          role: Database["public"]["Enums"]["coach_role"]
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          provider?: string | null
          question?: string
          replay_date?: string | null
          role?: Database["public"]["Enums"]["coach_role"]
          user_id?: string
        }
        Relationships: []
      }
      investigation_challenges: {
        Row: {
          answer: string
          area_manager_id: string
          can_answer: boolean
          created_at: string
          fact_ids: string[]
          fallback: boolean
          id: string
          issue_id: string
          preset: string | null
          provider: string | null
          question: string
          store_id: string
          user_id: string
          user_name: string
          zone: string
        }
        Insert: {
          answer: string
          area_manager_id: string
          can_answer: boolean
          created_at?: string
          fact_ids?: string[]
          fallback?: boolean
          id?: string
          issue_id: string
          preset?: string | null
          provider?: string | null
          question: string
          store_id: string
          user_id: string
          user_name: string
          zone: string
        }
        Update: {
          answer?: string
          area_manager_id?: string
          can_answer?: boolean
          created_at?: string
          fact_ids?: string[]
          fallback?: boolean
          id?: string
          issue_id?: string
          preset?: string | null
          provider?: string | null
          question?: string
          store_id?: string
          user_id?: string
          user_name?: string
          zone?: string
        }
        Relationships: []
      }
      investigations: {
        Row: {
          area_manager_id: string
          as_of: string
          checks: Json
          created_at: string
          created_by: string
          created_by_name: string
          data_version: string
          detective: Json | null
          evidence_hash: string
          facts: Json
          fallback: boolean
          id: string
          issue_id: string
          latency_ms: number | null
          model: string | null
          prompt_version: string
          provider: string | null
          skeptic: Json | null
          status: string
          store_id: string
          updated_at: string
          validations: Json
          verdict: string | null
          verdict_reason: string | null
          zone: string
        }
        Insert: {
          area_manager_id: string
          as_of: string
          checks: Json
          created_at?: string
          created_by: string
          created_by_name: string
          data_version: string
          detective?: Json | null
          evidence_hash: string
          facts: Json
          fallback?: boolean
          id?: string
          issue_id: string
          latency_ms?: number | null
          model?: string | null
          prompt_version: string
          provider?: string | null
          skeptic?: Json | null
          status?: string
          store_id: string
          updated_at?: string
          validations?: Json
          verdict?: string | null
          verdict_reason?: string | null
          zone: string
        }
        Update: {
          area_manager_id?: string
          as_of?: string
          checks?: Json
          created_at?: string
          created_by?: string
          created_by_name?: string
          data_version?: string
          detective?: Json | null
          evidence_hash?: string
          facts?: Json
          fallback?: boolean
          id?: string
          issue_id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_version?: string
          provider?: string | null
          skeptic?: Json | null
          status?: string
          store_id?: string
          updated_at?: string
          validations?: Json
          verdict?: string | null
          verdict_reason?: string | null
          zone?: string
        }
        Relationships: []
      }
      issue_action_events: {
        Row: {
          actor_name: string
          actor_role: string
          actor_user_id: string
          assignee_name: string | null
          created_at: string
          event: string
          from_state: Database["public"]["Enums"]["issue_action_state"] | null
          id: number
          issue_id: string
          note: string | null
          reason: string | null
          to_state: Database["public"]["Enums"]["issue_action_state"]
        }
        Insert: {
          actor_name: string
          actor_role: string
          actor_user_id: string
          assignee_name?: string | null
          created_at?: string
          event: string
          from_state?: Database["public"]["Enums"]["issue_action_state"] | null
          id?: never
          issue_id: string
          note?: string | null
          reason?: string | null
          to_state: Database["public"]["Enums"]["issue_action_state"]
        }
        Update: {
          actor_name?: string
          actor_role?: string
          actor_user_id?: string
          assignee_name?: string | null
          created_at?: string
          event?: string
          from_state?: Database["public"]["Enums"]["issue_action_state"] | null
          id?: never
          issue_id?: string
          note?: string | null
          reason?: string | null
          to_state?: Database["public"]["Enums"]["issue_action_state"]
        }
        Relationships: [
          {
            foreignKeyName: "issue_action_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issue_actions"
            referencedColumns: ["issue_id"]
          },
        ]
      }
      issue_actions: {
        Row: {
          area_manager_id: string
          assignee_name: string | null
          assignee_user_id: string | null
          block_reason: string | null
          created_at: string
          dismiss_reason: string | null
          due_date: string | null
          issue_id: string
          lever: string | null
          rupees: number | null
          state: Database["public"]["Enums"]["issue_action_state"]
          store_id: string
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number
          week_date: string
          zone: string
        }
        Insert: {
          area_manager_id: string
          assignee_name?: string | null
          assignee_user_id?: string | null
          block_reason?: string | null
          created_at?: string
          dismiss_reason?: string | null
          due_date?: string | null
          issue_id: string
          lever?: string | null
          rupees?: number | null
          state?: Database["public"]["Enums"]["issue_action_state"]
          store_id: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          week_date: string
          zone: string
        }
        Update: {
          area_manager_id?: string
          assignee_name?: string | null
          assignee_user_id?: string | null
          block_reason?: string | null
          created_at?: string
          dismiss_reason?: string | null
          due_date?: string | null
          issue_id?: string
          lever?: string | null
          rupees?: number | null
          state?: Database["public"]["Enums"]["issue_action_state"]
          store_id?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          week_date?: string
          zone?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          role: Database["public"]["Enums"]["coach_role"] | null
          scope_id: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          role?: Database["public"]["Enums"]["coach_role"] | null
          scope_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["coach_role"] | null
          scope_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["coach_role"]
          scope_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["coach_role"]
          scope_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["coach_role"]
          scope_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_issue_transition: {
        Args: {
          _actor: string
          _actor_name: string
          _actor_role: string
          _am_id: string
          _assignee: string
          _assignee_name: string
          _due: string
          _event: string
          _expected_version: number
          _issue_id: string
          _lever: string
          _note: string
          _notify: string[]
          _notify_body: string
          _notify_kind: string
          _notify_link: string
          _notify_title: string
          _reason: string
          _rupees: number
          _set_assignee: boolean
          _store_id: string
          _title: string
          _to_state: Database["public"]["Enums"]["issue_action_state"]
          _week_date: string
          _zone: string
        }
        Returns: {
          new_state: Database["public"]["Enums"]["issue_action_state"]
          new_version: number
        }[]
      }
      auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      can_see_store_action: {
        Args: { _am: string; _store: string; _zone: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["coach_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      coach_role: "hq" | "zonal" | "am" | "store_lead" | "salesperson"
      issue_action_state:
        | "open"
        | "assigned"
        | "acknowledged"
        | "in_progress"
        | "blocked"
        | "done"
        | "reviewed"
        | "dismissed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      coach_role: ["hq", "zonal", "am", "store_lead", "salesperson"],
      issue_action_state: [
        "open",
        "assigned",
        "acknowledged",
        "in_progress",
        "blocked",
        "done",
        "reviewed",
        "dismissed",
      ],
    },
  },
} as const
