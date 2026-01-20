
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, MarketingRequest, RequestStatus, Region, Branch, PromoType } from './types';
import { INITIAL_USERS, REGIONS, BRANCHES, PROMO_TYPES, INITIAL_REQUESTS } from './constants';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RequestForm from './components/RequestForm';
import AdminPanel from './components/AdminPanel';
import AnalyticsView from './components/AnalyticsView';
import Login from './components/Login';
import Toaster, { ToastMessage } from './components/Toaster';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<'DASHBOARD' | 'CREATE' | 'ADMIN' | 'ANALYTICS'>('DASHBOARD');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [regions, setRegions] = useState<Region[]>(REGIONS);
  const [branches, setBranches] = useState<Branch[]>(BRANCHES);
  const [promoTypes, setPromoTypes] = useState<PromoType[]>(PROMO_TYPES);
  const [requests, setRequests] = useState<MarketingRequest[]>(INITIAL_REQUESTS);

  const addToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, text, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      if (data && data.length > 0) {
        setRequests(data.map(item => ({
          id: item.id,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          rtmId: item.rtm_id,
          rtmName: item.rtm_name,
          regionId: item.region_id,
          branches: item.branches,
          status: item.status as RequestStatus,
          approvedAmount: item.approved_amount,
          tmComment: item.tm_comment,
        })));
      }
    } catch (e) {
      console.warn('Supabase fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('mf_session_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsLoggedIn(true);
      } catch (e) { console.error('Invalid session'); }
    }
    fetchData();
  }, []);

  const handleLogin = (user: User, remember: boolean) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    if (remember) localStorage.setItem('mf_session_user', JSON.stringify(user));
    addToast(`С возвращением, ${user.name.split(' ')[0]}!`, 'success');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setView('DASHBOARD');
    localStorage.removeItem('mf_session_user');
    addToast('Вы вышли из системы', 'info');
  };

  const addRequest = async (newRequest: MarketingRequest) => {
    const oldRequests = [...requests];
    setRequests([newRequest, ...requests]);
    setView('DASHBOARD');
    
    try {
      const { error } = await supabase.from('requests').insert([{
        id: newRequest.id,
        created_at: newRequest.createdAt,
        updated_at: newRequest.updatedAt,
        rtm_id: newRequest.rtmId,
        rtm_name: newRequest.rtmName,
        region_id: newRequest.regionId,
        branches: newRequest.branches,
        status: newRequest.status
      }]);
      
      if (error) throw error;
      addToast('Запрос успешно отправлен', 'success');
    } catch (e) {
      setRequests(oldRequests);
      addToast('Ошибка отправки в базу данных', 'error');
    }
  };

  const updateRequestStatus = async (requestId: string, status: RequestStatus, additionalData?: Partial<MarketingRequest>) => {
    const now = new Date().toISOString();
    const oldRequests = [...requests];
    
    setRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status, ...additionalData, updatedAt: now } : req
    ));

    try {
      const updatePayload: any = { 
        status, 
        updated_at: now,
        ...additionalData 
      };
      
      // Переименовываем поля для Supabase (snake_case)
      if (additionalData?.approvedAmount !== undefined) {
        updatePayload.approved_amount = additionalData.approvedAmount;
        delete updatePayload.approvedAmount;
      }
      if (additionalData?.tmComment !== undefined) {
        updatePayload.tm_comment = additionalData.tmComment;
        delete updatePayload.tmComment;
      }

      const { error } = await supabase
        .from('requests')
        .update(updatePayload)
        .eq('id', requestId);
        
      if (error) throw error;
      addToast('Статус обновлен', 'success');
    } catch (e) {
      setRequests(oldRequests);
      addToast('Ошибка обновления статуса', 'error');
    }
  };

  if (!isLoggedIn || !currentUser) {
    return <Login users={users} onLogin={handleLogin} />;
  }

  return (
    <div className="antialiased">
      <Layout 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onNavigate={setView}
        currentView={view}
      >
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
        )}
      </Layout>
      
      <Toaster messages={toasts} onRemove={removeToast} />
    </div>
  );
};

export default App;
