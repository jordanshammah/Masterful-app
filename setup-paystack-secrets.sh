#!/bin/bash
# Setup Paystack Secrets for Supabase Edge Functions
# 
# This script helps you set up the required environment variables for the
# initiate-paystack edge function.
#
# Usage:
#   1. Make sure you're logged in: supabase login
#   2. Link your project: supabase link --project-ref qjvzswqawgiroteykgoh
#   3. Run this script: bash setup-paystack-secrets.sh
#
# Or set secrets manually via Supabase Dashboard:
#   Dashboard → Edge Functions → Secrets

echo "=========================================="
echo "Paystack Secrets Setup"
echo "=========================================="
echo ""
echo "This script will help you set up required secrets for payment processing."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "   supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Get current secrets
echo "Current secrets:"
supabase secrets list
echo ""

# Required secrets
echo "=========================================="
echo "Required Secrets:"
echo "=========================================="
echo ""
echo "1. PAYSTACK_SECRET_KEY"
echo "   - Get it from: https://dashboard.paystack.com → Settings → API Keys & Webhooks"
echo "   - Format: sk_test_xxxxxxxxxxxx (test) or sk_live_xxxxxxxxxxxx (live)"
echo ""
read -p "Enter PAYSTACK_SECRET_KEY: " PAYSTACK_SECRET_KEY

echo ""
echo "2. SUPABASE_URL"
echo "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API"
echo "   - Format: https://qjvzswqawgiroteykgoh.supabase.co"
echo ""
read -p "Enter SUPABASE_URL (or press Enter for default): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    SUPABASE_URL="https://qjvzswqawgiroteykgoh.supabase.co"
fi

echo ""
echo "3. SUPABASE_SERVICE_ROLE_KEY"
echo "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API → service_role key"
echo "   - ⚠️  WARNING: Keep this secret! Never expose it in client code"
echo ""
read -p "Enter SUPABASE_SERVICE_ROLE_KEY: " SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "4. SUPABASE_ANON_KEY"
echo "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API → anon/public key"
echo ""
read -p "Enter SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY

echo ""
echo "5. PAYSTACK_DEFAULT_CURRENCY (Optional, default: KES)"
read -p "Enter PAYSTACK_DEFAULT_CURRENCY (or press Enter for KES): " PAYSTACK_DEFAULT_CURRENCY
if [ -z "$PAYSTACK_DEFAULT_CURRENCY" ]; then
    PAYSTACK_DEFAULT_CURRENCY="KES"
fi

echo ""
echo "=========================================="
echo "Setting secrets..."
echo "=========================================="

# Set secrets
supabase secrets set PAYSTACK_SECRET_KEY="$PAYSTACK_SECRET_KEY"
supabase secrets set SUPABASE_URL="$SUPABASE_URL"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
supabase secrets set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
supabase secrets set PAYSTACK_DEFAULT_CURRENCY="$PAYSTACK_DEFAULT_CURRENCY"

echo ""
echo "=========================================="
echo "✅ Secrets set successfully!"
echo "=========================================="
echo ""
echo "Verify secrets:"
supabase secrets list
echo ""
echo "Next steps:"
echo "1. Deploy the edge function: supabase functions deploy initiate-paystack"
echo "2. Test the payment flow in your app"
echo ""
