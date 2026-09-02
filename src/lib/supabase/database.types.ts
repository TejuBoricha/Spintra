export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      city_assets: {
        Row: {
          acquired_at: string
          buildings: number
          id: string
          is_mortgaged: boolean
          match_id: string
          owner_seat: number
          space_idx: number
        }
        Insert: {
          acquired_at?: string
          buildings?: number
          id?: string
          is_mortgaged?: boolean
          match_id: string
          owner_seat: number
          space_idx: number
        }
        Update: {
          acquired_at?: string
          buildings?: number
          id?: string
          is_mortgaged?: boolean
          match_id?: string
          owner_seat?: number
          space_idx?: number
        }
        Relationships: [
          {
            foreignKeyName: "city_assets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_match_results"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "city_assets_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_assets_space_idx_fkey"
            columns: ["space_idx"]
            isOneToOne: false
            referencedRelation: "city_board_spaces"
            referencedColumns: ["idx"]
          },
        ]
      }
      city_auctions: {
        Row: {
          created_at: string
          ends_at: string
          hard_ends_at: string
          high_bid: number
          high_seat: number | null
          id: string
          match_id: string
          passed_seats: number[]
          settled_at: string | null
          space_idx: number
          status: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          hard_ends_at: string
          high_bid?: number
          high_seat?: number | null
          id?: string
          match_id: string
          passed_seats?: number[]
          settled_at?: string | null
          space_idx: number
          status?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          hard_ends_at?: string
          high_bid?: number
          high_seat?: number | null
          id?: string
          match_id?: string
          passed_seats?: number[]
          settled_at?: string | null
          space_idx?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_auctions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_match_results"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "city_auctions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_auctions_space_idx_fkey"
            columns: ["space_idx"]
            isOneToOne: false
            referencedRelation: "city_board_spaces"
            referencedColumns: ["idx"]
          },
        ]
      }
      city_board_spaces: {
        Row: {
          build_cost: number | null
          country: string | null
          deck: string | null
          idx: number
          kind: string
          name: string
          price: number | null
          rent: number[] | null
          tax_amount: number | null
        }
        Insert: {
          build_cost?: number | null
          country?: string | null
          deck?: string | null
          idx: number
          kind: string
          name: string
          price?: number | null
          rent?: number[] | null
          tax_amount?: number | null
        }
        Update: {
          build_cost?: number | null
          country?: string | null
          deck?: string | null
          idx?: number
          kind?: string
          name?: string
          price?: number | null
          rent?: number[] | null
          tax_amount?: number | null
        }
        Relationships: []
      }
      city_cards: {
        Row: {
          deck: string
          effect: Json
          id: number
          text: string
        }
        Insert: {
          deck: string
          effect: Json
          id: number
          text: string
        }
        Update: {
          deck?: string
          effect?: Json
          id?: number
          text?: string
        }
        Relationships: []
      }
      city_command_attempts: {
        Row: {
          created_at: string
          id: string
          room_code: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_code: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_code?: string
          user_id?: string
        }
        Relationships: []
      }
      city_debt_queue: {
        Row: {
          amount: number
          creditor_seat: number | null
          debtor_seat: number
          id: string
          match_id: string
          queued_at: string
        }
        Insert: {
          amount: number
          creditor_seat?: number | null
          debtor_seat: number
          id?: string
          match_id: string
          queued_at?: string
        }
        Update: {
          amount?: number
          creditor_seat?: number | null
          debtor_seat?: number
          id?: string
          match_id?: string
          queued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_debt_queue_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_match_results"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "city_debt_queue_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      city_match_players: {
        Row: {
          cash: number
          consecutive_autopilot_turns: number
          detention_turns: number
          disconnected_at: string | null
          final_net_worth: number | null
          id: string
          in_detention: boolean
          is_ready: boolean
          joined_at: string
          match_id: string
          pending_creditor_seat: number | null
          pending_debt: number
          position: number
          seat: number
          status: string
          time_reserve_ms: number
          transit_visas: number
          user_id: string
          username: string
        }
        Insert: {
          cash?: number
          consecutive_autopilot_turns?: number
          detention_turns?: number
          disconnected_at?: string | null
          final_net_worth?: number | null
          id?: string
          in_detention?: boolean
          is_ready?: boolean
          joined_at?: string
          match_id: string
          pending_creditor_seat?: number | null
          pending_debt?: number
          position?: number
          seat: number
          status?: string
          time_reserve_ms?: number
          transit_visas?: number
          user_id: string
          username: string
        }
        Update: {
          cash?: number
          consecutive_autopilot_turns?: number
          detention_turns?: number
          disconnected_at?: string | null
          final_net_worth?: number | null
          id?: string
          in_detention?: boolean
          is_ready?: boolean
          joined_at?: string
          match_id?: string
          pending_creditor_seat?: number | null
          pending_debt?: number
          position?: number
          seat?: number
          status?: string
          time_reserve_ms?: number
          transit_visas?: number
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_match_results"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "city_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      city_matches: {
        Row: {
          bp_draw: number
          building_supply_limit: number | null
          cf_draw: number
          created_at: string
          created_by: string
          current_seat: number | null
          doubles_count: number
          finished_at: string | null
          id: string
          last_roll: number[] | null
          last_roll_result: Json | null
          last_roll_turn: number | null
          mode: string
          pace_seconds: number
          paused_at: string | null
          phase: string | null
          rng_counter: number
          rng_seed: number
          room_code: string
          started_at: string | null
          status: string
          time_limit_minutes: number | null
          trade_pause_ms_used: number
          trade_pause_started_at: string | null
          turn_clock_elapsed_ms: number
          turn_clock_paused_at: string | null
          turn_number: number
          turn_started_at: string | null
        }
        Insert: {
          bp_draw?: number
          building_supply_limit?: number | null
          cf_draw?: number
          created_at?: string
          created_by: string
          current_seat?: number | null
          doubles_count?: number
          finished_at?: string | null
          id?: string
          last_roll?: number[] | null
          last_roll_result?: Json | null
          last_roll_turn?: number | null
          mode?: string
          pace_seconds?: number
          paused_at?: string | null
          phase?: string | null
          rng_counter?: number
          rng_seed: number
          room_code: string
          started_at?: string | null
          status?: string
          time_limit_minutes?: number | null
          trade_pause_ms_used?: number
          trade_pause_started_at?: string | null
          turn_clock_elapsed_ms?: number
          turn_clock_paused_at?: string | null
          turn_number?: number
          turn_started_at?: string | null
        }
        Update: {
          bp_draw?: number
          building_supply_limit?: number | null
          cf_draw?: number
          created_at?: string
          created_by?: string
          current_seat?: number | null
          doubles_count?: number
          finished_at?: string | null
          id?: string
          last_roll?: number[] | null
          last_roll_result?: Json | null
          last_roll_turn?: number | null
          mode?: string
          pace_seconds?: number
          paused_at?: string | null
          phase?: string | null
          rng_counter?: number
          rng_seed?: number
          room_code?: string
          started_at?: string | null
          status?: string
          time_limit_minutes?: number | null
          trade_pause_ms_used?: number
          trade_pause_started_at?: string | null
          turn_clock_elapsed_ms?: number
          turn_clock_paused_at?: string | null
          turn_number?: number
          turn_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_matches_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
      city_trade_offers: {
        Row: {
          created_at: string
          created_turn: number
          expires_at: string
          from_seat: number
          get_cash: number
          get_spaces: number[]
          give_cash: number
          give_spaces: number[]
          id: string
          match_id: string
          queued: boolean
          resolved_at: string | null
          status: string
          to_seat: number
        }
        Insert: {
          created_at?: string
          created_turn: number
          expires_at: string
          from_seat: number
          get_cash?: number
          get_spaces?: number[]
          give_cash?: number
          give_spaces?: number[]
          id?: string
          match_id: string
          queued?: boolean
          resolved_at?: string | null
          status?: string
          to_seat: number
        }
        Update: {
          created_at?: string
          created_turn?: number
          expires_at?: string
          from_seat?: number
          get_cash?: number
          get_spaces?: number[]
          give_cash?: number
          give_spaces?: number[]
          id?: string
          match_id?: string
          queued?: boolean
          resolved_at?: string | null
          status?: string
          to_seat?: number
        }
        Relationships: [
          {
            foreignKeyName: "city_trade_offers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_match_results"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "city_trade_offers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "city_matches"
            referencedColumns: ["id"]
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
      city_match_results: {
        Row: {
          final_net_worth: number | null
          finished_at: string | null
          match_id: string | null
          mode: string | null
          place: number | null
          room_code: string | null
          seat: number | null
          status: string | null
          username: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_matches_room_code_fkey"
            columns: ["room_code"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["code"]
          },
        ]
      }
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
      city_accept_trade: { Args: { p_offer_id: string }; Returns: Json }
      city_advance_turn: { Args: { p_match_id: string }; Returns: number }
      city_apply_card: {
        Args: {
          p_card: Database["public"]["Tables"]["city_cards"]["Row"]
          p_dice_total: number
          p_match_id: string
          p_seat: number
        }
        Returns: Json
      }
      city_assert_can_manage: {
        Args: {
          p_allow_off_turn_debt?: boolean
          p_block_required_decision?: boolean
          p_match_id: string
          p_user_id: string
        }
        Returns: {
          cash: number
          consecutive_autopilot_turns: number
          detention_turns: number
          disconnected_at: string | null
          final_net_worth: number | null
          id: string
          in_detention: boolean
          is_ready: boolean
          joined_at: string
          match_id: string
          pending_creditor_seat: number | null
          pending_debt: number
          position: number
          seat: number
          status: string
          time_reserve_ms: number
          transit_visas: number
          user_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "city_match_players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      city_bankrupt_seat: {
        Args: { p_creditor_seat: number; p_match_id: string; p_seat: number }
        Returns: undefined
      }
      city_build: {
        Args: { p_match_id: string; p_space_idx: number }
        Returns: Json
      }
      city_buy_property: { Args: { p_match_id: string }; Returns: Json }
      city_charge: {
        Args: {
          p_amount: number
          p_creditor_seat: number
          p_match_id: string
          p_seat: number
        }
        Returns: Json
      }
      city_claim_timeout: { Args: { p_match_id: string }; Returns: Json }
      city_create_match: {
        Args: {
          p_mode?: string
          p_pace_seconds?: number
          p_room_code: string
          p_seed?: number
          p_time_limit_minutes?: number
        }
        Returns: string
      }
      city_declare_bankruptcy: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      city_decline_purchase: { Args: { p_match_id: string }; Returns: Json }
      city_decline_purchase_core: {
        Args: { p_match_id: string; p_seat: number }
        Returns: Json
      }
      city_derive_dice: {
        Args: { p_counter: number; p_seed: number }
        Returns: number[]
      }
      city_draw_card: {
        Args: { p_deck: string; p_match_id: string }
        Returns: {
          deck: string
          effect: Json
          id: number
          text: string
        }
        SetofOptions: {
          from: "*"
          to: "city_cards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      city_end_turn: { Args: { p_match_id: string }; Returns: Json }
      city_end_turn_core: {
        Args: { p_match_id: string; p_seat: number }
        Returns: Json
      }
      city_finish_match: {
        Args: { p_match_id: string; p_reason: string }
        Returns: Json
      }
      city_join_seat: {
        Args: { p_match_id: string; p_username: string }
        Returns: number
      }
      city_leave_detention: {
        Args: { p_match_id: string; p_method: string }
        Returns: Json
      }
      city_leave_detention_core: {
        Args: { p_match_id: string; p_method: string; p_seat: number }
        Returns: Json
      }
      city_leave_seat: { Args: { p_match_id: string }; Returns: undefined }
      city_liquidate_for_debt: {
        Args: { p_match_id: string; p_seat: number }
        Returns: boolean
      }
      city_max_liquidation: {
        Args: { p_match_id: string; p_seat: number }
        Returns: number
      }
      city_maybe_resume_trade_clock: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      city_mortgage: {
        Args: { p_match_id: string; p_space_idx: number }
        Returns: Json
      }
      city_mortgage_core: {
        Args: { p_match_id: string; p_seat: number; p_space_idx: number }
        Returns: Json
      }
      city_net_worth: {
        Args: { p_match_id: string; p_seat: number }
        Returns: number
      }
      city_pass_auction: { Args: { p_match_id: string }; Returns: Json }
      city_place_bid: {
        Args: { p_amount: number; p_match_id: string }
        Returns: Json
      }
      city_propose_trade: {
        Args: {
          p_get_cash?: number
          p_get_spaces: number[]
          p_give_cash?: number
          p_give_spaces: number[]
          p_match_id: string
          p_to_seat: number
        }
        Returns: string
      }
      city_rate_limit_check: {
        Args: { p_room_code: string; p_user_id: string }
        Returns: undefined
      }
      city_rent_for: {
        Args: { p_dice_total: number; p_match_id: string; p_space_idx: number }
        Returns: number
      }
      city_resolve_autopilot_turn: {
        Args: { p_match_id: string; p_seat: number }
        Returns: string
      }
      city_resolve_landing: {
        Args: {
          p_dice_total: number
          p_flat_rent_multiplier?: number
          p_match_id: string
          p_rent_multiplier?: number
          p_seat: number
          p_space_idx: number
        }
        Returns: Json
      }
      city_resolve_trade: {
        Args: { p_action: string; p_offer_id: string }
        Returns: undefined
      }
      city_retire_seat: {
        Args: { p_match_id: string; p_seat: number }
        Returns: undefined
      }
      city_retire_self: { Args: { p_match_id: string }; Returns: undefined }
      city_roll_dice: { Args: { p_match_id: string }; Returns: Json }
      city_roll_dice_core: {
        Args: { p_match_id: string; p_seat: number }
        Returns: Json
      }
      city_run_autopilot_from_current: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      city_sell_building: {
        Args: { p_match_id: string; p_space_idx: number }
        Returns: Json
      }
      city_sell_building_core: {
        Args: { p_match_id: string; p_seat: number; p_space_idx: number }
        Returns: Json
      }
      city_set_ready: {
        Args: { p_match_id: string; p_ready: boolean }
        Returns: undefined
      }
      city_settle_auction:
        | { Args: { p_match_id: string }; Returns: Json }
        | { Args: { p_force?: boolean; p_match_id: string }; Returns: Json }
      city_space_is_tradeable: {
        Args: { p_match_id: string; p_space_idx: number }
        Returns: boolean
      }
      city_start_match: { Args: { p_match_id: string }; Returns: undefined }
      city_try_settle_debt: {
        Args: { p_match_id: string; p_seat: number }
        Returns: boolean
      }
      city_unmortgage: {
        Args: { p_match_id: string; p_space_idx: number }
        Returns: Json
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
      is_seated_in_match: {
        Args: { p_match_id: string; p_user_id: string }
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

