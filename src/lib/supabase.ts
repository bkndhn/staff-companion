import { createClient } from '@supabase/supabase-js';

// Use env vars with fallback to the connected Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://nsmppwnpdxomjmgrtqka.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY 
  || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY 
  || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbXBwd25wZHhvbWptZ3J0cWthIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE1NDM3NjksImV4cCI6MjA2NzExOTc2OX0.gVzJ4uPAmFT5yngvdcFsHXHH1cUL-nIq0e71Gx8ALOk";

// Check if Supabase is properly configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DatabaseStaff {
  id: string;
  name: string;
  location: string;
  type: string;
  experience: string;
  basic_salary: number;
  incentive: number;
  hra: number;
  total_salary: number;
  joined_date: string;
  is_active: boolean;
  sunday_penalty: boolean;
  salary_calculation_days: number;
  salary_supplements: Record<string, number>;
  meal_allowance: number;
  display_order: number;
  contact_number?: string;
  address?: string;
  photo_url?: string;
  initial_salary?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseAttendance {
  id: string;
  staff_id: string;
  date: string;
  status: string;
  created_at: string;
  attendance_value?: number;
  is_part_time?: boolean;
  is_sunday?: boolean;
  staff_name?: string;
  location?: string;
  shift?: string;
  salary?: number;
  salary_override?: boolean;
  arrival_time?: string;
  leaving_time?: string;
}

export interface DatabaseAdvanceDeduction {
  id: string;
  staff_id: string;
  month: number;
  year: number;
  old_advance: number;
  current_advance: number;
  deduction: number;
  new_advance: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Alias for backward compat
export type DatabaseAdvance = DatabaseAdvanceDeduction;

export interface DatabaseOldStaffRecord {
  id: string;
  original_staff_id: string;
  name: string;
  location: string;
  type: string;
  experience: string;
  basic_salary: number;
  incentive: number;
  hra: number;
  total_salary: number;
  joined_date: string;
  left_date: string;
  reason: string;
  total_advance_outstanding: number;
  last_advance_data?: any;
  contact_number?: string;
  address?: string;
  photo_url?: string;
  created_at: string;
}
