/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env) ||
  (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zvojniiaftqwdaggfvma.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2b2puaWlhZnRxd2RhZ2dmdm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwNTE0MDYsImV4cCI6MjA4MzYyNzQwNn0.9Xht9Z_Bmfp05U6G-_JrETIqsE87RFd-JXQMpaHrmzM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
