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
      availability: {
        Row: {
          available: boolean
          created_at: string
          ends_at: string
          external_event_id: string | null
          id: string
          professional_id: string | null
          source: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          ends_at: string
          external_event_id?: string | null
          id?: string
          professional_id?: string | null
          source?: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          ends_at?: string
          external_event_id?: string | null
          id?: string
          professional_id?: string | null
          source?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          answers: Json
          appointment_date: string
          appointment_time: string
          contact: string
          created_at: string
          customer_name: string
          deposit_paid_at: string | null
          flash_design_id: string | null
          flash_design_key: string | null
          id: string
          member_id: string
          notes: string
          phone: string
          professional_id: string | null
          quote: Json
          reference_paths: string[]
          service_id: string
          status: string
          updated_at: string
        }
        Insert: {
          answers?: Json
          appointment_date: string
          appointment_time: string
          contact: string
          created_at?: string
          customer_name: string
          deposit_paid_at?: string | null
          flash_design_id?: string | null
          flash_design_key?: string | null
          id?: string
          member_id?: string
          notes?: string
          phone?: string
          professional_id?: string | null
          quote?: Json
          reference_paths?: string[]
          service_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          appointment_date?: string
          appointment_time?: string
          contact?: string
          created_at?: string
          customer_name?: string
          deposit_paid_at?: string | null
          flash_design_id?: string | null
          flash_design_key?: string | null
          id?: string
          member_id?: string
          notes?: string
          phone?: string
          professional_id?: string | null
          quote?: Json
          reference_paths?: string[]
          service_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_flash_design_id_fkey"
            columns: ["flash_design_id"]
            isOneToOne: false
            referencedRelation: "flash_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_designs: {
        Row: {
          artist_id: string | null
          available: boolean
          created_at: string
          description: string
          duration_minutes: number
          id: string
          image_path: string
          price: number
          title: string
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          available?: boolean
          created_at?: string
          description?: string
          duration_minutes: number
          id?: string
          image_path: string
          price: number
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          available?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          image_path?: string
          price?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_designs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          active: boolean
          created_at: string
          end_time: string
          id: string
          initials: string
          max_session_minutes: number
          name: string
          role_title: string
          skills: string[]
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          initials: string
          max_session_minutes?: number
          name: string
          role_title: string
          skills?: string[]
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          active?: boolean
          created_at?: string
          end_time?: string
          id?: string
          initials?: string
          max_session_minutes?: number
          name?: string
          role_title?: string
          skills?: string[]
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_settings: {
        Row: {
          business_name: string
          config: Json | null
          currency: string
          id: string
          location: string
          policies: Json
          services: Json
          updated_at: string
        }
        Insert: {
          business_name: string
          config?: Json | null
          currency?: string
          id?: string
          location: string
          policies?: Json
          services?: Json
          updated_at?: string
        }
        Update: {
          business_name?: string
          config?: Json | null
          currency?: string
          id?: string
          location?: string
          policies?: Json
          services?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_initial_owner: { Args: never; Returns: boolean }
      create_booking_request: { Args: { p_booking: Json }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "staff" | "customer"
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
      app_role: ["owner", "staff", "customer"],
    },
  },
} as const
