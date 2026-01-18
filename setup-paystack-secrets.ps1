# Setup Paystack Secrets for Supabase Edge Functions (PowerShell)
# 
# This script helps you set up the required environment variables for the
# initiate-paystack edge function.
#
# Usage:
#   1. Make sure you're logged in: supabase login
#   2. Link your project: supabase link --project-ref qjvzswqawgiroteykgoh
#   3. Run this script: .\setup-paystack-secrets.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Paystack Secrets Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "This script will help you set up required secrets for payment processing." -ForegroundColor Yellow
Write-Host ""

# Check if supabase CLI is installed
try {
    $null = Get-Command supabase -ErrorAction Stop
    Write-Host "✅ Supabase CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ Supabase CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "   npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Get current secrets
Write-Host "Current secrets:" -ForegroundColor Cyan
supabase secrets list
Write-Host ""

# Required secrets
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Required Secrets:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. PAYSTACK_SECRET_KEY" -ForegroundColor Yellow
Write-Host "   - Get it from: https://dashboard.paystack.com → Settings → API Keys & Webhooks"
Write-Host "   - Format: sk_test_xxxxxxxxxxxx (test) or sk_live_xxxxxxxxxxxx (live)"
$PAYSTACK_SECRET_KEY = Read-Host "Enter PAYSTACK_SECRET_KEY"

Write-Host ""
Write-Host "2. SUPABASE_URL" -ForegroundColor Yellow
Write-Host "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API"
Write-Host "   - Format: https://qjvzswqawgiroteykgoh.supabase.co"
$SUPABASE_URL = Read-Host "Enter SUPABASE_URL (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) {
    $SUPABASE_URL = "https://qjvzswqawgiroteykgoh.supabase.co"
}

Write-Host ""
Write-Host "3. SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
Write-Host "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API → service_role key"
Write-Host "   - ⚠️  WARNING: Keep this secret! Never expose it in client code" -ForegroundColor Red
$SUPABASE_SERVICE_ROLE_KEY = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY"

Write-Host ""
Write-Host "4. SUPABASE_ANON_KEY" -ForegroundColor Yellow
Write-Host "   - Get it from: https://app.supabase.com/project/qjvzswqawgiroteykgoh → Settings → API → anon/public key"
$SUPABASE_ANON_KEY = Read-Host "Enter SUPABASE_ANON_KEY"

Write-Host ""
Write-Host "5. PAYSTACK_DEFAULT_CURRENCY (Optional, default: KES)" -ForegroundColor Yellow
$PAYSTACK_DEFAULT_CURRENCY = Read-Host "Enter PAYSTACK_DEFAULT_CURRENCY (or press Enter for KES)"
if ([string]::IsNullOrWhiteSpace($PAYSTACK_DEFAULT_CURRENCY)) {
    $PAYSTACK_DEFAULT_CURRENCY = "KES"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Setting secrets..." -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Set secrets
supabase secrets set "PAYSTACK_SECRET_KEY=$PAYSTACK_SECRET_KEY"
supabase secrets set "SUPABASE_URL=$SUPABASE_URL"
supabase secrets set "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
supabase secrets set "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
supabase secrets set "PAYSTACK_DEFAULT_CURRENCY=$PAYSTACK_DEFAULT_CURRENCY"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Secrets set successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Verify secrets:" -ForegroundColor Cyan
supabase secrets list
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Deploy the edge function: supabase functions deploy initiate-paystack" -ForegroundColor White
Write-Host "2. Test the payment flow in your app" -ForegroundColor White
Write-Host ""
