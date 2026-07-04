export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: {
          id: string
          code: string
          name: string
          type: string
          host_id: string
          is_public: boolean
          is_locked: boolean
          max_participants: number
          settings: Json
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          type: string
          host_id: string
          is_public?: boolean
          is_locked?: boolean
          max_participants?: number
          settings?: Json
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          type?: string
          host_id?: string
          is_public?: boolean
          is_locked?: boolean
          max_participants?: number
          settings?: Json
          created_at?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          id: string
          room_id: string
          user_id: string
          role: string
          is_online: boolean
          joined_at: string
          username: string | null
          avatar_url: string | null
          xp: number | null
          rank: string | null
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          role?: string
          is_online?: boolean
          joined_at?: string
          username?: string | null
          avatar_url?: string | null
          xp?: number | null
          rank?: string | null
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          role?: string
          is_online?: boolean
          joined_at?: string
          username?: string | null
          avatar_url?: string | null
          xp?: number | null
          rank?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_room_participants_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          room_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_chat_messages_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          }
        ]
      }
      activity_prompts: {
        Row: {
          id: string
          activity_type: string
          category: string | null
          prompt_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          activity_type: string
          category?: string | null
          prompt_data: Json
          created_at?: string
        }
        Update: {
          id?: string
          activity_type?: string
          category?: string | null
          prompt_data?: Json
          created_at?: string
        }
        Relationships: []
      }
      trivia_questions: {
        Row: {
          id: string
          text: string
          options: Json
          correct_index: number
          category: string
          difficulty: string
          created_at: string
        }
        Insert: {
          id?: string
          text: string
          options: Json
          correct_index: number
          category: string
          difficulty: string
          created_at?: string
        }
        Update: {
          id?: string
          text?: string
          options?: Json
          correct_index?: number
          category?: string
          difficulty?: string
          created_at?: string
        }
        Relationships: []
      }
      room_bans: {
        Row: {
          id: string
          room_id: string
          user_id: string
          banned_by: string
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          banned_by: string
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          banned_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_room_bans_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          }
        ]
      }
      message_reports: {
        Row: {
          id: string
          message_id: string
          room_id: string
          reported_user_id: string
          reporter_id: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          room_id: string
          reported_user_id: string
          reporter_id: string
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          room_id?: string
          reported_user_id?: string
          reporter_id?: string
          reason?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_reports_room"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
