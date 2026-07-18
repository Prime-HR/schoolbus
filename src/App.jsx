import React, { useState, useMemo } from 'react';
import { useSupabase } from './hooks/useSupabase';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1];
const QUICK_BILLS = [100, 50, 20, 10, 5];

function App() {
  const { user, login, logout, students, transactions, till, loading, addStudent, updateStudent, deleteStudent, recordTransaction, updateTill } = useSupabase();
  const [view, setView] = useState('driver'); 
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [feeDue, setFeeDue] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [receivedDenomination, setReceivedDenomination] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({ name: '', grade: '', plan: 'Monthly', totalFee: '', paid: '' });

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId]);

  const filteredStudents = useMemo(() => {
      return students.filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.grade.toLowerCase().includes(search.toLowerCase());
          const isPaid = s.paid >= s.total_fee;
          if (filter === 'paid') return matchesSearch && isPaid;
          if (filter === 'unpaid') return matchesSearch && !isPaid;
          return matchesSearch;
      });
  }, [students, search, filter]);

  const topDebtors = useMemo(() => {
      return [...students].filter(s => s.paid < s.total_fee).sort((a,b) => (b.total_fee - b.paid) - (a.total_fee - a.paid)).slice(0, 5);
  }, [students]);

  const totalExpected = students.reduce((sum, s) => sum + Number(s.total_fee), 0);
  const totalCollected = students.reduce((sum, s) => sum + Number(s.paid), 0);
  const totalOutstanding = totalExpected - totalCollected;
  const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;

  const exportToCSV = () => {
      const headers = ["Student Name,Grade,Plan,Total Fee (GHS),Amount Paid (GHS),Outstanding (GHS)\n"];
      const rows = students.map(s => `"${s.name}","${s.grade}","${s.plan}",${s.total_fee},${s.paid},${s.total_fee - s.paid}\n`);
      const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `bus_fees_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const shareAdminReportWA = () => {
      let text = `🚌 *School Bus Daily Report*\n📅 ${new Date().toLocaleDateString()}\n------------------------\n`;
      text += `💰 *Expected Revenue:* GH₵ ${totalExpected}\n`;
      text += `✅ *Total Collected:* GH₵ ${totalCollected}\n`;
      text += `🛑 *Outstanding Debt:* GH₵ ${totalOutstanding}\n`;
      text += `📊 *Collection Rate:* ${collectionRate}%\n\n`;
      if (topDebtors.length > 0) {
          text += `*⚠️ Top Debtors:*\n`;
          topDebtors.forEach((d, i) => {
              text += `${i+1}. ${d.name} (${d.plan}) - Owes: GH₵ ${d.total_fee - d.paid}\n`;
          });
      }
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const shareReceiptWA = (student) => {
      const owed = student.total_fee - student.paid;
      let text = `🚌 *School Bus Receipt*\n👤 *Student:* ${student.name}\n`;
      text += `🗓️ *Plan:* ${student.plan}\n`;
      text += `✅ *Total Paid:* GH₵ ${student.paid}\n`;
      text += owed > 0 ? `🛑 *Remaining Balance:* GH₵ ${owed}\n` : `🎉 *Status: Fully Paid!*\n`;
      text += `\nThank you! Have a safe trip.`;
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const handleLogin = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
          await login(email, password);
      } catch (err) {
          setAuthError(err.message);
      }
  };

  if (loading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-indigo-600 font-bold animate-pulse">Connecting to Supabase...</p></div>;
  }

  if (!user) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
              <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
                  <div className="text-center mb-8">
                      <h1 className="text-2xl font-black text-slate-800">BusFee CLOUD</h1>
                      <p className="text-slate-500 text-sm mt-1 font-medium">Please sign in to access</p>
                  </div>
                  {authError && <div className="mb-4 bg-rose-50 text-rose-600 p-3 rounded-xl text-sm border border-rose-100 font-bold">{authError}</div>}
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                          <input type="email" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={email} onChange={e => setEmail(e.target.value)} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
                          <input type="password" required className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={password} onChange={e => setPassword(e.target.value)} />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">Sign In</button>
                  </form>
              </div>
          </div>
      );
  }

  const handleAddPaymentClick = (student) => {
      setSelectedStudentId(student.id);
      setFeeDue((student.total_fee - student.paid).toString());
      setCashReceived('');
      setReceivedDenomination(null);
      if (view === 'driver') {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }
  };

  const handleQuickPay = async (student) => {
      const due = student.total_fee - student.paid;
      if (window.confirm(`Accept exact cash of GH₵${due} for ${student.name}?`)) {
          await updateStudent(student.id, { paid: student.total_fee });
          await recordTransaction({
              student_id: student.id,
              student_name: student.name,
              amount: due,
              type: '⚡ Exact Cash'
          });
          
          let newTill = { ...till };
          let rem = due;
          for(let d of DENOMINATIONS) {
              while (rem >= d) { newTill[`denom_${d}`] += 1; rem -= d; }
          }
          await updateTill(newTill);
      }
  };

  const openAddModal = () => {
      setEditingStudent(null);
      setFormData({ name: '', grade: '', plan: 'Monthly', totalFee: '', paid: '0' });
      setIsModalOpen(true);
  };

  const openEditModal = (student) => {
      setEditingStudent(student);
      setFormData({
          name: student.name,
          grade: student.grade,
          plan: student.plan || 'Monthly',
          totalFee: student.total_fee.toString(),
          paid: student.paid.toString()
      });
      setIsModalOpen(true);
  };

  const handleSaveStudent = async () => {
      const totalFeeNum = parseFloat(formData.totalFee) || 0;
      const paidNum = parseFloat(formData.paid) || 0;
      
      if (!formData.name.trim()) return alert('Name is required');
      if (totalFeeNum <= 0) return alert('Total fee must be greater than 0');

      if (editingStudent) {
          await updateStudent(editingStudent.id, {
              name: formData.name, grade: formData.grade, plan: formData.plan, total_fee: totalFeeNum, paid: paidNum
          });
      } else {
          await addStudent({
              name: formData.name, grade: formData.grade || '-', plan: formData.plan, total_fee: totalFeeNum, paid: paidNum
          });
      }
      setIsModalOpen(false);
  };

  const handleDeleteStudent = async () => {
      const confirmName = window.prompt(`WARNING: This will permanently delete ${editingStudent.name}.\n\nTo confirm, please type the student's exact name below:`);
      if (confirmName === editingStudent.name) {
          await deleteStudent(editingStudent.id);
          setIsModalOpen(false);
          if (selectedStudentId === editingStudent.id) {
              setSelectedStudentId(null);
              setFeeDue('');
          }
      } else if (confirmName !== null) {
          alert("Name did not match. Deletion cancelled.");
      }
  };

  const getStatus = (paid, total) => {
      if (paid >= total) return { label: 'Paid', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      if (paid > 0) return { label: 'Partial', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      return { label: 'Unpaid', color: 'bg-rose-100 text-rose-800 border-rose-200' };
  };

  const getPlanColor = (plan) => {
      if (plan === 'Daily') return 'bg-blue-100 text-blue-700';
      if (plan === 'Monthly') return 'bg-purple-100 text-purple-700';
      if (plan === 'Termly') return 'bg-orange-100 text-orange-700';
      return 'bg-slate-100 text-slate-700';
  };

  const totalDueNum = parseFloat(feeDue) || 0;
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeDue = Math.max(0, cashReceivedNum - totalDueNum);

  const calculateChangeBreakdown = () => {
      let remaining = changeDue;
      let breakdown = {};
      let tillCopy = { ...till };
      let possible = true;

      for (let denom of DENOMINATIONS) {
          const key = `denom_${denom}`;
          if (remaining >= denom && tillCopy[key] > 0) {
              let count = Math.min(Math.floor(remaining / denom), tillCopy[key]);
              if (count > 0) {
                  breakdown[denom] = count;
                  remaining -= count * denom;
                  tillCopy[key] -= count;
              }
          }
      }
      if (remaining > 0) possible = false;
      return { breakdown, possible };
  };

  const { breakdown, possible } = calculateChangeBreakdown();

  const completeTransaction = async () => {
      if (cashReceivedNum < totalDueNum) return alert("Cash received is less than fee due!");
      if (!possible) return alert("Not enough physical change in the till to complete this transaction!");

      let newTill = { ...till };
      if (receivedDenomination) {
          newTill[`denom_${receivedDenomination}`] += 1;
      } else if (cashReceivedNum > 0) {
         let rem = cashReceivedNum;
         for(let d of DENOMINATIONS) {
             while (rem >= d) { newTill[`denom_${d}`] += 1; rem -= d; }
         }
      }

      for (let d in breakdown) newTill[`denom_${d}`] -= breakdown[d];
      
      await updateTill(newTill);

      if (selectedStudent) {
          await updateStudent(selectedStudent.id, { paid: Number(selectedStudent.paid) + totalDueNum });
          await recordTransaction({
              student_id: selectedStudent.id,
              student_name: selectedStudent.name,
              amount: totalDueNum,
              type: 'Cash'
          });
      }

      setSelectedStudentId(null);
      setFeeDue('');
      setCashReceived('');
      setReceivedDenomination(null);
  };

  const updateTillInventory = async (denom, amount) => {
      const key = `denom_${denom}`;
      await updateTill({ ...till, [key]: Math.max(0, till[key] + amount) });
  };

  const totalTillValue = DENOMINATIONS.reduce((sum, denom) => sum + (denom * (till[`denom_${denom}`] || 0)), 0);

  return (
      <div className="w-full max-w-md mx-auto h-[100dvh] bg-slate-50 shadow-2xl flex flex-col relative font-sans overflow-hidden">
          <header className="bg-slate-900 text-white p-4 shadow-md relative z-20 flex-shrink-0">
              <div className="flex justify-between items-center">
                  <div>
                      <h1 className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">BusFee CLOUD</h1>
                      <p className="text-slate-400 text-[10px] uppercase tracking-wider mt-0.5 font-bold">
                          {view === 'driver' ? 'Driver Operations' : 'Management Portal'}
                      </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                      <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                          <button onClick={() => setView('driver')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'driver' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Bus</button>
                          <button onClick={() => setView('owner')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${view === 'owner' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Admin</button>
                      </div>
                      <button onClick={logout} className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase font-bold tracking-wider">Log out</button>
                  </div>
              </div>
          </header>

          {/* DRIVER VIEW */}
          {view === 'driver' && (
              <main className="p-3 space-y-4 flex-1 overflow-y-auto animate-fadeIn">
                  <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col flex-shrink-0">
                      <div className="flex justify-between items-center mb-3">
                          <h2 className="text-base font-bold text-slate-800 flex items-center">
                              Boarding List
                          </h2>
                          <button onClick={openAddModal} className="bg-indigo-100 text-indigo-700 active:bg-indigo-200 px-3 py-1.5 rounded-full shadow-sm transition-colors text-xs font-bold">
                              Add Student
                          </button>
                      </div>
                      
                      <div className="flex bg-slate-100 rounded-lg p-1 mb-3">
                          <button onClick={() => setFilter('all')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>All</button>
                          <button onClick={() => setFilter('paid')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filter === 'paid' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}>Paid ✅</button>
                          <button onClick={() => setFilter('unpaid')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${filter === 'unpaid' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500'}`}>Unpaid 🛑</button>
                      </div>

                      <input type="text" placeholder="Search..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} />
                      
                      <div className="space-y-3">
                          {filteredStudents.map(student => {
                              const status = getStatus(student.paid, student.total_fee);
                              const owed = student.total_fee - student.paid;
                              return (
                                  <div key={student.id} className="border border-slate-200 rounded-xl p-3 flex flex-col gap-2">
                                      <div className="flex justify-between items-start">
                                          <div>
                                              <div className="flex items-center">
                                                  <h3 className="font-bold text-slate-900 mr-2">{student.name}</h3>
                                                  <button onClick={() => openEditModal(student)} className="text-indigo-500 text-xs">Edit</button>
                                              </div>
                                              <div className="flex gap-1 mt-1">
                                                  <span className="text-[10px] bg-slate-100 px-1 rounded border">{student.grade}</span>
                                                  <span className={`text-[10px] px-1 rounded border ${getPlanColor(student.plan)}`}>{student.plan}</span>
                                              </div>
                                          </div>
                                          <div className="flex flex-col items-end gap-1">
                                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${status.color}`}>{status.label}</span>
                                              <button onClick={() => shareReceiptWA(student)} className="text-green-600 bg-green-50 p-1 rounded-full border border-green-200" title="WhatsApp Receipt">
                                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                                              </button>
                                          </div>
                                      </div>
                                      <div className="flex justify-between items-center mt-1 border-t pt-2">
                                          <div className="text-xs">
                                              Paid: <b>GH₵{student.paid}</b> / {student.total_fee}
                                          </div>
                                          {student.paid < student.total_fee && (
                                              <div className="flex gap-2">
                                                  <button onClick={() => handleQuickPay(student)} className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded">Exact GH₵{owed}</button>
                                                  <button onClick={() => handleAddPaymentClick(student)} className="bg-indigo-600 text-white text-xs px-3 py-1 rounded">Pay</button>
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </section>

                  {/* Register Section Simplified for brevity */}
                  <section className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                      <h2 className="font-bold mb-3">Register</h2>
                      {selectedStudent && <div className="bg-indigo-50 p-2 text-xs mb-3 rounded">Paying for: <b>{selectedStudent.name}</b></div>}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                          <input type="number" className="w-full border rounded p-2" value={feeDue} onChange={e => setFeeDue(e.target.value)} placeholder="Fee Due" />
                          <input type="number" className="w-full border rounded p-2" value={cashReceived} onChange={e => {setCashReceived(e.target.value); setReceivedDenomination(null);}} placeholder="Cash Rcvd" />
                      </div>
                      <div className="mb-4 flex gap-2 overflow-x-auto">
                          {QUICK_BILLS.map(b => (
                              <button key={b} onClick={() => {setCashReceived(b); setReceivedDenomination(b);}} className="bg-slate-100 px-3 py-1 rounded border text-sm">{b}</button>
                          ))}
                      </div>
                      <div className="bg-slate-50 p-3 rounded mb-3">
                          <div className="flex justify-between font-bold">Change Due: <span>GH₵{changeDue.toFixed(2)}</span></div>
                          {changeDue > 0 && (
                              <div className="mt-2 text-xs text-amber-700">
                                  {possible ? Object.entries(breakdown).map(([d, c]) => <span key={d} className="mr-2">{c}x{d}</span>) : 'Not enough change!'}
                              </div>
                          )}
                      </div>
                      <button onClick={completeTransaction} disabled={!possible || cashReceivedNum < totalDueNum} className="w-full bg-emerald-500 text-white font-bold py-3 rounded">Complete Transaction</button>
                  </section>
                  
                  {/* Till Section */}
                  <section className="bg-slate-800 text-white rounded-2xl p-4">
                      <div className="flex justify-between mb-3 font-bold">Till Inventory <span>GH₵{totalTillValue}</span></div>
                      <div className="grid grid-cols-2 gap-2">
                          {DENOMINATIONS.map(d => (
                              <div key={d} className="bg-slate-700 p-2 rounded flex justify-between items-center text-sm">
                                  <span>GH₵{d}</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => updateTillInventory(d, -1)} className="bg-slate-600 px-2 rounded">-</button>
                                      <span>{till[`denom_${d}`]}</span>
                                      <button onClick={() => updateTillInventory(d, 1)} className="bg-blue-600 px-2 rounded">+</button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </section>
              </main>
          )}

          {/* ADMIN VIEW */}
          {view === 'owner' && (
              <main className="p-3 space-y-4 flex-1 overflow-y-auto bg-slate-100">
                  <div className="flex justify-between items-end mb-2">
                      <h2 className="text-xl font-black">Business Overview</h2>
                      <div className="flex gap-2">
                          <button onClick={exportToCSV} className="bg-white text-slate-600 px-2 py-2 rounded-lg text-xs font-bold border border-slate-200 shadow-sm flex items-center">
                             CSV
                          </button>
                          <button onClick={shareAdminReportWA} className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-xs font-bold border border-green-200 shadow-sm flex items-center">
                             WhatsApp
                          </button>
                      </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded shadow-sm text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Collected</p>
                          <h3 className="text-xl font-bold text-emerald-600">GH₵{totalCollected}</h3>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm text-center">
                          <p className="text-[10px] text-slate-500 font-bold uppercase">Outstanding</p>
                          <h3 className="text-xl font-bold text-rose-600">GH₵{totalOutstanding}</h3>
                      </div>
                  </div>
                  
                  <div className="bg-white p-3 rounded shadow-sm h-64 overflow-y-auto">
                      <h3 className="font-bold mb-2">Live Transactions</h3>
                      {transactions.map(tx => (
                          <div key={tx.id} className="flex justify-between p-2 border-b text-sm">
                              <div><b>{tx.student_name}</b> <span className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleTimeString()}</span></div>
                              <div className="text-emerald-600 font-bold">+GH₵{tx.amount}</div>
                          </div>
                      ))}
                  </div>
              </main>
          )}

          {/* Modal */}
          {isModalOpen && (
              <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white w-full rounded p-4">
                      <h3 className="font-bold mb-3">{editingStudent ? 'Edit' : 'Add'} Passenger</h3>
                      <input className="w-full border p-2 mb-2 rounded" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Name"/>
                      <input className="w-full border p-2 mb-2 rounded" value={formData.grade} onChange={e=>setFormData({...formData, grade: e.target.value})} placeholder="Grade"/>
                      <select className="w-full border p-2 mb-2 rounded" value={formData.plan} onChange={e=>setFormData({...formData, plan: e.target.value})}>
                          <option>Daily</option><option>Monthly</option><option>Termly</option>
                      </select>
                      <input type="number" className="w-full border p-2 mb-2 rounded" value={formData.totalFee} onChange={e=>setFormData({...formData, totalFee: e.target.value})} placeholder="Total Fee"/>
                      <input type="number" className="w-full border p-2 mb-4 rounded" value={formData.paid} onChange={e=>setFormData({...formData, paid: e.target.value})} placeholder="Paid"/>
                      <button onClick={handleSaveStudent} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl mb-2 transition-colors">Save</button>
                      <button onClick={()=>setIsModalOpen(false)} className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl transition-colors">Cancel</button>
                      {editingStudent && (
                          <button onClick={handleDeleteStudent} className="w-full bg-white text-rose-600 font-bold py-2.5 rounded-xl border border-rose-200 mt-4 hover:bg-rose-50 transition-colors">
                              Delete Student
                          </button>
                      )}
                  </div>
              </div>
          )}
      </div>
  );
}

export default App;
