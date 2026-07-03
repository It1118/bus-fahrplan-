// ==========================================
// DATEI: src/main.jsx
// ==========================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// ==========================================
// DATEI: src/App.jsx
// ==========================================
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, LogOut, Plus, Mic, Clock, Home, Loader2 } from 'lucide-react';

const API = '/api';

export default function App() {
  const [session, setSession] = useState(() => {
    const saved = sessionStorage.getItem('busSession');
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState('login');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [schedules, setSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [newSchedule, setNewSchedule] = useState({ line: '', destination: '', departure: '', delay: 0 });
  const [now, setNow] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  // Freigegebener Link (öffentliche Ansicht ohne Login)
  const [sharedView, setSharedView] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
      fetch(`${API}/share/${shareId}`)
        .then(r => r.json())
        .then(data => {
          if (data.schedule) setSharedView(data.schedule);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session) {
      sessionStorage.setItem('busSession', JSON.stringify(session));
    } else {
      sessionStorage.removeItem('busSession');
    }
  }, [session]);

  const loadSchedules = useCallback(async () => {
    if (!session) return;
    setLoadingSchedules(true);
    try {
      const res = await fetch(`${API}/schedules?email=${encodeURIComponent(session.email)}&token=${session.token}`);
      const data = await res.json();
      if (data.schedules) setSchedules(data.schedules);
    } catch (e) {
      console.error(e);
    }
    setLoadingSchedules(false);
  }, [session]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (registerData.password !== registerData.confirmPassword) {
      setAuthError('Passwörter stimmen nicht überein!');
      return;
    }
    setAuthLoading(true);
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerData.email, password: registerData.password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Registrierung fehlgeschlagen.');
      } else {
        setSession({ email: data.email, token: data.token });
        setRegisterData({ email: '', password: '', confirmPassword: '' });
      }
    } catch (e) {
      setAuthError('Server nicht erreichbar.');
    }
    setAuthLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginData.email, password: loginData.password })
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Anmeldung fehlgeschlagen.');
      } else {
        setSession({ email: data.email, token: data.token });
        setLoginData({ email: '', password: '' });
      }
    } catch (e) {
      setAuthError('Server nicht erreichbar.');
    }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    setSession(null);
    setSchedules([]);
    setSelectedSchedule(null);
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Account wirklich löschen? Alle Daten werden unwiderruflich gelöscht!')) return;
    try {
      await fetch(`${API}/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, token: session.token })
      });
    } catch (e) {
      console.error(e);
    }
    setSession(null);
    setSchedules([]);
  };

  const addSchedule = async (e) => {
    e.preventDefault();
    if (!newSchedule.line || !newSchedule.destination || !newSchedule.departure) {
      alert('Alle Felder ausfüllen!');
      return;
    }
    try {
      const res = await fetch(`${API}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.email,
          token: session.token,
          line: newSchedule.line,
          destination: newSchedule.destination,
          departure: newSchedule.departure,
          delay: parseInt(newSchedule.delay) || 0
        })
      });
      if (res.ok) {
        setNewSchedule({ line: '', destination: '', departure: '', delay: 0 });
        loadSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await fetch(`${API}/schedules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, token: session.token, id })
      });
      loadSchedules();
      if (selectedSchedule?.id === id) setSelectedSchedule(null);
    } catch (e) {
      console.error(e);
    }
  };

  const calculateTime = (departureStr) => {
    const [depHour, depMin] = departureStr.split(':').map(Number);
    const depDate = new Date(now);
    depDate.setHours(depHour, depMin, 0);
    return depDate;
  };

  const getTimeUntil = (departureStr, delay) => {
    const depTime = calculateTime(departureStr);
    const delayedTime = new Date(depTime.getTime() + delay * 60000);
    const diff = delayedTime - now;
    if (diff < 0) return null;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { minutes, seconds };
  };

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'de-DE';
      speechSynthesis.speak(utterance);
    }
  };

  const generateShareLink = (schedule) => {
    return `${window.location.origin}${window.location.pathname}?share=${schedule.id}`;
  };

  const handleAnnouncement = (schedule) => {
    const status = schedule.delay > 0
      ? `mit Verspätung von ${schedule.delay} Minuten`
      : schedule.delay < 0
      ? `Fahrt ist ${Math.abs(schedule.delay)} Minuten früher`
      : 'pünktlich';
    const text = `Linie ${schedule.line} in Richtung ${schedule.destination} fährt ${status}. Abfahrtszeit: ${schedule.departure} Uhr.`;
    speak(text);
  };

  // Öffentliche geteilte Ansicht (kein Login nötig)
  if (sharedView) {
    const time = getTimeUntil(sharedView.departure, sharedView.delay);
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-black rounded-xl p-8 border-4 border-yellow-400 shadow-2xl" style={{ fontFamily: 'monospace' }}>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-6xl font-bold text-yellow-400 mb-4">{sharedView.line}</div>
                <div className="text-xl text-yellow-400 border-t-2 border-yellow-400 pt-4">LINIE</div>
              </div>
              <div className="text-center flex flex-col justify-center">
                <div className="text-4xl font-bold text-yellow-400 break-words">
                  {sharedView.destination.toUpperCase()}
                </div>
                <div className="text-lg text-yellow-400 mt-4">ZIELORT</div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t-2 border-yellow-400 grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-sm text-yellow-400 mb-2">ABFAHRT</div>
                <div className="text-4xl font-bold text-yellow-400">{sharedView.departure}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-yellow-400 mb-2">VERZÖGERUNG</div>
                <div className={`text-4xl font-bold ${sharedView.delay > 0 ? 'text-red-500' : sharedView.delay < 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                  {sharedView.delay > 0 ? '+' : ''}{sharedView.delay}
                </div>
                <div className="text-xs text-gray-400 mt-1">MIN</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-yellow-400 mb-2">WARTEZEIT</div>
                {time ? (
                  <div className="text-4xl font-bold text-green-400 animate-pulse">
                    {String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
                  </div>
                ) : (
                  <div className="text-3xl font-bold text-red-500">VORBEI</div>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => handleAnnouncement(sharedView)}
            className="mt-6 w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3 rounded-lg transition text-lg"
          >
            <Mic className="w-5 h-5" /> Durchsage
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-block bg-yellow-400 text-slate-900 p-4 rounded-lg mb-4">
                <Mic className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Bus Fahrplan</h1>
              <p className="text-slate-600 mt-2">Manage deine Fahrpläne</p>
            </div>

            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-2 px-4 rounded font-semibold transition ${authMode === 'login' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
              >
                Anmelden
              </button>
              <button
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-2 px-4 rounded font-semibold transition ${authMode === 'register' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
              >
                Registrieren
              </button>
            </div>

            {authError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                {authError}
              </div>
            )}

            {authMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <input type="email" placeholder="Email" value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <input type="password" placeholder="Passwort" value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <button type="submit" disabled={authLoading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {authLoading && <Loader2 className="w-4 h-4 animate-spin" />} Anmelden
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <input type="email" placeholder="Email" value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <input type="password" placeholder="Passwort (mind. 6 Zeichen)" value={registerData.password}
                  onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required minLength={6} />
                <input type="password" placeholder="Passwort bestätigen" value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required />
                <button type="submit" disabled={authLoading}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {authLoading && <Loader2 className="w-4 h-4 animate-spin" />} Registrieren
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="bg-gradient-to-r from-blue-900 to-slate-800 border-b-4 border-yellow-400 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded">BUS</span>
              Fahrplan Manager
            </h1>
            <p className="text-slate-300 text-sm mt-1">{session.email}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelectedSchedule(null)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition">
              <Home className="w-4 h-4" /> Übersicht
            </button>
            <button onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {selectedSchedule ? (
          <div className="space-y-6">
            <button onClick={() => setSelectedSchedule(null)}
              className="mb-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
              ← Zurück
            </button>

            <div className="bg-black rounded-xl p-8 border-4 border-yellow-400 shadow-2xl" style={{ fontFamily: 'monospace' }}>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="text-6xl font-bold text-yellow-400 mb-4">{selectedSchedule.line}</div>
                  <div className="text-xl text-yellow-400 border-t-2 border-yellow-400 pt-4">LINIE</div>
                </div>
                <div className="text-center flex flex-col justify-center">
                  <div className="text-4xl font-bold text-yellow-400 break-words">
                    {selectedSchedule.destination.toUpperCase()}
                  </div>
                  <div className="text-lg text-yellow-400 mt-4">ZIELORT</div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t-2 border-yellow-400 grid grid-cols-3 gap-4">
                {(() => {
                  const time = getTimeUntil(selectedSchedule.departure, selectedSchedule.delay);
                  return (
                    <>
                      <div className="text-center">
                        <div className="text-sm text-yellow-400 mb-2">ABFAHRT</div>
                        <div className="text-4xl font-bold text-yellow-400">{selectedSchedule.departure}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-yellow-400 mb-2">VERZÖGERUNG</div>
                        <div className={`text-4xl font-bold ${selectedSchedule.delay > 0 ? 'text-red-500' : selectedSchedule.delay < 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {selectedSchedule.delay > 0 ? '+' : ''}{selectedSchedule.delay}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">MIN</div>
                      </div>
                      <div className="text-center">
                        <div className="text-sm text-yellow-400 mb-2">WARTEZEIT</div>
                        {time ? (
                          <div className="text-4xl font-bold text-green-400 animate-pulse">
                            {String(time.minutes).padStart(2, '0')}:{String(time.seconds).padStart(2, '0')}
                          </div>
                        ) : (
                          <div className="text-3xl font-bold text-red-500">VORBEI</div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="mt-6 text-center">
                <div className="text-2xl text-yellow-400">
                  {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={() => handleAnnouncement(selectedSchedule)}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-8 py-3 rounded-lg transition text-lg">
                <Mic className="w-5 h-5" /> Durchsage
              </button>
              <button onClick={() => {
                  const link = generateShareLink(selectedSchedule);
                  navigator.clipboard.writeText(link);
                  alert('Link kopiert!');
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 font-bold px-8 py-3 rounded-lg transition text-lg">
                <Clock className="w-5 h-5" /> Link teilen
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 sticky top-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-yellow-400" /> Neue Fahrt
                </h2>
                <form onSubmit={addSchedule} className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Linie</label>
                    <input type="text" placeholder="z.B. 10, 105, X5" value={newSchedule.line}
                      onChange={(e) => setNewSchedule({ ...newSchedule, line: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Zielort</label>
                    <input type="text" placeholder="z.B. Hauptbahnhof" value={newSchedule.destination}
                      onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Abfahrtszeit</label>
                    <input type="time" value={newSchedule.departure}
                      onChange={(e) => setNewSchedule({ ...newSchedule, departure: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Verspätung (Min)</label>
                    <input type="number" value={newSchedule.delay}
                      onChange={(e) => setNewSchedule({ ...newSchedule, delay: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 text-white" />
                    <p className="text-xs text-slate-500 mt-1">Negativ = früher, Positiv = Verspätung</p>
                  </div>
                  <button type="submit"
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 rounded-lg transition">
                    + Fahrt erstellen
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Clock className="w-6 h-6 text-yellow-400" /> Deine Fahrpläne ({schedules.length})
              </h2>

              {loadingSchedules ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-yellow-400" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 bg-slate-800 rounded-xl border border-slate-700">
                  <p className="text-slate-400 text-lg">Keine Fahrpläne erstellt.</p>
                  <p className="text-slate-500 text-sm mt-2">Erstelle eine neue Fahrt mit dem Formular links!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map(schedule => {
                    const time = getTimeUntil(schedule.departure, schedule.delay);
                    return (
                      <div key={schedule.id}
                        className="bg-slate-800 rounded-xl p-6 border-l-4 border-yellow-400 hover:bg-slate-700 transition cursor-pointer"
                        onClick={() => setSelectedSchedule(schedule)}>
                        <div className="flex justify-between items-start mb-4 flex-wrap gap-4">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl font-bold text-yellow-400 min-w-fit">{schedule.line}</span>
                            <div>
                              <h3 className="text-xl font-bold">{schedule.destination}</h3>
                              <p className="text-slate-400">{schedule.departure}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {schedule.delay !== 0 && (
                              <div className={`text-xl font-bold mb-2 ${schedule.delay > 0 ? 'text-red-500' : 'text-green-400'}`}>
                                {schedule.delay > 0 ? '+ ' : ''}{schedule.delay} min
                              </div>
                            )}
                            {time ? (
                              <div className="text-2xl font-bold text-green-400">
                                {time.minutes}:{String(time.seconds).padStart(2, '0')}
                              </div>
                            ) : (
                              <div className="text-lg text-red-500 font-bold">Vorbei</div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 justify-between pt-4 border-t border-slate-700">
                          <button onClick={(e) => { e.stopPropagation(); handleAnnouncement(schedule); }}
                            className="flex-1 flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded-lg transition">
                            <Mic className="w-4 h-4" /> Durchsage
                          </button>
                          <button onClick={(e) => {
                              e.stopPropagation();
                              const link = generateShareLink(schedule);
                              navigator.clipboard.writeText(link);
                              alert('Link kopiert!');
                            }}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 font-semibold py-2 rounded-lg transition">
                            <Clock className="w-4 h-4" /> Link
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); deleteSchedule(schedule.id); }}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-12 bg-slate-800 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-red-500">⚠ Account-Einstellungen</h3>
                <button onClick={handleDeleteAccount}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition flex items-center justify-center gap-2">
                  <Trash2 className="w-5 h-5" /> Account löschen
                </button>
                <p className="text-slate-400 text-sm mt-3">Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// DATEI: vite.config.js
// ==========================================
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist'
  }
})

// ==========================================
// DATEI: tailwind.config.js
// ==========================================
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

// ==========================================
// DATEI: postcss.config.js
// ==========================================
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}

// ==========================================
// DATEI: functions/api/register.js
// ==========================================
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  const arr = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, password } = await request.json();

  if (!email || !password || password.length < 6) {
    return Response.json({ error: 'Ungültige Eingabe. Passwort muss mind. 6 Zeichen haben.' }, { status: 400 });
  }

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return Response.json({ error: 'Diese Email ist bereits registriert.' }, { status: 409 });
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const token = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO users (email, password_hash, salt, session_token, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(email, passwordHash, salt, token, new Date().toISOString()).run();

  return Response.json({ email, token });
}

// ==========================================
// DATEI: functions/api/login.js
// ==========================================
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, password } = await request.json();

  if (!email || !password) {
    return Response.json({ error: 'Email und Passwort erforderlich.' }, { status: 400 });
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    return Response.json({ error: 'Email oder Passwort falsch.' }, { status: 401 });
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.password_hash) {
    return Response.json({ error: 'Email oder Passwort falsch.' }, { status: 401 });
  }

  const token = crypto.randomUUID();
  await env.DB.prepare('UPDATE users SET session_token = ? WHERE email = ?').bind(token, email).run();

  return Response.json({ email: user.email, token });
}

// ==========================================
// DATEI: functions/api/delete-account.js
// ==========================================
export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, token } = await request.json();

  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND session_token = ?')
    .bind(email, token).first();

  if (!user) {
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }

  await env.DB.prepare('DELETE FROM schedules WHERE user_email = ?').bind(email).run();
  await env.DB.prepare('DELETE FROM users WHERE email = ?').bind(email).run();

  return Response.json({ success: true });
}

// ==========================================
// DATEI: functions/api/schedules.js
// ==========================================
async function authenticate(env, email, token) {
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND session_token = ?')
    .bind(email, token).first();
  return user;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const email = url.searchParams.get('email');
  const token = url.searchParams.get('token');

  const user = await authenticate(env, email, token);
  if (!user) {
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }

  const { results } = await env.DB.prepare(
    'SELECT * FROM schedules WHERE user_email = ? ORDER BY departure ASC'
  ).bind(email).all();

  return Response.json({ schedules: results });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, token, line, destination, departure, delay } = await request.json();

  const user = await authenticate(env, email, token);
  if (!user) {
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO schedules (id, user_email, line, destination, departure, delay, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, email, line, destination, departure, delay || 0, new Date().toISOString()).run();

  return Response.json({ id, line, destination, departure, delay: delay || 0 });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const { email, token, id } = await request.json();

  const user = await authenticate(env, email, token);
  if (!user) {
    return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  }

  await env.DB.prepare('DELETE FROM schedules WHERE id = ? AND user_email = ?').bind(id, email).run();
  return Response.json({ success: true });
}

// ==========================================
// DATEI: functions/api/share/[id].js
// ==========================================
export async function onRequestGet(context) {
  const { env, params } = context;
  const { id } = params;

  const schedule = await env.DB.prepare('SELECT * FROM schedules WHERE id = ?').bind(id).first();
  if (!schedule) {
    return Response.json({ error: 'Fahrplan nicht gefunden.' }, { status: 404 });
  }

  return Response.json({ schedule });
}
