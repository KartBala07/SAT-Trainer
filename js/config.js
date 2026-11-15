/* ============ runtime config ============
   Leave both blank for guest-only mode (the app runs entirely on localStorage).

   To enable accounts:
     1. host the backend (see README) and set apiBase to its URL
     2. create a Google OAuth client ID for that origin and set it here,
        or configure GOOGLE_CLIENT_ID on the server and leave this blank
   ======================================== */
window.SAT_CONFIG = {
  apiBase: '',
  googleClientId: '',
};
