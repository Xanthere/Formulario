"use client";

import { useState, useEffect } from 'react';

export default function Home() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUsername, setAdminUsername] = useState(null);
  
  // Modals Visibility
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Toast Notification
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Form Fields for New Request
  const [requesterName, setRequesterName] = useState('');
  const [companyArea, setCompanyArea] = useState('');
  const [need, setNeed] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  
  // Login Form Fields
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Helper to format date in YYYY-MM-DD (Local Time)
  const getLocalDateString = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Date picker limit variables
  const minDate = isLoggedIn ? getLocalDateString(0) : getLocalDateString(2);
  const maxDate = isLoggedIn ? getLocalDateString(1) : '';

  // Trigger Toast Notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      } else {
        showToast('Error al cargar las solicitudes', 'error');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showToast('Error al conectar con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Check auth session
  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.loggedIn) {
          setIsLoggedIn(true);
          setAdminUsername(data.user);
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  useEffect(() => {
    checkSession();
    fetchTasks();
  }, []);

  // Handle Login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLoggedIn(true);
        setAdminUsername(data.user);
        setShowLoginModal(false);
        setUsernameInput('');
        setPasswordInput('');
        showToast('Sesión iniciada correctamente', 'success');
        // Reset deadline value since constraints changed
        setDeadline('');
      } else {
        setLoginError(data.error || 'Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Error de conexión');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
      if (res.ok) {
        setIsLoggedIn(false);
        setAdminUsername(null);
        showToast('Sesión cerrada', 'info');
        // Reset deadline value since constraints changed
        setDeadline('');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle new request submission
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!requesterName || !companyArea || !need || !deadline || !description) {
      showToast('Por favor, rellene todos los campos', 'error');
      return;
    }

    // Verify date constraints again in JS to prevent invalid submits
    const selectedDate = new Date(deadline + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayPlus2 = new Date(today);
    todayPlus2.setDate(todayPlus2.getDate() + 2);

    if (isLoggedIn) {
      // Must be today or tomorrow
      if (selectedDate < today || selectedDate > tomorrow) {
        showToast('Como administrador, la fecha debe ser hoy o mañana.', 'error');
        return;
      }
    } else {
      // Must be today + 2 or later
      if (selectedDate < todayPlus2) {
        showToast('La fecha límite debe ser al menos dos días después de hoy.', 'error');
        return;
      }
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          solicitante: requesterName,
          area: companyArea,
          necesidad: need,
          fechaLimite: deadline,
          descripcion: description
        })
      });
      
      if (res.ok) {
        const newTask = await res.json();
        setTasks(prev => [newTask, ...prev]);
        setShowRequestModal(false);
        // Clear fields
        setRequesterName('');
        setCompanyArea('');
        setNeed('');
        setDeadline('');
        setDescription('');
        showToast('Solicitud creada exitosamente', 'success');
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Error al crear la solicitud', 'error');
      }
    } catch (error) {
      console.error('Error creating request:', error);
      showToast('Error de red al crear solicitud', 'error');
    }
  };

  // Handle priority or status updates (Admin only)
  const handleUpdateTask = async (id, field, value) => {
    if (!isLoggedIn) {
      showToast('No autorizado. Por favor inicie sesión.', 'error');
      return;
    }

    // Prepare update object
    const updateBody = { id };
    if (field === 'prioridad') updateBody.prioridad = value;
    if (field === 'estado') updateBody.estado = value;

    try {
      const res = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody)
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(task => task.id === id ? updated : task));
        showToast(`Tarea actualizada correctamente`, 'success');
      } else {
        const errorData = await res.json();
        showToast(errorData.error || 'Error al actualizar', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      showToast('Error al actualizar la tarea', 'error');
    }
  };

  // Beautiful format for date display
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Displays as DD/MM/YYYY
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  };

  return (
    <div className="app-container">
      {/* Background Ambience elements */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {/* Header Area */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color: 'white'}}>
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
              </svg>
            </div>
            <span className="logo-text">SolicitudesFlow</span>
          </div>
          
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowRequestModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5v14"/>
              </svg>
              Hacer Solicitud
            </button>
            
            {isLoggedIn ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="user-badge">
                  <div className="user-badge-dot"></div>
                  <span>Admin: {adminUsername}</span>
                </div>
                <button className="btn btn-secondary" onClick={handleLogout}>
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary" onClick={() => setShowLoginModal(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                </svg>
                Acceso Admin
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="dashboard-top-section">
          <div className="dashboard-title-area">
            <h1>Tablero de Tareas</h1>
            <p>Monitoreo y administración de requerimientos corporativos</p>
          </div>
          
          {isLoggedIn && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.05)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(99, 102, 241, 0.2)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: 'var(--accent-primary)'}}>
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
              <span>Tienes permisos de Administrador para editar Prioridad y Estado directamente en la tabla.</span>
            </div>
          )}
        </div>

        {/* Board Card */}
        <div className="board-container">
          {loading ? (
            <div className="loading-dots">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📂</div>
              <h3 className="empty-state-title">No hay solicitudes</h3>
              <p className="empty-state-desc">Haz clic en el botón superior "Hacer Solicitud" para enviar la primera tarea del tablero.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Nombre Solicitante</th>
                    <th>Área de la Empresa</th>
                    <th>Necesidad</th>
                    <th>Fecha Límite de Entrega</th>
                    <th>Descripción de la Tarea</th>
                    <th>Prioridad</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <span className="requester-name">{task.solicitante}</span>
                      </td>
                      <td>
                        <span className="area-badge">{task.area}</span>
                      </td>
                      <td>
                        <span className="need-text">{task.necesidad}</span>
                      </td>
                      <td>
                        {isLoggedIn ? (
                          <input
                            type="date"
                            className="admin-select"
                            style={{ minWidth: '130px', paddingRight: '0.5rem', backgroundImage: 'none' }}
                            value={task.fechaLimite}
                            min={getLocalDateString(0)}
                            onClick={(e) => e.target.showPicker?.()}
                            onChange={(e) => handleUpdateTask(task.id, 'fechaLimite', e.target.value)}
                          />
                        ) : (
                          <span className="date-text">{formatDateDisplay(task.fechaLimite)}</span>
                        )}
                      </td>
                      <td>
                        <div className="desc-text" title={task.descripcion}>
                          {task.descripcion}
                        </div>
                      </td>
                      <td>
                        {isLoggedIn ? (
                          <select
                            className="admin-select"
                            value={task.prioridad}
                            onChange={(e) => handleUpdateTask(task.id, 'prioridad', e.target.value)}
                          >
                            <option value="baja">Baja</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                          </select>
                        ) : (
                          <span className={`badge priority-${task.prioridad}`}>
                            {task.prioridad}
                          </span>
                        )}
                      </td>
                      <td>
                        {isLoggedIn ? (
                          <select
                            className="admin-select"
                            value={task.estado}
                            onChange={(e) => handleUpdateTask(task.id, 'estado', e.target.value)}
                          >
                            <option value="en proceso">En proceso</option>
                            <option value="finalizado">Finalizado</option>
                            <option value="pausado">Pausado</option>
                          </select>
                        ) : (
                          <span className={`badge status-${task.estado.replace(' ', '-')}`}>
                            {task.estado}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal - Hacer Solicitud */}
      <div className={`modal-overlay ${showRequestModal ? 'active' : ''}`} onClick={() => setShowRequestModal(false)}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Hacer Solicitud</h2>
            <button className="modal-close-btn" onClick={() => setShowRequestModal(false)}>×</button>
          </div>
          <form onSubmit={handleCreateRequest}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre quien manda la solicitud</label>
                <input
                  type="text"
                  required
                  placeholder="Tu nombre y apellido"
                  className="form-input"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Área de la Empresa</label>
                <select
                  required
                  className="form-select"
                  value={companyArea}
                  onChange={(e) => setCompanyArea(e.target.value)}
                >
                  <option value="">Seleccione un área...</option>
                  <option value="Tecnología">Tecnología / IT</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Ventas">Ventas</option>
                  <option value="Finanzas">Finanzas</option>
                  <option value="Operaciones">Operaciones</option>
                  <option value="Administración">Administración</option>
                  <option value="Otro">Otro / Soporte</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Necesidad</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Acceso a servidor, Compra de licencias..."
                  className="form-input"
                  value={need}
                  onChange={(e) => setNeed(e.target.value)}
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Fecha Límite de Entrega</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {isLoggedIn ? 'Solo hoy o mañana' : 'Mínimo 2 días después de hoy'}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  className="form-input"
                  min={minDate}
                  max={maxDate || undefined}
                  value={deadline}
                  onClick={(e) => e.target.showPicker?.()}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción de la Tarea</label>
                <textarea
                  required
                  placeholder="Detalla lo que necesitas y los requisitos específicos..."
                  className="form-textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Enviar Solicitud
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Modal - Login */}
      <div className={`modal-overlay ${showLoginModal ? 'active' : ''}`} onClick={() => setShowLoginModal(false)}>
        <div className="modal-box" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Acceso Administrativo</h2>
            <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>×</button>
          </div>
          <form onSubmit={handleLogin}>
            <div className="modal-body">
              {loginError && (
                <div style={{ background: 'var(--color-danger-bg)', border: '1px solid rgba(239,68,68,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', color: '#fca5a5', fontSize: '0.85rem', fontWeight: 500 }}>
                  ⚠️ {loginError}
                </div>
              )}
              
              <div className="form-group">
                <label className="form-label">Usuario</label>
                <input
                  type="text"
                  required
                  placeholder="admin"
                  className="form-input"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="form-input"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLoginModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Iniciar Sesión
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Toast Notification Container */}
      <div className={`toast toast-${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.type === 'success' && <span>✅</span>}
        {toast.type === 'error' && <span>❌</span>}
        {toast.type === 'info' && <span>ℹ️</span>}
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
