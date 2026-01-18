# Edge Function Deployment Guide

## Required Edge Functions

The following Edge Functions must be deployed for the payout system to work:

1. **create-payout-method** - Creates payout methods (bank/M-Pesa)
2. **create-subaccount** - Creates Paystack subaccounts
3. **list-payout-methods** - Lists payout methods (bypasses RLS)
4. **onboard-provider** - Handles provider onboarding

## Deployment Commands

```bash
# Navigate to supabase directory
cd supabase

# Deploy all functions
supabase functions deploy create-payout-method
supabase functions deploy create-subaccount
supabase functions deploy list-payout-methods
supabase functions deploy onboard-provider
```

## Environment Variables

Each Edge Function requires these environment variables (set in Supabase Dashboard):

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin operations)

For `create-subaccount`:
- `PAYSTACK_SECRET_KEY` - Your Paystack secret key

## Troubleshooting "Failed to send a request to the Edge Function"

If you see this error:

1. **Check if function is deployed:**
   ```bash
   supabase functions list
   ```

2. **Verify function exists in Supabase Dashboard:**
   - Go to Supabase Dashboard → Edge Functions
   - Check if `create-payout-method` is listed

3. **Check function logs:**
   ```bash
   supabase functions logs create-payout-method
   ```

4. **Verify environment variables:**
   - Go to Supabase Dashboard → Edge Functions → create-payout-method → Settings
   - Ensure all required env vars are set

5. **Test function directly:**
   ```bash
   supabase functions serve create-payout-method
   ```

6. **Check network/CORS:**
   - Ensure your frontend URL is in `ALLOWED_ORIGINS` or localhost is allowed
   - Check browser console for CORS errors

## Common Issues

### Function not found (404)
- **Solution:** Deploy the function using `supabase functions deploy create-payout-method`

### Authentication failed (401)
- **Solution:** Ensure the user is logged in and has a valid JWT token

### Service not configured (500)
- **Solution:** Set all required environment variables in Supabase Dashboard

### CORS errors
- **Solution:** Check `ALLOWED_ORIGINS` in function code or set it in environment variables
