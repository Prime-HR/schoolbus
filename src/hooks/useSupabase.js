import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabase() {
    const [user, setUser] = useState(null);
    const [students, setStudents] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [till, setTill] = useState({
        denom_200: 0, denom_100: 0, denom_50: 0, denom_20: 0, 
        denom_10: 0, denom_5: 0, denom_2: 0, denom_1: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchData();
            } else {
                setLoading(false);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                setLoading(true);
                fetchData();
            } else {
                setStudents([]);
                setTransactions([]);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchData = async () => {
        try {
            const { data: studentsData } = await supabase.from('students').select('*').order('created_at', { ascending: false });
            if (studentsData) setStudents(studentsData);

            const { data: txData } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(50);
            if (txData) setTransactions(txData);

            const { data: tillData } = await supabase.from('till').select('*').eq('id', 1).single();
            if (tillData) setTill(tillData);
            
            setLoading(false);
        } catch (error) {
            console.error('Error fetching data:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user) return;

        // Subscriptions for real-time
        const studentSub = supabase.channel('public:students')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, payload => {
                fetchData(); 
            }).subscribe();

        const txSub = supabase.channel('public:transactions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, payload => {
                fetchData();
            }).subscribe();

        const tillSub = supabase.channel('public:till')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'till' }, payload => {
                fetchData();
            }).subscribe();

        return () => {
            supabase.removeChannel(studentSub);
            supabase.removeChannel(txSub);
            supabase.removeChannel(tillSub);
        };
    }, [user]);

    // Auth Actions
    const login = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    };

    const logout = async () => {
        await supabase.auth.signOut();
    };

    // DB Actions
    const addStudent = async (student) => {
        await supabase.from('students').insert([student]);
    };

    const updateStudent = async (id, updates) => {
        await supabase.from('students').update(updates).eq('id', id);
    };

    const deleteStudent = async (id) => {
        await supabase.from('students').delete().eq('id', id);
    };

    const recordTransaction = async (tx) => {
        await supabase.from('transactions').insert([tx]);
    };

    const updateTill = async (newTill) => {
        await supabase.from('till').update(newTill).eq('id', 1);
    };

    return {
        user,
        login,
        logout,
        students,
        transactions,
        till,
        loading,
        addStudent,
        updateStudent,
        deleteStudent,
        recordTransaction,
        updateTill
    };
}
