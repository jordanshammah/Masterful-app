-- ============================================================================
-- Trusty Trades App - Complete Database Schema
-- ============================================================================
-- This file contains the complete database schema for the Trusty Trades
-- application. Execute this file to create all tables, enums, functions,
-- triggers, and policies from scratch.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles enum
CREATE TYPE public.app_role AS ENUM ('customer', 'provider', 'admin');

-- Job status enum
CREATE TYPE public.job_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('active', 'cancelled', 'expired', 'trial');

-- ============================================================================
-- SEQUENCES
-- ============================================================================

-- Create sequences for SERIAL columns
CREATE SEQUENCE IF NOT EXISTS public.service_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.subscription_plans_id_seq;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profiles Table
-- Stores user profile information linked to auth.users
-- ----------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  photo_url TEXT,
  address TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  city TEXT,
  stripe_customer_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for Stripe customer lookups
CREATE INDEX idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);

COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for payment processing';

-- ----------------------------------------------------------------------------
-- User Roles Table
-- Manages user roles (customer, provider, admin)
-- ----------------------------------------------------------------------------
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

-- ----------------------------------------------------------------------------
-- Service Categories Table
-- Defines available service categories (Plumbing, Electrician, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE public.service_categories (
  id INTEGER NOT NULL DEFAULT nextval('service_categories_id_seq'::regclass),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT service_categories_pkey PRIMARY KEY (id)
);

-- Insert default service categories
INSERT INTO public.service_categories (name, description) VALUES
  ('Plumbing', 'Professional plumbing services'),
  ('Electrician', 'Licensed electrical services'),
  ('Gardening', 'Garden maintenance and landscaping'),
  ('House Cleaning', 'Professional cleaning services');

-- ----------------------------------------------------------------------------
-- Subscription Plans Table
-- Defines subscription plans for providers
-- ----------------------------------------------------------------------------
CREATE TABLE public.subscription_plans (
  id INTEGER NOT NULL DEFAULT nextval('subscription_plans_id_seq'::regclass),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  features TEXT[],
  priority_level INTEGER DEFAULT 0,
  stripe_price_id TEXT UNIQUE,
  stripe_product_id TEXT,
  billing_interval TEXT DEFAULT 'month' CHECK (billing_interval = ANY (ARRAY['month'::text, 'year'::text])),
  currency TEXT DEFAULT 'usd',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);

-- Index for Stripe price lookups
CREATE INDEX idx_subscription_plans_stripe_price_id ON public.subscription_plans(stripe_price_id);

-- Insert default subscription plans
INSERT INTO public.subscription_plans (name, description, price, features, priority_level) VALUES
  ('Basic', 'Essential features for getting started', 29.99, ARRAY['Platform access', 'Basic analytics', 'Customer messaging'], 1),
  ('Professional', 'Advanced features for growing businesses', 79.99, ARRAY['Everything in Basic', 'Featured listings', 'Advanced analytics', 'Priority support'], 2),
  ('Premium', 'Complete package for established professionals', 149.99, ARRAY['Everything in Professional', 'Top placement in search', 'Unlimited bookings', 'Dedicated account manager'], 3);

COMMENT ON COLUMN public.subscription_plans.stripe_price_id IS 'Stripe Price ID for this subscription plan';
COMMENT ON COLUMN public.subscription_plans.stripe_product_id IS 'Stripe Product ID for this subscription plan';

-- ----------------------------------------------------------------------------
-- Providers Table
-- Stores provider-specific information
-- ----------------------------------------------------------------------------
CREATE TABLE public.providers (
  id UUID NOT NULL,
  category_id INTEGER NOT NULL,
  bio TEXT,
  hourly_rate NUMERIC NOT NULL,
  rating NUMERIC DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  avg_response_time INTEGER DEFAULT 45,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT providers_pkey PRIMARY KEY (id),
  CONSTRAINT providers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT providers_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id)
);

-- ----------------------------------------------------------------------------
-- Provider Subscriptions Table
-- Tracks provider subscription plans and Stripe subscriptions
-- ----------------------------------------------------------------------------
CREATE TABLE public.provider_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  plan_id INTEGER NOT NULL,
  status subscription_status DEFAULT 'active',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  stripe_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT provider_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT provider_subscriptions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT provider_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id)
);

-- Indexes for Stripe subscription lookups
CREATE INDEX idx_provider_subscriptions_stripe_subscription_id ON public.provider_subscriptions(stripe_subscription_id);
CREATE INDEX idx_provider_subscriptions_stripe_customer_id ON public.provider_subscriptions(stripe_customer_id);
CREATE INDEX idx_provider_subscriptions_status ON public.provider_subscriptions(status);

COMMENT ON COLUMN public.provider_subscriptions.stripe_subscription_id IS 'Stripe Subscription ID';
COMMENT ON COLUMN public.provider_subscriptions.stripe_customer_id IS 'Stripe Customer ID (references profiles.stripe_customer_id)';

-- ----------------------------------------------------------------------------
-- Jobs Table
-- Stores job bookings between customers and providers
-- ----------------------------------------------------------------------------
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  category_id INTEGER NOT NULL,
  status job_status DEFAULT 'pending',
  scheduled_date TIMESTAMPTZ NOT NULL,
  is_rush BOOLEAN DEFAULT FALSE,
  base_price NUMERIC NOT NULL,
  rush_fee_amount NUMERIC DEFAULT 0,
  total_price NUMERIC NOT NULL,
  address TEXT NOT NULL,
  notes TEXT,
  auth_code_customer TEXT,
  auth_code_provider TEXT,
  customer_start_code_hash TEXT,
  provider_end_code_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT jobs_pkey PRIMARY KEY (id),
  CONSTRAINT jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT jobs_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE,
  CONSTRAINT jobs_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id)
);

-- ----------------------------------------------------------------------------
-- Reviews Table
-- Stores customer reviews for completed jobs
-- ----------------------------------------------------------------------------
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL UNIQUE,
  author_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT reviews_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT reviews_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Payments Table
-- Tracks payment records for jobs
-- ----------------------------------------------------------------------------
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  status payment_status DEFAULT 'pending',
  payment_method TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT payments_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.providers(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Messages Table
-- Stores messages between customers and providers for jobs
-- ----------------------------------------------------------------------------
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Stripe Webhook Events Table
-- Tracks Stripe webhook events for audit and idempotency
-- ----------------------------------------------------------------------------
CREATE TABLE public.stripe_webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processing_error TEXT,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id)
);

-- Indexes for webhook event lookups
CREATE INDEX idx_stripe_webhook_events_stripe_event_id ON public.stripe_webhook_events(stripe_event_id);
CREATE INDEX idx_stripe_webhook_events_event_type ON public.stripe_webhook_events(event_type);
CREATE INDEX idx_stripe_webhook_events_processed ON public.stripe_webhook_events(processed);

COMMENT ON TABLE public.stripe_webhook_events IS 'Stores Stripe webhook events for audit and idempotency';

-- ----------------------------------------------------------------------------
-- Stripe Payment Intents Table
-- Tracks Stripe payment intents for job payments
-- ----------------------------------------------------------------------------
CREATE TABLE public.stripe_payment_intents (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  job_id UUID,
  customer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT stripe_payment_intents_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_payment_intents_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE,
  CONSTRAINT stripe_payment_intents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes for payment intent lookups
CREATE INDEX idx_stripe_payment_intents_stripe_id ON public.stripe_payment_intents(stripe_payment_intent_id);
CREATE INDEX idx_stripe_payment_intents_job_id ON public.stripe_payment_intents(job_id);
CREATE INDEX idx_stripe_payment_intents_customer_id ON public.stripe_payment_intents(customer_id);
CREATE INDEX idx_stripe_payment_intents_status ON public.stripe_payment_intents(status);

COMMENT ON TABLE public.stripe_payment_intents IS 'Stores Stripe payment intents for job payments';

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: has_role
-- Checks if a user has a specific role
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ----------------------------------------------------------------------------
-- Function: handle_new_user
-- Automatically creates profile and assigns customer role when a new user signs up
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  
  -- Assign default customer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: update_updated_at_column
-- Automatically updates the updated_at timestamp on row updates
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Create profile and assign role when new user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Triggers: Auto-update updated_at timestamps
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_providers_updated_at 
  BEFORE UPDATE ON public.providers 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at 
  BEFORE UPDATE ON public.jobs 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_provider_subscriptions_updated_at 
  BEFORE UPDATE ON public.provider_subscriptions 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stripe_payment_intents_updated_at 
  BEFORE UPDATE ON public.stripe_payment_intents 
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_intents ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS Policies: Profiles
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view all profiles" 
  ON public.profiles FOR SELECT 
  USING (TRUE);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- RLS Policies: User Roles
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own roles" 
  ON public.user_roles FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles" 
  ON public.user_roles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles" 
  ON public.user_roles FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles" 
  ON public.user_roles FOR ALL 
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- RLS Policies: Service Categories
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view categories" 
  ON public.service_categories FOR SELECT 
  USING (TRUE);

-- ----------------------------------------------------------------------------
-- RLS Policies: Subscription Plans
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view plans" 
  ON public.subscription_plans FOR SELECT 
  USING (TRUE);

-- ----------------------------------------------------------------------------
-- RLS Policies: Providers
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view active providers" 
  ON public.providers FOR SELECT 
  USING (is_active = TRUE OR is_active IS NULL);

CREATE POLICY "Providers can update own profile" 
  ON public.providers FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own provider profile" 
  ON public.providers FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- RLS Policies: Provider Subscriptions
-- ----------------------------------------------------------------------------
CREATE POLICY "Providers can view own subscriptions" 
  ON public.provider_subscriptions FOR SELECT 
  USING (auth.uid() = provider_id);

CREATE POLICY "Providers can insert own subscriptions" 
  ON public.provider_subscriptions FOR INSERT 
  WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "Admins can view all subscriptions" 
  ON public.provider_subscriptions FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- RLS Policies: Jobs
-- ----------------------------------------------------------------------------
-- Updated policy to handle cases where providers.id might not equal auth.users.id
-- Checks if user is the provider by looking up the providers table
CREATE POLICY "Users can view own jobs" 
  ON public.jobs FOR SELECT 
  USING (
    auth.uid() = customer_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.providers 
      WHERE providers.id = jobs.provider_id 
      AND (providers.id = auth.uid() OR providers.user_id = auth.uid())
    )
  );

CREATE POLICY "Customers can create jobs" 
  ON public.jobs FOR INSERT 
  WITH CHECK (auth.uid() = customer_id);

-- Updated policy to handle cases where providers.id might not equal auth.users.id
CREATE POLICY "Involved users can update jobs" 
  ON public.jobs FOR UPDATE 
  USING (
    auth.uid() = customer_id 
    OR 
    EXISTS (
      SELECT 1 FROM public.providers 
      WHERE providers.id = jobs.provider_id 
      AND (providers.id = auth.uid() OR providers.user_id = auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- RLS Policies: Reviews
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can view reviews" 
  ON public.reviews FOR SELECT 
  USING (TRUE);

CREATE POLICY "Customers can create reviews for their jobs" 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = author_id);

-- ----------------------------------------------------------------------------
-- RLS Policies: Payments
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own payments" 
  ON public.payments FOR SELECT 
  USING (auth.uid() = customer_id OR auth.uid() = provider_id);

CREATE POLICY "Admins can view all payments" 
  ON public.payments FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- RLS Policies: Messages
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own messages" 
  ON public.messages FOR SELECT 
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" 
  ON public.messages FOR INSERT 
  WITH CHECK (auth.uid() = sender_id);

-- ----------------------------------------------------------------------------
-- RLS Policies: Stripe Webhook Events
-- ----------------------------------------------------------------------------
CREATE POLICY "Admins can view webhook events" 
  ON public.stripe_webhook_events FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- RLS Policies: Stripe Payment Intents
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view own payment intents" 
  ON public.stripe_payment_intents FOR SELECT 
  USING (auth.uid() = customer_id);

CREATE POLICY "Admins can view all payment intents" 
  ON public.stripe_payment_intents FOR SELECT 
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- SCHEMA COMPLETE
-- ============================================================================
-- All tables, enums, functions, triggers, and RLS policies have been created.
-- The database is now ready for use.
-- ============================================================================

