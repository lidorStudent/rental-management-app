export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      leases: {
        Row: {
          created_at: string;
          deposit_amount_cents: number;
          end_date: string;
          id: string;
          landlord_id: string;
          rent_amount_cents: number;
          rent_due_day: number;
          start_date: string;
          tenant_profile_id: string | null;
          unit_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deposit_amount_cents?: number;
          end_date: string;
          id?: string;
          landlord_id: string;
          rent_amount_cents: number;
          rent_due_day: number;
          start_date: string;
          tenant_profile_id?: string | null;
          unit_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deposit_amount_cents?: number;
          end_date?: string;
          id?: string;
          landlord_id?: string;
          rent_amount_cents?: number;
          rent_due_day?: number;
          start_date?: string;
          tenant_profile_id?: string | null;
          unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leases_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leases_tenant_profile_id_fkey";
            columns: ["tenant_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leases_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_requests: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          landlord_id: string;
          lease_id: string;
          resolved_at: string | null;
          status: Database["public"]["Enums"]["maintenance_status"];
          submitted_by: string;
          tenant_confirmed_at: string | null;
          title: string;
          updated_at: string;
          urgency: Database["public"]["Enums"]["maintenance_urgency"];
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          landlord_id: string;
          lease_id: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_status"];
          submitted_by: string;
          tenant_confirmed_at?: string | null;
          title: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["maintenance_urgency"];
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          landlord_id?: string;
          lease_id?: string;
          resolved_at?: string | null;
          status?: Database["public"]["Enums"]["maintenance_status"];
          submitted_by?: string;
          tenant_confirmed_at?: string | null;
          title?: string;
          updated_at?: string;
          urgency?: Database["public"]["Enums"]["maintenance_urgency"];
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_requests_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "lease_rent_summary";
            referencedColumns: ["lease_id"];
          },
          {
            foreignKeyName: "maintenance_requests_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "leases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_requests_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          must_change_password: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          must_change_password?: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          must_change_password?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      properties: {
        Row: {
          address_line: string;
          city: string;
          created_at: string;
          id: string;
          landlord_id: string;
          name: string;
          postal_code: string | null;
          updated_at: string;
        };
        Insert: {
          address_line: string;
          city: string;
          created_at?: string;
          id?: string;
          landlord_id: string;
          name: string;
          postal_code?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string;
          city?: string;
          created_at?: string;
          id?: string;
          landlord_id?: string;
          name?: string;
          postal_code?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "properties_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rent_payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          id: string;
          landlord_id: string;
          lease_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          period_month: string;
          received_on: string;
          recorded_by: string;
          reference: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          id?: string;
          landlord_id: string;
          lease_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          period_month: string;
          received_on: string;
          recorded_by: string;
          reference?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          id?: string;
          landlord_id?: string;
          lease_id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          period_month?: string;
          received_on?: string;
          recorded_by?: string;
          reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rent_payments_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rent_payments_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "lease_rent_summary";
            referencedColumns: ["lease_id"];
          },
          {
            foreignKeyName: "rent_payments_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "leases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rent_payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      units: {
        Row: {
          bedroom_count: number | null;
          created_at: string;
          id: string;
          label: string;
          landlord_id: string;
          property_id: string;
          updated_at: string;
        };
        Insert: {
          bedroom_count?: number | null;
          created_at?: string;
          id?: string;
          label: string;
          landlord_id: string;
          property_id: string;
          updated_at?: string;
        };
        Update: {
          bedroom_count?: number | null;
          created_at?: string;
          id?: string;
          label?: string;
          landlord_id?: string;
          property_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "units_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "units_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      lease_period_totals: {
        Row: {
          lease_id: string | null;
          paid_cents: number | null;
          payment_count: number | null;
          period_month: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rent_payments_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "lease_rent_summary";
            referencedColumns: ["lease_id"];
          },
          {
            foreignKeyName: "rent_payments_lease_id_fkey";
            columns: ["lease_id"];
            isOneToOne: false;
            referencedRelation: "leases";
            referencedColumns: ["id"];
          },
        ];
      };
      lease_rent_summary: {
        Row: {
          end_date: string | null;
          landlord_id: string | null;
          last_received_on: string | null;
          lease_id: string | null;
          payment_count: number | null;
          property_id: string | null;
          property_name: string | null;
          rent_amount_cents: number | null;
          rent_due_day: number | null;
          start_date: string | null;
          tenant_full_name: string | null;
          tenant_profile_id: string | null;
          total_paid_cents: number | null;
          unit_id: string | null;
          unit_label: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leases_landlord_id_fkey";
            columns: ["landlord_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leases_tenant_profile_id_fkey";
            columns: ["tenant_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leases_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "units_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "properties";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      current_profile_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_current_tenant_active_lease: {
        Args: { target_lease_id: string };
        Returns: boolean;
      };
      is_current_tenant_lease: {
        Args: { target_lease_id: string };
        Returns: boolean;
      };
      is_current_tenant_property: {
        Args: { target_property_id: string };
        Returns: boolean;
      };
      is_current_tenant_unit: {
        Args: { target_unit_id: string };
        Returns: boolean;
      };
      landlord_of_current_tenant_lease: {
        Args: { target_lease_id: string };
        Returns: string;
      };
    };
    Enums: {
      maintenance_status: "submitted" | "acknowledged" | "in_progress" | "resolved";
      maintenance_urgency: "low" | "normal" | "urgent";
      payment_method: "bank_transfer" | "cash" | "cheque" | "card" | "other";
      user_role: "landlord" | "tenant";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      maintenance_status: ["submitted", "acknowledged", "in_progress", "resolved"],
      maintenance_urgency: ["low", "normal", "urgent"],
      payment_method: ["bank_transfer", "cash", "cheque", "card", "other"],
      user_role: ["landlord", "tenant"],
    },
  },
} as const;
