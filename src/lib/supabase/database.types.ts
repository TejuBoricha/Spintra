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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_prompts: {
        Row: {
          activity_type: string
          category: string | null
          created_at: string
          id: string
          prompt_data: Json
        }
        Insert: {
          activity_type: string
          category?: string | null
          created_at?: string
          id?: string
          prompt_data: Json
        }
        Update: {
          activity_type?: string
          category?: string | null
          created_at?: string
          id?: string
          prompt_data?: Json
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          activity_type: string | null
          actor_id: string
          created_at: string
          event_name: string
          id: number
        }
        Insert: {
          activity_type?: string | null
          actor_id: string
          created_at?: string
          event_name: string
          id?: number
        }
        Update: {
          activity_type?: string | null
          actor_id?: string
          created_at?: string
          event_name?: string
          id?: number
        }
        Relationships: []
      }
      analytics_events_insert_attempts: {
        Row: {
          actor_id: string
          created_at: string
          id: number
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: number
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat_messages_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      guess_number_attempts: {
        Row: {
          created_at: string
          id: number
          room_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          room_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          room_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guess_number_attempts_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      guess_number_secrets: {
        Row: {
          room_code: string
          secret: number
          updated_at: string
        }
        Insert: {
          room_code: string
          secret: number
          updated_at?: string
        }
        Update: {
          room_code?: string
          secret?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guess_number_secrets_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      message_reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string | null
          reported_user_id: string
          reporter_id: string
          reporter_username: string | null
          reviewed: boolean
          room_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason?: string | null
          reported_user_id: string
          reporter_id: string
          reporter_username?: string | null
          reviewed?: boolean
          room_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string | null
          reported_user_id?: string
          reporter_id?: string
          reporter_username?: string | null
          reviewed?: boolean
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_reports_message"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_reports_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_kind: string
          actor_id: string
          created_at: string
          detail: string | null
          id: string
          room_id: string
          target_user_id: string
          target_username: string | null
        }
        Insert: {
          action_kind: string
          actor_id: string
          created_at?: string
          detail?: string | null
          id?: string
          room_id: string
          target_user_id: string
          target_username?: string | null
        }
        Update: {
          action_kind?: string
          actor_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          room_id?: string
          target_user_id?: string
          target_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      room_activity_state: {
        Row: {
          activity_state: Json | null
          room_code: string
        }
        Insert: {
          activity_state?: Json | null
          room_code: string
        }
        Update: {
          activity_state?: Json | null
          room_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_activity_state_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      room_bans: {
        Row: {
          banned_by: string
          created_at: string
          fingerprint_hash: string | null
          id: string
          room_id: string
          user_id: string
          username: string | null
        }
        Insert: {
          banned_by: string
          created_at?: string
          fingerprint_hash?: string | null
          id?: string
          room_id: string
          user_id: string
          username?: string | null
        }
        Update: {
          banned_by?: string
          created_at?: string
          fingerprint_hash?: string | null
          id?: string
          room_id?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_room_bans_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      room_participants: {
        Row: {
          avatar_url: string | null
          bingo_card: Json | null
          fingerprint_hash: string | null
          id: string
          is_online: boolean
          joined_at: string
          rank: string | null
          role: string
          room_id: string
          user_id: string
          username: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          bingo_card?: Json | null
          fingerprint_hash?: string | null
          id?: string
          is_online?: boolean
          joined_at?: string
          rank?: string | null
          role?: string
          room_id: string
          user_id: string
          username?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          bingo_card?: Json | null
          fingerprint_hash?: string | null
          id?: string
          is_online?: boolean
          joined_at?: string
          rank?: string | null
          role?: string
          room_id?: string
          user_id?: string
          username?: string | null
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_room_participants_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      room_participants_update_attempts: {
        Row: {
          actor_id: string
          created_at: string
          id: number
          room_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: number
          room_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: number
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_update_attempts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      room_scores: {
        Row: {
          activity_type: string
          award_kind: string
          created_at: string
          id: string
          points: number
          room_id: string
          round_key: string
          user_id: string
        }
        Insert: {
          activity_type: string
          award_kind: string
          created_at?: string
          id?: string
          points: number
          room_id: string
          round_key: string
          user_id: string
        }
        Update: {
          activity_type?: string
          award_kind?: string
          created_at?: string
          id?: string
          points?: number
          room_id?: string
          round_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_scores_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          host_id: string
          id: string
          is_locked: boolean
          is_public: boolean
          max_participants: number
          name: string
          participant_count: number
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          host_id: string
          id?: string
          is_locked?: boolean
          is_public?: boolean
          max_participants?: number
          name: string
          participant_count?: number
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          host_id?: string
          id?: string
          is_locked?: boolean
          is_public?: boolean
          max_participants?: number
          name?: string
          participant_count?: number
          type?: string
        }
        Relationships: []
      }
      trivia_questions: {
        Row: {
          category: string
          correct_index: number
          created_at: string
          difficulty: string
          id: string
          options: Json
          text: string
        }
        Insert: {
          category: string
          correct_index: number
          created_at?: string
          difficulty: string
          id?: string
          options: Json
          text: string
        }
        Update: {
          category?: string
          correct_index?: number
          created_at?: string
          difficulty?: string
          id?: string
          options?: Json
          text?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _record_award: {
        Args: {
          p_activity_type: string
          p_award_kind: string
          p_points: number
          p_room_id: string
          p_round_key: string
          p_user_id: string
          p_xp_delta: number
        }
        Returns: boolean
      }
      award_score: {
        Args: {
          p_activity_type: string
          p_choice_index?: number
          p_question_id?: string
          p_question_num?: number
          p_room_id: string
        }
        Returns: {
          awarded: boolean
          new_rank: string
          new_xp: number
        }[]
      }
      check_guess_number: {
        Args: { p_guess: number; p_room_code: string }
        Returns: string
      }
      cleanup_inactive_rooms: { Args: never; Returns: undefined }
      elect_room_host: {
        Args: { p_room_code: string; p_user_id: string }
        Returns: boolean
      }
      get_guess_number_secret: {
        Args: { p_room_code: string }
        Returns: number
      }
      get_room_by_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          host_id: string
          id: string
          is_locked: boolean
          max_participants: number
          name: string
          type: string
        }[]
      }
      is_member_of_room: {
        Args: { room_code: string; user_uuid: string }
        Returns: boolean
      }
      log_moderation_event: {
        Args: {
          p_detail: string
          p_event_type: string
          p_room_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      moderation_dismiss_report: {
        Args: { p_report_id: string; p_room_code: string }
        Returns: undefined
      }
      moderation_kick_ban: {
        Args: { p_room_code: string; p_target_user_id: string }
        Returns: string
      }
      moderation_unban: {
        Args: { p_ban_id: string; p_room_code: string }
        Returns: string
      }
      set_guess_number_secret: {
        Args: { p_room_code: string; p_secret: number }
        Returns: undefined
      }
      tier_for_xp: { Args: { p_xp: number }; Returns: string }
      verify_trivia_answer: { Args: { p_question_id: string }; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
