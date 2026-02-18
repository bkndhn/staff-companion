import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple legacy hash for backward compatibility during migration
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const salt = str.length * 17 + 42;
  return Math.abs(hash + salt).toString(36);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to access password_hash securely server-side
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: user, error } = await supabase
      .from('app_users')
      .select('id, email, full_name, role, location, location_id, is_active, last_login, password_hash')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user || !user.password_hash) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine if hash is bcrypt (starts with $2b$ or $2a$) or legacy simpleHash
    const isBcrypt = user.password_hash.startsWith('$2b$') || user.password_hash.startsWith('$2a$');
    let passwordValid = false;

    if (isBcrypt) {
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy simpleHash check
      passwordValid = simpleHash(password) === user.password_hash;
    }

    if (!passwordValid) {
      return new Response(
        JSON.stringify({ error: 'Invalid credentials' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upgrade to bcrypt if still using legacy hash
    if (!isBcrypt) {
      const newHash = await bcrypt.hash(password);
      await supabase
        .from('app_users')
        .update({ password_hash: newHash, last_login: new Date().toISOString() })
        .eq('id', user.id);
    } else {
      await supabase
        .from('app_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);
    }

    // Return user without password_hash
    const { password_hash: _, ...safeUser } = user;
    return new Response(
      JSON.stringify({ user: safeUser }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Login error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
