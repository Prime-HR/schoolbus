-- Run this entire script in your Supabase SQL Editor to enforce security!

-- 1. Create the Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('Daily', 'Monthly', 'Termly')),
    total_fee NUMERIC NOT NULL DEFAULT 0,
    paid NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create the Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create the Till Inventory Table
CREATE TABLE IF NOT EXISTS public.till (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    denom_200 INT DEFAULT 0,
    denom_100 INT DEFAULT 0,
    denom_50 INT DEFAULT 0,
    denom_20 INT DEFAULT 0,
    denom_10 INT DEFAULT 0,
    denom_5 INT DEFAULT 0,
    denom_2 INT DEFAULT 0,
    denom_1 INT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.till (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4. Enable Realtime
-- (If already enabled, these might throw a notice, which is fine)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.till;

-- 5. UPGRADE TO SECURE ROW LEVEL SECURITY (RLS)
-- Drop the old insecure policies
DROP POLICY IF EXISTS "Allow all anon access to students" ON public.students;
DROP POLICY IF EXISTS "Allow all anon access to transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all anon access to till" ON public.till;

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.till ENABLE ROW LEVEL SECURITY;

-- Create SECURE policies that only allow logged-in users (authenticated) to access data
CREATE POLICY "Allow authenticated access to students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access to transactions" ON public.transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated access to till" ON public.till FOR ALL TO authenticated USING (true) WITH CHECK (true);
