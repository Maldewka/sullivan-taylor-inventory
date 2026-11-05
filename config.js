// Supabase connection settings for Sullivan Taylor Uptown Inventory.
// Find both values in the Supabase dashboard: Project Settings -> API (or "Connect" / "API Keys").
//   SUPABASE_URL      = the "Project URL", like https://abcdefghijklmnop.supabase.co
//   SUPABASE_ANON_KEY = the "anon public" key (or the newer "publishable" key, starts with sb_publishable_).
// Both are meant to be public in a web page; your data is protected by sign-in plus the row-level
// security rules in supabase/setup.sql. NEVER put the "service_role" or "secret" key here.
// Project: Maldewka's Project (ref xhjhilrjoapyqifwlflh). Values filled in 2026-11-04.
window.SUPABASE_URL = 'https://xhjhilrjoapyqifwlflh.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_g-l7rklOkV0lhnvCpQ_7hw_jXvO2Erh'; // publishable key (public by design)
// Where password-reset and confirm-email links send people back to (the live app).
window.APP_URL = 'https://maldewka.github.io/sullivan-taylor-inventory/';
