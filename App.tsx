
import React, { useState, useEffect } from 'react';
import { User, UserRole, MarketingRequest, RequestStatus, Region, Branch, PromoType } from './types';
import { INITIAL_USERS, REGIONS, BRANCHES, PROMO_TYPES, INITIAL_REQUESTS } from './constants';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RequestForm from './components/RequestForm';
import AdminPanel from './components/AdminPanel';
import AnalyticsView from './components/AnalyticsView';
import Login from './components/Login';
import { supabase } from './services/supabase';

// Помощник для преобразования данных из БД (snake_case) в приложение (camelCase)
const mapFromDb = (item: any): MarketingRequest => ({
  id: item.id,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  rtmId: item.rtm_id,
  rtmName: item.rtm_name,
  regionId: item.region_id,
  branches: item.branches,
  status: item.status,
  approvedAmount: item.approved_amount,
  tmComment: item.tm_comment,
});

// Помощник для преобразования данных из приложения в БД
const mapToDb = (req: Partial<MarketingRequest>) => {
  const mapped: any = {};
  if (req.id !== undefined) mapped.id = req.id;
  if (req.createdAt !== undefined) mapped.created_at = req.createdAt;
  if (req.updatedAt !== undefined) mapped.updated_at = req.updatedAt;
  if (req.rtmId !== undefined) mapped.rtm_id = req.rtmId;
  if (req.rtmName !== undefined) mapped.rtm_name = req.rtmName;
  if (req.regionId !== undefined) mapped.region_id = req.regionId;
  if (req.branches !== undefined) mapped.branches = req.branches;
  if (req.status !== undefined) mapped.status = req.status;
  if (req.approvedAmount !== undefined) mapped.approved_amount = req.approvedAmount;
  if (req.tmComment !== undefined) mapped.tm_comment = req.tmComment;
  return mapped;
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'CREATE' | 'ADMIN' | 'ANALYTICS'>('DASHBOARD');
  const [loading, setLoading] = useState(true);
  
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [regions, setRegions] = useState<Region[]>(REGIONS);
  const [branches, setBranches] = useState<Branch[]>(BRANCHES);
  const [promoTypes, setPromoTypes] = useState<PromoType[]>(PROMO_TYPES);
  const [requests, setRequests] = useState<MarketingRequest[]>(INITIAL_REQUESTS);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const mappedData = data.map(mapFromDb);
        setRequests(mappedData);
        localStorage.setItem('mf_manager_requests', JSON.stringify(mappedData));
      } else {
        const saved = localStorage.getItem('mf_manager_requests');
        if (saved) setRequests(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Supabase error, using local storage:', e);
      const saved = localStorage.getItem('mf_manager_requests');
      if (saved) setRequests(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Проверка сессии при загрузке
    const savedUser = localStorage.getItem('mf_session_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsLoggedIn(true);
      } catch (e) {
        console.error('Invalid session data');
      }
    }

    fetchData();

    let channel: any;
    try {
      channel = supabase
        .channel('db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
          fetchData();
        })
        .subscribe();
    } catch (e) {
      console.warn('Real-time subscription failed');
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleLogin = (user: User, remember: boolean) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    if (remember) {
      localStorage.setItem('mf_session_user', JSON.stringify(user));
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView('DASHBOARD');
    localStorage.removeItem('mf_session_user');
  };

  const addRequest = async (newRequest: MarketingRequest) => {
    const updatedRequests = [newRequest, ...requests];
    setRequests(updatedRequests);
    localStorage.setItem('mf_manager_requests', JSON.stringify(updatedRequests));
    setView('DASHBOARD');
    
    try {
      const dbRequest = mapToDb(newRequest);
      const { error } = await supabase.from('requests').insert([dbRequest]);
      if (error) console.error('Ошибка сохранения в БД:', error.message);
    } catch (e) {
      console.error('Ошибка сети при сохранении:', e);
    }
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus, additionalData?: Partial<MarketingRequest>) => {
    const now = new Date().toISOString();
    const updatedRequests = requests.map(req => {
      if (req.id === requestId) {
        return { 
          ...req, 
          status, 
          ...additionalData,
          updatedAt: now
        };
      }
      return req;
    });
    
    setRequests(updatedRequests);
    localStorage.setItem('mf_manager_requests', JSON.stringify(updatedRequests));

    try {
      const dbUpdate = mapToDb({ 
        status, 
        ...additionalData,
        updatedAt: now
      });
      
      const { error } = await supabase
        .from('requests')
        .update(dbUpdate)
        .eq('id', requestId);
        
      if (error) console.error('Ошибка обновления в БД:', error.message);
    } catch (e) {
      console.error('Ошибка сети при обновлении:', e);
    }
  };

  const resetData = async () => {
    if (confirm('Вы уверены, что хотите очистить локальный кэш?')) {
      setRequests(INITIAL_REQUESTS);
      localStorage.removeItem('mf_manager_requests');
      alert('Локальный кэш сброшен.');
    }
  };

  if (!isLoggedIn || !currentUser) {
    return <Login users={users} onLogin={handleLogin} />;
  }

  return (
    <Layout 
      currentUser={currentUser} 
      onLogout={handleLogout} 
      onNavigate={setView}
      currentView={view}
    >
      {loading && (
        <div className="flex items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 animate-pulse">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-slate-500 font-medium text-sm">Синхронизация данных...</span>
        </div>
      )}
      
      {view === 'DASHBOARD' && (
        <Dashboard 
          currentUser={currentUser} 
          requests={requests} 
          onUpdateStatus={updateRequestStatus}
          onCreateNew={() => setView('CREATE')}
        />
      )}
      {view === 'ANALYTICS' && (
        <AnalyticsView 
          requests={requests} 
          regions={regions}
          promoTypes={promoTypes}
          branches={branches}
          currentUser={currentUser}
        />
      )}
      {view === 'CREATE' && (
        <RequestForm 
          currentUser={currentUser} 
          branches={branches}
          regions={regions}
          promoTypes={promoTypes}
          onSubmit={addRequest} 
          onCancel={() => setView('DASHBOARD')}
        />
      )}
      {view === 'ADMIN' && (
        <div className="space-y-6">
          <AdminPanel 
            users={users}
            regions={regions}
            branches={branches}
            promoTypes={promoTypes}
            onUpdateUsers={setUsers}
            onUpdateRegions={setRegions}
            onUpdateBranches={setBranches}
            onUpdatePromoTypes={setPromoTypes}
          />
          <div className="p-6 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
            <div>
              <h4 className="text-red-800 font-bold">Управление кэшем</h4>
              <p className="text-red-600 text-sm">Очистка локальной памяти браузера.</p>
            </div>
            <button 
              onClick={resetData}
              className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
            >
              Сбросить кэш
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
