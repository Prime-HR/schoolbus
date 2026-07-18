import React, { useState, useMemo, useEffect } from 'react';
import { useSupabase } from './hooks/useSupabase';
import { Scanner } from '@yudiel/react-qr-scanner';
import QRCode from 'react-qr-code';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1];
const QUICK_BILLS = [100, 50, 20, 10, 5];

function App() {
  const { user, login, logout, students, transactions, tickets, till, loading, addStudent, updateStudent, deleteStudent, recordTransaction, updateTill, generateTickets, useTicket } = useSupabase();
  const [view, setView] = useState('driver'); 
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedRoute, setSelectedRoute] = useState('All');
  
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [feeDue, setFeeDue] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [receivedDenomination, setReceivedDenomination] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [formData, setFormData] = useState({ name: '', grade: '', plan: 'Monthly', totalFee: '', paid: '', route: '', stop_name: '' });

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [keypadInput, setKeypadInput] = useState('');
  const [scanResult, setScanResult] = useState(null);

  const selectedStudent = useMemo(() => students.find(s => s.id === selectedStudentId) || null, [students, selectedStudentId]);

  const filteredStudents = useMemo(() => {
      return students.filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.grade.toLowerCase().includes(search.toLowerCase());
          const matchesRoute = selectedRoute === 'All' || s.route === selectedRoute;
          const isPaid = s.paid >= s.total_fee;
          if (filter === 'paid') return matchesSearch && matchesRoute && isPaid;
          if (filter === 'unpaid') return matchesSearch && matchesRoute && !isPaid;
          return matchesSearch && matchesRoute;
      });
  }, [students, search, filter, selectedRoute]);

  const groupedByStop = useMemo(() => {
      const groups = {};
      filteredStudents.forEach(s => {
          const stop = s.stop_name || 'Unassigned Stop';
          if (!groups[stop]) groups[stop] = [];
          groups[stop].push(s);
      });
      // Sort keys alphabetically
      return Object.keys(groups).sort().reduce((acc, key) => {
          acc[key] = groups[key];
          return acc;
      }, {});
  }, [filteredStudents]);

  const uniqueRoutes = useMemo(() => {
      const routes = new Set(students.map(s => s.route).filter(Boolean));
      return ['All', ...Array.from(routes).sort()];
  }, [students]);

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
      setFormData({ name: '', grade: '', plan: 'Monthly', totalFee: '', paid: '0', route: '', stop_name: '' });
      setIsModalOpen(true);
  };

  const openEditModal = (student) => {
      setEditingStudent(student);
      setFormData({
          name: student.name,
          grade: student.grade,
          plan: student.plan || 'Monthly',
          totalFee: student.total_fee.toString(),
          paid: student.paid.toString(),
          route: student.route || '',
          stop_name: student.stop_name || ''
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
              name: formData.name, grade: formData.grade, plan: formData.plan, total_fee: totalFeeNum, paid: paidNum, route: formData.route, stop_name: formData.stop_name
          });
      } else {
          await addStudent({
              name: formData.name, grade: formData.grade || '-', plan: formData.plan, total_fee: totalFeeNum, paid: paidNum, route: formData.route, stop_name: formData.stop_name
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

  const handleScan = (result) => {
      if (!result || !result[0]) return;
      const scannedId = result[0].rawValue;
      const student = students.find(s => s.id === scannedId);
      
      if (student) {
          const isPaid = student.paid >= student.total_fee;
          setScanResult({
              student,
              status: isPaid ? 'success' : 'error',
              message: isPaid ? 'BOARDED - PAID' : `UNPAID: OWES GH₵${student.total_fee - student.paid}`
          });
          setIsScannerOpen(false);
          // Play a simple beep
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          osc.type = isPaid ? 'sine' : 'sawtooth';
          osc.frequency.setValueAtTime(isPaid ? 800 : 200, ctx.currentTime);
          osc.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.2);
          
          setTimeout(() => {
              setScanResult(null);
              // Option to reopen scanner automatically or stay on list
          }, 3000);
      } else {
          alert('Invalid QR Code. Student not found.');
      }
  };

  const handleKeypadSubmit = async (code) => {
      const res = await useTicket(code);
      if (res.success) {
          setScanResult({
              status: 'success',
              title: `Code ${code}`,
              message: 'TICKET VALID - BOARDED'
          });
      } else {
          setScanResult({
              status: 'error',
              title: `Code ${code}`,
              message: res.error
          });
      }
      setIsKeypadOpen(false);
      setKeypadInput('');
      
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      osc.type = res.success ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(res.success ? 800 : 200, ctx.currentTime);
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      
      setTimeout(() => {
          setScanResult(null);
      }, 3000);
  };

  const handleKeypadPress = (num) => {
      if (keypadInput.length < 3) {
          const newVal = keypadInput + num;
          setKeypadInput(newVal);
          if (newVal.length === 3) {
              handleKeypadSubmit(newVal);
          }
      }
  };

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

                      {uniqueRoutes.length > 1 && (
                          <div className="mb-3">
                              <select 
                                  value={selectedRoute} 
                                  onChange={(e) => setSelectedRoute(e.target.value)}
                                  className="w-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                              >
                                  {uniqueRoutes.map(route => (
                                      <option key={route} value={route}>{route === 'All' ? '🚌 All Routes' : `🚌 ${route}`}</option>
                                  ))}
                              </select>
                          </div>
                      )}

                      <input type="text" placeholder="Search passenger..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={search} onChange={(e) => setSearch(e.target.value)} />
                      
                      <div className="space-y-4">
                          {Object.entries(groupedByStop).map(([stop, stopStudents]) => (
                              <div key={stop} className="mb-4">
                                  <div className="flex items-center gap-2 mb-2 pl-1">
                                      <span className="text-lg">📍</span>
                                      <h3 className="font-bold text-slate-700 text-sm">{stop}</h3>
                                      <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-0.5 rounded-full">{stopStudents.length}</span>
                                  </div>
                                  <div className="space-y-2 border-l-2 border-slate-100 pl-3 ml-2">
                                      {stopStudents.map(student => {
                                          const status = getStatus(student.paid, student.total_fee);
                                          const owed = student.total_fee - student.paid;
                                          return (
                                              <div key={student.id} onClick={() => { setSelectedStudentId(student.id); setFeeDue(owed > 0 ? owed : ''); }} className={`p-3 rounded-xl border cursor-pointer active:scale-95 transition-transform ${selectedStudentId === student.id ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-slate-100 bg-slate-50'}`}>
                                                  <div className="flex justify-between items-center">
                                                      <div>
                                                          <h3 className="font-bold text-sm text-slate-800">{student.name}</h3>
                                                          <p className="text-xs text-slate-500 font-medium">{student.grade}</p>
                                                      </div>
                                                      <div className="text-right flex flex-col items-end">
                                                          <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${status.color}`}>
                                                              {status.label}
                                                          </span>
                                                          {owed > 0 && <span className="text-xs font-bold text-rose-600 mt-1">Owes GH₵{owed}</span>}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                          
                          {filteredStudents.length === 0 && (
                              <div className="text-center p-8 text-slate-400">
                                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                                  <p className="text-sm font-bold">No passengers found.</p>
                              </div>
                          )}
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
                  
                  {/* Floating Action Buttons */}
                  <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
                      <button onClick={() => setIsKeypadOpen(true)} className="bg-slate-800 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border-2 border-slate-700 active:scale-95 transition-transform" title="Enter Secret Code">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      </button>
                      <button onClick={() => setIsScannerOpen(true)} className="bg-indigo-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center border-4 border-white active:scale-95 transition-transform" title="Scan QR Code">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                      </button>
                  </div>
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
                  
                  <div className="bg-white p-3 rounded shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold">Tickets (Secret Codes)</h3>
                          <button onClick={() => generateTickets(10)} className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">Generate 10</button>
                      </div>
                      <div className="flex gap-2 mb-2">
                          <div className="flex-1 bg-slate-50 p-2 text-center rounded"><p className="text-[10px] text-slate-500 font-bold">UNUSED</p><p className="font-bold">{tickets.filter(t => !t.is_used).length}</p></div>
                          <div className="flex-1 bg-slate-50 p-2 text-center rounded"><p className="text-[10px] text-slate-500 font-bold">USED</p><p className="font-bold">{tickets.filter(t => t.is_used).length}</p></div>
                      </div>
                      <div className="max-h-32 overflow-y-auto flex gap-2 flex-wrap">
                          {tickets.filter(t => !t.is_used).map(t => (
                              <span key={t.id} className="bg-emerald-100 text-emerald-800 font-mono text-xs px-2 py-1 rounded border border-emerald-200">{t.code}</span>
                          ))}
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
                          <option value="Daily">Daily</option>
                          <option value="Monthly">Monthly</option>
                          <option value="Termly">Termly</option>
                      </select>
                      
                      <div className="flex gap-2 mb-2">
                          <input type="text" className="w-1/2 border p-2 rounded bg-slate-50" value={formData.route} onChange={e=>setFormData({...formData, route: e.target.value})} placeholder="Route (e.g. Morning A)"/>
                          <input type="text" className="w-1/2 border p-2 rounded bg-slate-50" value={formData.stop_name} onChange={e=>setFormData({...formData, stop_name: e.target.value})} placeholder="Stop (e.g. Osu Mall)"/>
                      </div>

                      <input type="number" className="w-full border p-2 mb-2 rounded" value={formData.totalFee} onChange={e=>setFormData({...formData, totalFee: e.target.value})} placeholder="Total Fee"/>
                      <input type="number" className="w-full border p-2 mb-4 rounded" value={formData.paid} onChange={e=>setFormData({...formData, paid: e.target.value})} placeholder="Paid"/>
                      
                      {editingStudent && (
                          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                              <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Student QR Code</p>
                              <div className="p-2 bg-white rounded-lg shadow-sm">
                                  <QRCode value={editingStudent.id} size={150} />
                              </div>
                          </div>
                      )}
                      
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

          {/* QR Scanner Modal */}
          {isScannerOpen && (
              <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center">
                  <div className="relative w-full h-[80dvh] bg-black flex items-center justify-center overflow-hidden">
                      <Scanner 
                          onScan={handleScan}
                          formats={['qr_code']}
                          components={{
                              audio: false,
                              finder: true,
                          }}
                          styles={{
                              container: { width: '100%', height: '100%' }
                          }}
                      />
                  </div>
                  <div className="h-[20dvh] w-full flex items-center justify-center bg-slate-900 pb-8">
                      <button onClick={() => setIsScannerOpen(false)} className="bg-white text-slate-900 font-bold px-8 py-3 rounded-full text-lg shadow-xl active:scale-95 transition-transform">
                          Close Scanner
                      </button>
                  </div>
              </div>
          )}

          {/* Keypad Modal */}
          {isKeypadOpen && (
              <div className="absolute inset-0 bg-slate-900/95 z-50 flex flex-col items-center justify-center p-6 animate-fadeIn">
                  <div className="w-full max-w-xs">
                      <div className="text-center mb-8">
                          <h2 className="text-white text-xl font-bold opacity-80 mb-2">Enter Secret Code</h2>
                          <div className="flex justify-center gap-4">
                              {[0,1,2].map(i => (
                                  <div key={i} className={`w-16 h-20 rounded-xl border-2 flex items-center justify-center text-4xl font-mono text-white transition-all ${keypadInput.length > i ? 'bg-indigo-600 border-indigo-500 shadow-[0_0_15px_rgba(79,70,229,0.5)]' : 'bg-slate-800 border-slate-700'}`}>
                                      {keypadInput[i] || ''}
                                  </div>
                              ))}
                          </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mb-8">
                          {[1,2,3,4,5,6,7,8,9].map(num => (
                              <button key={num} onClick={() => handleKeypadPress(num.toString())} className="bg-slate-800 text-white rounded-2xl h-16 text-2xl font-bold shadow-lg active:scale-95 active:bg-slate-700 transition-all border border-slate-700">
                                  {num}
                              </button>
                          ))}
                          <div className="col-start-2">
                              <button onClick={() => handleKeypadPress('0')} className="w-full bg-slate-800 text-white rounded-2xl h-16 text-2xl font-bold shadow-lg active:scale-95 active:bg-slate-700 transition-all border border-slate-700">
                                  0
                              </button>
                          </div>
                          <div className="col-start-3 flex items-center justify-center">
                              <button onClick={() => setKeypadInput(prev => prev.slice(0, -1))} className="text-slate-400 active:text-white transition-colors p-4">
                                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"></path></svg>
                              </button>
                          </div>
                      </div>
                      <button onClick={() => { setIsKeypadOpen(false); setKeypadInput(''); }} className="w-full text-slate-400 font-bold py-4 rounded-xl active:bg-slate-800 transition-colors uppercase tracking-wider text-sm">
                          Cancel
                      </button>
                  </div>
              </div>
          )}

          {/* Scan Result Flash Screen */}
          {scanResult && (
              <div className={`absolute inset-0 z-[60] flex flex-col items-center justify-center p-6 text-center animate-fadeIn ${scanResult.status === 'success' ? 'bg-emerald-500' : 'bg-rose-600'}`}>
                  <div className="bg-white/20 p-6 rounded-full mb-6">
                      {scanResult.status === 'success' ? (
                          <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      ) : (
                          <svg className="w-24 h-24 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                      )}
                  </div>
                  <h1 className="text-5xl font-black text-white mb-2">{scanResult.title || (scanResult.student && scanResult.student.name)}</h1>
                  {(scanResult.student && scanResult.student.grade) && <p className="text-white text-xl font-bold opacity-90">{scanResult.student.grade}</p>}
                  <div className="mt-8 bg-white text-slate-900 px-6 py-3 rounded-xl shadow-2xl font-black text-2xl tracking-wide">
                      {scanResult.message}
                  </div>
              </div>
          )}
      </div>
  );
}

export default App;
