import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export function useSupabase() {
    const [user, setUser] = useState(null);
    const [students, setStudents] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [tickets, setTickets] = useState([]);
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
                setTickets([]);
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

            const { data: ticketsData } = await supabase.from('tickets').select('*').order('created_at', { ascending: false });
            if (ticketsData) setTickets(ticketsData);

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

        const ticketsSub = supabase.channel('public:tickets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
                fetchData();
            }).subscribe();

        const tillSub = supabase.channel('public:till')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'till' }, payload => {
                fetchData();
            }).subscribe();

        return () => {
            supabase.removeChannel(studentSub);
            supabase.removeChannel(txSub);
            supabase.removeChannel(ticketsSub);
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

    const generateTickets = async (count) => {
        const newTickets = [];
        for (let i = 0; i < count; i++) {
            // Generate a random 3-digit code
            const code = Math.floor(100 + Math.random() * 900).toString();
            newTickets.push({ code, is_used: false });
        }
        await supabase.from('tickets').insert(newTickets);
    };

    const useTicket = async (code) => {
        const ticket = tickets.find(t => t.code === code);
        if (!ticket) return { success: false, error: 'INVALID CODE' };
        if (ticket.is_used) return { success: false, error: 'CODE ALREADY USED' };

        await supabase.from('tickets').update({ is_used: true, used_at: new Date().toISOString() }).eq('code', code);
        return { success: true };
    };

    return {
        user,
        login,
        logout,
        students,
        transactions,
        tickets,
        till,
        loading,
        addStudent,
        updateStudent,
        deleteStudent,
        recordTransaction,
        updateTill,
        generateTickets,
        useTicket
    };
}
