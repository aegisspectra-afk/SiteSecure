// Generated from V2 Supabase project. Do not hand-edit.

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      after_action_reports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          narrative: string | null
          payload: Json
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          narrative?: string | null
          payload?: Json
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          narrative?: string | null
          payload?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "after_action_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "after_action_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "after_action_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["assignment_resource_type"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          resource_id: string
          resource_type: Database["public"]["Enums"]["assignment_resource_type"]
          user_id: string
          workspace_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["assignment_resource_type"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip: unknown
          metadata: Json
          user_agent: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          user_agent?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip?: unknown
          metadata?: Json
          user_agent?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          id: string
          label_he: string
          required: boolean
          sort_order: number
          template_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          label_he: string
          required?: boolean
          sort_order?: number
          template_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          label_he?: string
          required?: boolean
          sort_order?: number
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_template_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          id: string
          key: string
          name_he: string
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          name_he: string
          workspace_id: string
        }
        Update: {
          id?: string
          key?: string
          name_he?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_activities: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          phone: string | null
          role_title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          role_title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          billing_address: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          display_name: string
          email: string | null
          id: string
          legal_name: string | null
          notes: string | null
          phone: string | null
          status: Database["public"]["Enums"]["customer_status"]
          tax_id: string | null
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          billing_address?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name: string
          email?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tax_id?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          billing_address?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tax_id?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          byte_size: number | null
          captured_at: string | null
          checksum: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string | null
          original_filename: string | null
          storage_bucket: string
          storage_path: string
          workspace_id: string
        }
        Insert: {
          byte_size?: number | null
          captured_at?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["document_entity_type"]
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          original_filename?: string | null
          storage_bucket: string
          storage_path: string
          workspace_id: string
        }
        Update: {
          byte_size?: number | null
          captured_at?: string | null
          checksum?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["document_entity_type"]
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          original_filename?: string | null
          storage_bucket?: string
          storage_path?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          category: Database["public"]["Enums"]["equipment_category"]
          created_at: string
          id: string
          installed_at: string | null
          ip: string | null
          location_note: string | null
          mac: string | null
          manufacturer: string | null
          model: string | null
          name: string
          serial: string | null
          site_id: string
          status: Database["public"]["Enums"]["equipment_status"]
          system_id: string | null
          updated_at: string
          workspace_id: string
          zone_id: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string
          id?: string
          installed_at?: string | null
          ip?: string | null
          location_note?: string | null
          mac?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          serial?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["equipment_status"]
          system_id?: string | null
          updated_at?: string
          workspace_id: string
          zone_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["equipment_category"]
          created_at?: string
          id?: string
          installed_at?: string | null
          ip?: string | null
          location_note?: string | null
          mac?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          serial?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["equipment_status"]
          system_id?: string | null
          updated_at?: string
          workspace_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "site_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          key: string
        }
        Insert: {
          key: string
        }
        Update: {
          key?: string
        }
        Relationships: []
      }
      idempotency_keys: {
        Row: {
          created_at: string
          key: string
          method: string
          path: string
          response_body: Json | null
          response_status: number | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          key: string
          method: string
          path: string
          response_body?: Json | null
          response_status?: number | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          key?: string
          method?: string
          path?: string
          response_body?: Json | null
          response_status?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role_key: string
          token_hash: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_key: string
          token_hash: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role_key?: string
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          id: string
          job_id: string
          label_he: string
          required: boolean
          sort_order: number
          workspace_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          job_id: string
          label_he: string
          required?: boolean
          sort_order?: number
          workspace_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          id?: string
          job_id?: string
          label_he?: string
          required?: boolean
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklist_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_checklist_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          kind: Database["public"]["Enums"]["job_kind"]
          number: string
          project_id: string | null
          scheduled_for: string | null
          service_call_id: string | null
          site_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          kind?: Database["public"]["Enums"]["job_kind"]
          number: string
          project_id?: string | null
          scheduled_for?: string | null
          service_call_id?: string | null
          site_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["job_kind"]
          number?: string
          project_id?: string | null
          scheduled_for?: string | null
          service_call_id?: string | null
          site_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_call_id_fkey"
            columns: ["service_call_id"]
            isOneToOne: false
            referencedRelation: "service_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_articles: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          contact_name: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          id: string
          notes: string | null
          owner_user_id: string | null
          phone: string | null
          site_id: string | null
          source: Database["public"]["Enums"]["lead_source"]
          status: Database["public"]["Enums"]["lead_status"]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          site_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_user_id?: string | null
          phone?: string | null
          site_id?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          status?: Database["public"]["Enums"]["lead_status"]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          event_type: string
          in_app: boolean
          push: boolean
          user_id: string
          workspace_id: string
        }
        Insert: {
          email?: boolean
          event_type: string
          in_app?: boolean
          push?: boolean
          user_id: string
          workspace_id: string
        }
        Update: {
          email?: boolean
          event_type?: string
          in_app?: boolean
          push?: boolean
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
          read_at: string | null
          recipient_user_id: string
          title: string
          type: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id: string
          title: string
          type: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          description: string | null
          group_key: string
          key: string
        }
        Insert: {
          description?: string | null
          group_key: string
          key: string
        }
        Update: {
          description?: string | null
          group_key?: string
          key?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          feature_key: string
          plan_key: string
        }
        Insert: {
          feature_key: string
          plan_key: string
        }
        Update: {
          feature_key?: string
          plan_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_features_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      plan_limits: {
        Row: {
          limit_key: string
          limit_value: number
          plan_key: string
        }
        Insert: {
          limit_key: string
          limit_value: number
          plan_key: string
        }
        Update: {
          limit_key?: string
          limit_value?: number
          plan_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      plans: {
        Row: {
          is_public: boolean
          key: string
          label_en: string
          label_he: string
        }
        Insert: {
          is_public?: boolean
          key: string
          label_en: string
          label_he: string
        }
        Update: {
          is_public?: boolean
          key?: string
          label_en?: string
          label_he?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          id: string
          key: string
          name_he: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          name_he: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          id?: string
          key?: string
          name_he?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          id: string
          is_active: boolean
          is_labor: boolean
          list_price: number
          metadata: Json
          name: string
          sku: string
          unit: string
          updated_at: string
          vat_eligible: boolean
          workspace_id: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_labor?: boolean
          list_price?: number
          metadata?: Json
          name: string
          sku: string
          unit?: string
          updated_at?: string
          vat_eligible?: boolean
          workspace_id: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_labor?: boolean
          list_price?: number
          metadata?: Json
          name?: string
          sku?: string
          unit?: string
          updated_at?: string
          vat_eligible?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string
          id: string
          last_workspace_id: string | null
          locale: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id: string
          last_workspace_id?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string
          id?: string
          last_workspace_id?: string | null
          locale?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_last_workspace_id_fkey"
            columns: ["last_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          name: string
          site_id: string | null
          source_quote_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          name: string
          site_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          name?: string
          site_id?: string | null
          source_quote_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          quote_id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          quote_id: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          quote_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          cost: number
          description: string
          discount: number
          id: string
          item_type: Database["public"]["Enums"]["quote_item_type"]
          line_net: number
          product_id: string | null
          qty: number
          quote_id: string
          sort_order: number
          unit_price: number
          workspace_id: string
        }
        Insert: {
          cost?: number
          description?: string
          discount?: number
          id?: string
          item_type?: Database["public"]["Enums"]["quote_item_type"]
          line_net?: number
          product_id?: string | null
          qty?: number
          quote_id: string
          sort_order?: number
          unit_price?: number
          workspace_id: string
        }
        Update: {
          cost?: number
          description?: string
          discount?: number
          id?: string
          item_type?: Database["public"]["Enums"]["quote_item_type"]
          line_net?: number
          product_id?: string | null
          qty?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_template_items: {
        Row: {
          description: string
          id: string
          product_id: string | null
          qty: number
          sort_order: number
          template_id: string
          workspace_id: string
        }
        Insert: {
          description: string
          id?: string
          product_id?: string | null
          qty?: number
          sort_order?: number
          template_id: string
          workspace_id: string
        }
        Update: {
          description?: string
          id?: string
          product_id?: string | null
          qty?: number
          sort_order?: number
          template_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_template_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "quote_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_template_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_templates: {
        Row: {
          id: string
          key: string
          name_he: string
          workspace_id: string
        }
        Insert: {
          id?: string
          key: string
          name_he: string
          workspace_id: string
        }
        Update: {
          id?: string
          key?: string
          name_he?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          quote_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          quote_id: string
          snapshot: Json
          version: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          quote_id?: string
          snapshot?: Json
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          cost_total: number
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          customer_notes: string | null
          deleted_at: string | null
          discount_type: string | null
          discount_value: number
          id: string
          internal_notes: string | null
          lead_id: string | null
          margin_amount: number
          margin_percent: number
          number: string
          owner_user_id: string | null
          payment_terms: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal_net: number
          total_gross: number
          updated_at: string
          valid_until: string | null
          vat_amount: number
          vat_percent: number
          version: number
          workspace_id: string
        }
        Insert: {
          cost_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          margin_amount?: number
          margin_percent?: number
          number: string
          owner_user_id?: string | null
          payment_terms?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_net?: number
          total_gross?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
          vat_percent?: number
          version?: number
          workspace_id: string
        }
        Update: {
          cost_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          customer_notes?: string | null
          deleted_at?: string | null
          discount_type?: string | null
          discount_value?: number
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          margin_amount?: number
          margin_percent?: number
          number?: string
          owner_user_id?: string | null
          payment_terms?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal_net?: number
          total_gross?: number
          updated_at?: string
          valid_until?: string | null
          vat_amount?: number
          vat_percent?: number
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_key: string
          role_key: string
        }
        Insert: {
          permission_key: string
          role_key: string
        }
        Update: {
          permission_key?: string
          role_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_permissions_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          default_scope: string
          is_system: boolean
          key: string
          label_en: string
          label_he: string
        }
        Insert: {
          default_scope: string
          is_system?: boolean
          key: string
          label_en: string
          label_he: string
        }
        Update: {
          default_scope?: string
          is_system?: boolean
          key?: string
          label_en?: string
          label_he?: string
        }
        Relationships: []
      }
      service_calls: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["service_call_priority"]
          site_id: string
          status: Database["public"]["Enums"]["service_call_status"]
          system_id: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["service_call_priority"]
          site_id: string
          status?: Database["public"]["Enums"]["service_call_status"]
          system_id?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["service_call_priority"]
          site_id?: string
          status?: Database["public"]["Enums"]["service_call_status"]
          system_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_calls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          created_at: string
          customer_id: string
          ends_on: string | null
          id: string
          plan: Database["public"]["Enums"]["service_contract_plan"]
          site_id: string | null
          starts_on: string | null
          status: Database["public"]["Enums"]["service_contract_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          ends_on?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["service_contract_plan"]
          site_id?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["service_contract_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          ends_on?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["service_contract_plan"]
          site_id?: string | null
          starts_on?: string | null
          status?: Database["public"]["Enums"]["service_contract_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_readiness: {
        Row: {
          access_control: number | null
          alarm: number | null
          cctv: number | null
          connectivity: number | null
          network: number | null
          notes: string | null
          power: number | null
          recording: number | null
          site_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_control?: number | null
          alarm?: number | null
          cctv?: number | null
          connectivity?: number | null
          network?: number | null
          notes?: string | null
          power?: number | null
          recording?: number | null
          site_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_control?: number | null
          alarm?: number | null
          cctv?: number | null
          connectivity?: number | null
          network?: number | null
          notes?: string | null
          power?: number | null
          recording?: number | null
          site_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_readiness_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_readiness_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_timeline_events: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id: string
          site_id: string
          source_id: string | null
          source_type: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          site_id: string
          source_id?: string | null
          source_type?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["timeline_event_type"]
          id?: string
          site_id?: string
          source_id?: string | null
          source_type?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_timeline_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_timeline_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_timeline_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      site_zones: {
        Row: {
          created_at: string
          id: string
          name: string
          site_id: string
          sort_order: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          site_id: string
          sort_order?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          site_id?: string
          sort_order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_zones_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_zones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          access_notes: string | null
          address: Json
          code: string
          created_at: string
          created_by: string | null
          customer_id: string
          deleted_at: string | null
          id: string
          installation_status: Database["public"]["Enums"]["site_installation_status"]
          name: string
          public_token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_notes?: string | null
          address?: Json
          code: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          installation_status?: Database["public"]["Enums"]["site_installation_status"]
          name: string
          public_token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_notes?: string | null
          address?: Json
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          installation_status?: Database["public"]["Enums"]["site_installation_status"]
          name?: string
          public_token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan_key: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_key?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          created_at: string
          id: string
          manufacturer: string | null
          metadata: Json
          model: string | null
          name: string
          panel_id: string | null
          site_id: string
          status: Database["public"]["Enums"]["system_status"]
          type: Database["public"]["Enums"]["system_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name: string
          panel_id?: string | null
          site_id: string
          status?: Database["public"]["Enums"]["system_status"]
          type: Database["public"]["Enums"]["system_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manufacturer?: string | null
          metadata?: Json
          model?: string | null
          name?: string
          panel_id?: string | null
          site_id?: string
          status?: Database["public"]["Enums"]["system_status"]
          type?: Database["public"]["Enums"]["system_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "systems_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "systems_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          due_at: string | null
          id: string
          job_id: string | null
          lead_id: string | null
          quote_id: string | null
          site_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          lead_id?: string | null
          quote_id?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          due_at?: string | null
          id?: string
          job_id?: string | null
          lead_id?: string | null
          quote_id?: string | null
          site_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          created_at: string
          customer_id: string
          document_id: string | null
          ends_on: string
          id: string
          number: string
          public_token: string
          site_id: string
          starts_on: string
          status: Database["public"]["Enums"]["warranty_status"]
          type: Database["public"]["Enums"]["warranty_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          document_id?: string | null
          ends_on: string
          id?: string
          number: string
          public_token?: string
          site_id: string
          starts_on: string
          status?: Database["public"]["Enums"]["warranty_status"]
          type?: Database["public"]["Enums"]["warranty_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          document_id?: string | null
          ends_on?: string
          id?: string
          number?: string
          public_token?: string
          site_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["warranty_status"]
          type?: Database["public"]["Enums"]["warranty_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_counters: {
        Row: {
          kind: string
          last_value: number
          workspace_id: string
        }
        Insert: {
          kind: string
          last_value?: number
          workspace_id: string
        }
        Update: {
          kind?: string
          last_value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_feature_overrides: {
        Row: {
          enabled: boolean
          feature_key: string
          workspace_id: string
        }
        Insert: {
          enabled: boolean
          feature_key: string
          workspace_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_feature_overrides_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "workspace_feature_overrides_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_memberships: {
        Row: {
          created_at: string
          id: string
          program_ends_at: string | null
          program_started_at: string | null
          program_type: string | null
          role_key: string
          status: Database["public"]["Enums"]["membership_status"]
          technician_code: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          program_ends_at?: string | null
          program_started_at?: string | null
          program_type?: string | null
          role_key: string
          status?: Database["public"]["Enums"]["membership_status"]
          technician_code?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          program_ends_at?: string | null
          program_started_at?: string | null
          program_type?: string | null
          role_key?: string
          status?: Database["public"]["Enums"]["membership_status"]
          technician_code?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_memberships_role_key_fkey"
            columns: ["role_key"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "workspace_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          branding: Json
          created_at: string
          localization: Json
          notifications: Json
          quotes: Json
          scheduling: Json
          taxes: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          localization?: Json
          notifications?: Json
          quotes?: Json
          scheduling?: Json
          taxes?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          branding?: Json
          created_at?: string
          localization?: Json
          notifications?: Json
          quotes?: Json
          scheduling?: Json
          taxes?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          country_code: string
          created_at: string
          id: string
          name: string
          slug: string | null
          status: Database["public"]["Enums"]["workspace_status"]
          timezone: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          country_code?: string
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          status?: Database["public"]["Enums"]["workspace_status"]
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["workspace_status"]
          timezone?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      auth_assigned: {
        Args: {
          p_resource_id: string
          p_resource_type: Database["public"]["Enums"]["assignment_resource_type"]
          p_workspace_id: string
        }
        Returns: boolean
      }
      auth_customer_visible: {
        Args: { p_customer_id: string; p_workspace_id: string }
        Returns: boolean
      }
      auth_feature: {
        Args: { p_feature_key: string; p_workspace_id: string }
        Returns: boolean
      }
      auth_is_assigned_scope: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      auth_is_managerial: { Args: { p_workspace_id: string }; Returns: boolean }
      auth_is_member: { Args: { p_workspace_id: string }; Returns: boolean }
      auth_is_privileged: { Args: { p_workspace_id: string }; Returns: boolean }
      auth_job_visible: {
        Args: { p_job_id: string; p_workspace_id: string }
        Returns: boolean
      }
      auth_role: { Args: { p_workspace_id: string }; Returns: string }
      auth_role_in: {
        Args: { p_keys: string[]; p_workspace_id: string }
        Returns: boolean
      }
      auth_site_visible: {
        Args: { p_site_id: string; p_workspace_id: string }
        Returns: boolean
      }
      auth_workspace_ids: { Args: never; Returns: string[] }
      create_workspace: {
        Args: { p_name: string; p_plan_key?: string }
        Returns: string
      }
      my_workspace_entitlements: {
        Args: { p_workspace_id: string }
        Returns: Json
      }
      next_code: {
        Args: { p_kind: string; p_workspace_id: string }
        Returns: number
      }
      peek_invitation: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          role_key: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      seed_workspace_defaults: {
        Args: { p_workspace_id: string }
        Returns: undefined
      }
      token_sha256: { Args: { p_token: string }; Returns: string }
    }
    Enums: {
      activity_type: "note" | "call" | "meeting" | "quote" | "job" | "other"
      assignment_resource_type:
        | "site"
        | "job"
        | "project"
        | "service_call"
        | "customer"
      customer_status: "active" | "inactive"
      customer_type: "private" | "business"
      document_entity_type:
        | "customer"
        | "site"
        | "system"
        | "job"
        | "quote"
        | "project"
        | "warranty"
      document_kind: "document" | "photo" | "signature" | "pdf_export"
      equipment_category:
        | "camera"
        | "pir"
        | "nvr"
        | "dvr"
        | "panel"
        | "reader"
        | "lock"
        | "switch"
        | "cable"
        | "sim"
        | "power"
        | "other"
      equipment_status: "planned" | "installed" | "replaced" | "removed"
      job_kind: "installation" | "service" | "maintenance" | "survey" | "other"
      job_status:
        | "scheduled"
        | "en_route"
        | "in_progress"
        | "completed"
        | "cancelled"
      lead_source:
        | "website"
        | "referral"
        | "advertising"
        | "phone"
        | "other"
        | "manual"
      lead_status:
        | "new"
        | "contacted"
        | "meeting"
        | "spec"
        | "quoted"
        | "follow_up"
        | "won"
        | "lost"
      membership_status: "active" | "disabled"
      project_status:
        | "draft"
        | "planned"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "cancelled"
      quote_item_type: "catalog" | "free" | "labor" | "note"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "approved"
        | "rejected"
        | "expired"
        | "cancelled"
      service_call_priority: "low" | "normal" | "high" | "critical"
      service_call_status: "open" | "in_progress" | "waiting" | "closed"
      service_contract_plan: "basic" | "plus" | "pro"
      service_contract_status: "active" | "paused" | "ended"
      site_installation_status:
        | "planned"
        | "in_progress"
        | "completed"
        | "inactive"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "manual"
      system_status: "planned" | "active" | "inactive" | "decommissioned"
      system_type:
        | "alarm"
        | "cctv"
        | "access"
        | "network"
        | "intercom"
        | "other"
      task_status: "open" | "done" | "cancelled"
      task_type:
        | "follow_up"
        | "call"
        | "visit"
        | "review_request"
        | "service_followup"
        | "maintenance"
        | "other"
      timeline_event_type:
        | "created"
        | "updated"
        | "job"
        | "service"
        | "quote"
        | "warranty"
        | "document"
        | "note"
        | "system"
      warranty_status: "active" | "expiring_soon" | "expired" | "cancelled"
      warranty_type:
        | "manufacturer"
        | "installation"
        | "extended"
        | "maintenance_contract"
      workspace_status: "active" | "suspended" | "pending_deletion"
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
  public: {
    Enums: {
      activity_type: ["note", "call", "meeting", "quote", "job", "other"],
      assignment_resource_type: [
        "site",
        "job",
        "project",
        "service_call",
        "customer",
      ],
      customer_status: ["active", "inactive"],
      customer_type: ["private", "business"],
      document_entity_type: [
        "customer",
        "site",
        "system",
        "job",
        "quote",
        "project",
        "warranty",
      ],
      document_kind: ["document", "photo", "signature", "pdf_export"],
      equipment_category: [
        "camera",
        "pir",
        "nvr",
        "dvr",
        "panel",
        "reader",
        "lock",
        "switch",
        "cable",
        "sim",
        "power",
        "other",
      ],
      equipment_status: ["planned", "installed", "replaced", "removed"],
      job_kind: ["installation", "service", "maintenance", "survey", "other"],
      job_status: [
        "scheduled",
        "en_route",
        "in_progress",
        "completed",
        "cancelled",
      ],
      lead_source: [
        "website",
        "referral",
        "advertising",
        "phone",
        "other",
        "manual",
      ],
      lead_status: [
        "new",
        "contacted",
        "meeting",
        "spec",
        "quoted",
        "follow_up",
        "won",
        "lost",
      ],
      membership_status: ["active", "disabled"],
      project_status: [
        "draft",
        "planned",
        "in_progress",
        "on_hold",
        "completed",
        "cancelled",
      ],
      quote_item_type: ["catalog", "free", "labor", "note"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "approved",
        "rejected",
        "expired",
        "cancelled",
      ],
      service_call_priority: ["low", "normal", "high", "critical"],
      service_call_status: ["open", "in_progress", "waiting", "closed"],
      service_contract_plan: ["basic", "plus", "pro"],
      service_contract_status: ["active", "paused", "ended"],
      site_installation_status: [
        "planned",
        "in_progress",
        "completed",
        "inactive",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "manual",
      ],
      system_status: ["planned", "active", "inactive", "decommissioned"],
      system_type: ["alarm", "cctv", "access", "network", "intercom", "other"],
      task_status: ["open", "done", "cancelled"],
      task_type: [
        "follow_up",
        "call",
        "visit",
        "review_request",
        "service_followup",
        "maintenance",
        "other",
      ],
      timeline_event_type: [
        "created",
        "updated",
        "job",
        "service",
        "quote",
        "warranty",
        "document",
        "note",
        "system",
      ],
      warranty_status: ["active", "expiring_soon", "expired", "cancelled"],
      warranty_type: [
        "manufacturer",
        "installation",
        "extended",
        "maintenance_contract",
      ],
      workspace_status: ["active", "suspended", "pending_deletion"],
    },
  },
} as const
