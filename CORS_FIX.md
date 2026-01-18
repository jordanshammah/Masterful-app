# CORS Fix for Production Deployment

## Problem
Edge Functions worked from localhost but failed from production/network hosting due to CORS restrictions.

## Solution
Updated CORS configuration to be more permissive for production while maintaining security:

### Changes Made:

1. **Updated `_shared/security.ts` CORS function:**
   - Now allows any HTTPS origin in production when `ALLOWED_ORIGINS` is not explicitly set
   - Still allows localhost in development
   - Falls back to wildcard (`*`) if no origins are configured

2. **Standardized all Edge Functions to use shared CORS:**
   - `create-payout-method` - Now uses shared CORS function
   - `create-subaccount` - Now uses shared CORS function
   - `onboard-provider` - Already using shared CORS function
   - `list-payout-methods` - Already using shared CORS function

## How It Works:

### Development (localhost):
- Automatically allows `localhost`, `127.0.0.1`, and `::1`
- Works without any configuration

### Production:
- If `ALLOWED_ORIGINS` environment variable is **NOT set**, allows any HTTPS origin
- If `ALLOWED_ORIGINS` is set, only allows explicitly listed origins

### Security:
- Still requires valid JWT authentication
- Only allows HTTPS origins in production (not HTTP)
- Can restrict to specific origins by setting `ALLOWED_ORIGINS`

## Deployment Steps:

1. **Redeploy all Edge Functions:**
   ```bash
   cd supabase
   supabase functions deploy create-payout-method
   supabase functions deploy create-subaccount
   supabase functions deploy list-payout-methods
   supabase functions deploy onboard-provider
   ```

2. **Optional: Restrict to specific origins (if needed):**
   - Go to Supabase Dashboard → Edge Functions → Settings
   - Set `ALLOWED_ORIGINS` environment variable
   - Example: `https://yourdomain.com,https://www.yourdomain.com`
   - Leave empty to allow all HTTPS origins

## Testing:

1. Test from localhost (should still work)
2. Test from production URL (should now work)
3. Check browser console for CORS errors
4. Verify Edge Function logs in Supabase Dashboard

## Notes:

- The CORS fix allows any HTTPS origin by default for easier deployment
- For stricter security, set `ALLOWED_ORIGINS` with your specific domain(s)
- All Edge Functions now use consistent CORS handling via `_shared/security.ts`
