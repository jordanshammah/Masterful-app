# Local Network CORS Fix

## Problem
Payout methods view worked on `localhost` but not on `http://172.23.224.1:8080/` (local network IP).

## Root Cause
The CORS configuration only allowed:
- `localhost` origins
- HTTPS origins in production

It did NOT allow HTTP origins from local network IPs (like `172.x.x.x`, `192.168.x.x`, `10.x.x.x`).

## Solution

### 1. Updated CORS to Allow Local Network IPs
Modified `_shared/security.ts` to detect and allow common local network IP ranges:
- `172.16.0.0 - 172.31.255.255` (172.16.x.x - 172.31.x.x)
- `192.168.0.0 - 192.168.255.255` (192.168.x.x)
- `10.0.0.0 - 10.255.255.255` (10.x.x.x)
- `127.0.0.0 - 127.255.255.255` (127.x.x.x)
- `169.254.0.0 - 169.254.255.255` (169.254.x.x - link-local)

### 2. Improved Error Handling
- Added better error logging in `proPayoutMethodsApi.list()`
- Added error display in `AccountPayouts` component
- Errors now show helpful messages with troubleshooting tips

## Changes Made

1. **`supabase/functions/_shared/security.ts`**:
   - Added `isLocalNetworkIP()` function to detect local network IPs
   - Updated `getCorsHeaders()` to allow local network HTTP origins

2. **`src/lib/api/pro-enhanced.ts`**:
   - Improved error handling in `proPayoutMethodsApi.list()`
   - Added try-catch with detailed logging

3. **`src/components/account/AccountPayouts.tsx`**:
   - Added error state display
   - Shows helpful error messages to users

## Deployment

Redeploy the Edge Functions to apply the CORS fix:

```bash
cd supabase
supabase functions deploy list-payout-methods
supabase functions deploy create-payout-method
supabase functions deploy create-subaccount
supabase functions deploy onboard-provider
```

## Testing

1. **Test from localhost** (should still work):
   ```
   http://localhost:8080
   ```

2. **Test from local network IP** (should now work):
   ```
   http://172.23.224.1:8080
   http://192.168.1.100:8080
   http://10.0.0.5:8080
   ```

3. **Check browser console**:
   - Open DevTools (F12)
   - Check Console tab for any CORS errors
   - Check Network tab for failed requests

## Troubleshooting

If payout methods still don't appear:

1. **Check browser console** for errors
2. **Verify Edge Function is deployed**:
   ```bash
   supabase functions list
   ```
3. **Check Edge Function logs**:
   ```bash
   supabase functions logs list-payout-methods
   ```
4. **Verify authentication** - Ensure user is logged in
5. **Check network tab** - Look for failed requests to `list-payout-methods`

## Security Note

The CORS fix allows local network IPs only when:
- `ALLOWED_ORIGINS` environment variable is NOT set
- The origin is HTTP (not HTTPS)
- The origin matches local network IP patterns

For production, set `ALLOWED_ORIGINS` to restrict to specific domains.
