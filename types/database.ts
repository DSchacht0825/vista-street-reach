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
      persons: {
        Row: {
          id: string
          client_id: string
          first_name: string
          last_name: string | null
          middle_name: string | null
          nickname: string | null
          aka: string | null
          date_of_birth: string | null
          gender: string | null
          race: string | null
          ethnicity: string | null
          veteran_status: boolean
          disability_status: boolean
          disability_type: string | null
          chronic_homeless: boolean
          living_situation: string | null
          length_of_time_homeless: string | null
          enrollment_date: string | null
          case_manager: string | null
          referral_source: string | null
          preferred_language: string | null
          cultural_lived_experience: string | null
          contact_count: number
          last_contact: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id?: string
          first_name: string
          last_name?: string | null
          middle_name?: string | null
          nickname?: string | null
          aka?: string | null
          date_of_birth?: string | null
          gender?: string | null
          race?: string | null
          ethnicity?: string | null
          veteran_status?: boolean
          disability_status?: boolean
          disability_type?: string | null
          chronic_homeless?: boolean
          living_situation?: string | null
          length_of_time_homeless?: string | null
          enrollment_date?: string | null
          case_manager?: string | null
          referral_source?: string | null
          preferred_language?: string | null
          cultural_lived_experience?: string | null
          contact_count?: number
          last_contact?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          first_name?: string
          last_name?: string | null
          middle_name?: string | null
          nickname?: string | null
          aka?: string | null
          date_of_birth?: string | null
          gender?: string | null
          race?: string | null
          ethnicity?: string | null
          veteran_status?: boolean
          disability_status?: boolean
          disability_type?: string | null
          chronic_homeless?: boolean
          living_situation?: string | null
          length_of_time_homeless?: string | null
          enrollment_date?: string | null
          case_manager?: string | null
          referral_source?: string | null
          preferred_language?: string | null
          cultural_lived_experience?: string | null
          contact_count?: number
          last_contact?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      encounters: {
        Row: {
          id: string
          person_id: string
          service_date: string
          outreach_location: string
          latitude: number
          longitude: number
          outreach_worker: string
          referral_source: string | null
          language_preference: string | null
          cultural_notes: string | null
          co_occurring_mh_sud: boolean
          co_occurring_type: string | null
          transportation_provided: boolean
          shower_trailer: boolean
          other_services: string | null
          placement_made: boolean
          placement_location: string | null
          placement_location_other: string | null
          refused_shelter: boolean
          refused_services: boolean
          high_utilizer_contact: boolean
          case_management_notes: string | null
          photo_urls: string[] | null
          follow_up: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          person_id: string
          service_date: string
          outreach_location: string
          latitude: number
          longitude: number
          outreach_worker: string
          referral_source?: string | null
          language_preference?: string | null
          cultural_notes?: string | null
          co_occurring_mh_sud?: boolean
          co_occurring_type?: string | null
          transportation_provided?: boolean
          shower_trailer?: boolean
          other_services?: string | null
          placement_made?: boolean
          placement_location?: string | null
          placement_location_other?: string | null
          refused_shelter?: boolean
          refused_services?: boolean
          high_utilizer_contact?: boolean
          case_management_notes?: string | null
          photo_urls?: string[] | null
          follow_up?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          service_date?: string
          outreach_location?: string
          latitude?: number
          longitude?: number
          outreach_worker?: string
          referral_source?: string | null
          language_preference?: string | null
          cultural_notes?: string | null
          co_occurring_mh_sud?: boolean
          co_occurring_type?: string | null
          transportation_provided?: boolean
          shower_trailer?: boolean
          other_services?: string | null
          placement_made?: boolean
          placement_location?: string | null
          placement_location_other?: string | null
          refused_shelter?: boolean
          refused_services?: boolean
          high_utilizer_contact?: boolean
          case_management_notes?: string | null
          photo_urls?: string[] | null
          follow_up?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'field_worker'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'admin' | 'field_worker'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'admin' | 'field_worker'
          created_at?: string
          updated_at?: string
        }
      }
      status_changes: {
        Row: {
          id: string
          person_id: string
          change_type: 'exit' | 'return_to_active'
          change_date: string
          exit_destination: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          person_id: string
          change_type: 'exit' | 'return_to_active'
          change_date?: string
          exit_destination?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          person_id?: string
          change_type?: 'exit' | 'return_to_active'
          change_date?: string
          exit_destination?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
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
  }
}
