// Supabase Configuration and Initialization
import { createClient } from '@supabase/supabase-js';

// Your Supabase configuration
// TODO: Replace these values with your actual Supabase project configuration
// You can find these in Supabase Dashboard → Project Settings → API
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Initialize Supabase
let supabase = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      },
      global: {
        headers: {
          'x-client-info': 'coke-calculator'
        }
      }
    });
    console.log('✅ Supabase initialized successfully');
  } else {
    console.warn('⚠️ Supabase configuration missing. Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY');
  }
} catch (error) {
  console.error("Supabase initialization error:", error);
  supabase = null;
}

export { supabase };
export default supabase;
