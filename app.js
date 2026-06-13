/**
 * PLÁSTICOS TEMUCO - ERP & Inventory Management Core Logic
 * Author: Antigravity AI
 * Version: 3.0 (OP-Centric Inventory & OT Dispatch)
 */

const app = (() => {
  try {
  // --- STATE DEFINITION ---
  let state = {
    stock: [],            // { id, op, clientName, description, undMts, kilos, warehouse, date, observacion }
    customers: [],        // { id, name, rut, sucursal, vendedor, contacto, phone, email }
    notes: [],            // { id, folio, date, customerId, customerName, customerRut, ..., total, items: [...] }
    transportOrders: [],  // { id, otNumber, clientName, clientRut, clientSucursal, clientVendedor, fechaOcNv, ocFileName, ocFileData, nvFileName, nvFileData, items: [...], carrier, carrierRut, plate, date, status, observacion }
    warehouseLog: [],     // { id, date, type: 'intake'|'ot_dispatch'|'adjustment', op, clientName, warehouse, undMts, kilos, reference }
    usersList: [],        // { id, name, role, password }
    profile: {
      name: "Plásticos Temuco",
      rut: "76.567.711-4",
      phone: "+56 45 221 4455",
      email: "contacto@plasticostemuco.cl",
      address: "Gustavo Verniory Lote 1f",
      city: "Lautaro Region de la Araucanía"
    },
    theme: "light",
    currentUser: null
  };

  // --- CONFIG / CONSTANTS ---
  const STORAGE_KEY = "plasticos_temuco_erp_v3";

  // --- SEED DEMO DATA ---
  const DEMO_CUSTOMERS = [
    { id: "c1", name: "Comercial Araucanía S.A.", rut: "76.120.340-5", sucursal: "Lautaro", vendedor: "Javier Ortiz", contacto: "Rodrigo Vera", phone: "+56 9 7788 9900", email: "adquisiciones@comercialaraucania.cl" },
    { id: "c2", name: "Agrícola Los Pinus Ltda.", rut: "15.890.342-K", sucursal: "Temuco Centro", vendedor: "Manuel Ardura", contacto: "Carlos Pinilla", phone: "+56 9 6655 4433", email: "contacto@agricolalospinus.cl" },
    { id: "c3", name: "Comercial Arauco", rut: "77.901.233-1", sucursal: "Lautaro", vendedor: "Marcos Alcayaga", contacto: "Alejandra Sol", phone: "+56 45 224 8899", email: "facturas@comercialarauco.cl" }
  ];

  const DEMO_STOCK = [
    { id: "s1", op: "OP-80120", clientName: "Comercial Araucanía S.A.", description: "Bolsa de Basura Negra 80x120 cm", undMts: 1500, kilos: 120, warehouse: "Industrial", date: "2026-06-10", observacion: "Lote listo en pallet 1" },
    { id: "s2", op: "OP-PP1000", clientName: "Agrícola Los Pinus Ltda.", description: "Envase Rectangular PP 1000cc", undMts: 800, kilos: 65, warehouse: "Industrial", date: "2026-06-11", observacion: "Guardado en estantería B" },
    { id: "s3", op: "OP-RI12", clientName: "Agrícola Los Pinus Ltda.", description: "Manguera Riego Tecnificada 1/2 pulgada", undMts: 300, kilos: 180, warehouse: "Agricola", date: "2026-06-11", observacion: "Rollos de 50 metros" },
    { id: "s4", op: "OP-CM4050", clientName: "Comercial Arauco", description: "Bolsa Camiseta Biodegradable 40x50 cm", undMts: 2500, kilos: 140, warehouse: "Agricola", date: "2026-06-12", observacion: "En cajas cerradas" },
    { id: "s5", op: "OP-PVC110", clientName: "Comercial Araucanía S.A.", description: "Tubería Sanitaria PVC 110mm x 6m", undMts: 120, kilos: 210, warehouse: "Industrial", date: "2026-06-12", observacion: "Apilado en patio" }
  ];

  const DEMO_LOG = [
    { id: "l1", date: "2026-06-10T09:30:00Z", type: "intake", op: "OP-80120", clientName: "Comercial Araucanía S.A.", warehouse: "Industrial", undMts: 1500, kilos: 120, reference: "Ingreso inicial de producción" },
    { id: "l2", date: "2026-06-11T11:00:00Z", type: "intake", op: "OP-PP1000", clientName: "Agrícola Los Pinus Ltda.", warehouse: "Industrial", undMts: 800, kilos: 65, reference: "Ingreso inicial de producción" },
    { id: "l3", date: "2026-06-11T14:15:00Z", type: "intake", op: "OP-RI12", clientName: "Agrícola Los Pinus Ltda.", warehouse: "Agricola", undMts: 300, kilos: 180, reference: "Ingreso inicial de producción" }
  ];

  // Helper variables for file attachments in form
  let tempUploadedFiles = {
    oc: { name: "", data: "" },
    nv: { name: "", data: "" }
  };
  let tempNoteUploadedFile = { name: "", data: "" };

  // --- MATH & CURRENCY HELPERS ---
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      minimumFractionDigits: 0
    }).format(val);
  };

  const formatDateString = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr + "T00:00:00");
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return "N/A";
    const date = new Date(isoStr);
    return new Intl.DateTimeFormat("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const generateUUID = () => {
    return 'u_' + Math.random().toString(36).substr(2, 9);
  };

  const isAdmin = () => {
    return state.currentUser && state.currentUser.role === 'Administrador';
  };

  // --- DATABASE LOCAL & REMOTE SYNC ---
  const saveToLocalStorage = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveToServer();
  };

  const saveToServer = async () => {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(state)
      });
      if (!res.ok) {
        console.error("Error sincronizando estado al servidor.");
      }
    } catch (e) {
      console.warn("Servidor no disponible para sincronización. Usando almacenamiento local localstorage.", e);
    }
  };

  const loadFromServer = async (isInitial = false) => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const parsed = await res.json();
        if (parsed && typeof parsed === 'object') {
          // Preservar la sesión local de inicio y tema
          const currentUser = state.currentUser;
          const currentTheme = state.theme;

          state = parsed;
          state.currentUser = currentUser;
          state.theme = currentTheme;

          if (!state.stock) state.stock = [];
          if (!state.customers) state.customers = [];
          if (!state.transportOrders) state.transportOrders = [];
          if (!state.warehouseLog) state.warehouseLog = [];
          if (!state.notes) state.notes = [];
          if (!state.usersList) state.usersList = [];

          // Actualizar caché de localstorage
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

          if (!isInitial) {
            refreshCurrentView();
          }
        }
      }
    } catch (e) {
      console.warn("Servidor no disponible. Cargando copia local...", e);
      if (isInitial) {
        loadFromLocalStorageOnly();
      }
    }
  };

  const loadFromLocalStorageOnly = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          const currentUser = state.currentUser;
          const currentTheme = state.theme;

          state = parsed;
          state.currentUser = currentUser;
          state.theme = currentTheme;

          if (!state.stock) state.stock = [];
          if (!state.customers) state.customers = [];
          if (!state.transportOrders) state.transportOrders = [];
          if (!state.warehouseLog) state.warehouseLog = [];
          if (!state.notes) state.notes = [];
          if (!state.usersList) state.usersList = [];
        } else {
          loadSeeds();
        }
      } catch (e) {
        console.error("Error al cargar base de datos local:", e);
        loadSeeds();
      }
    } else {
      loadSeeds();
    }
  };

  const loadFromLocalStorage = () => {
    loadFromServer(true);
  };

  const refreshCurrentView = () => {
    const activePanel = document.querySelector(".panel-section.active");
    if (activePanel) {
      navigateTo(activePanel.id);
    }
  };

  const loadSeeds = () => {
    state = {
      stock: [...DEMO_STOCK],
      customers: [...DEMO_CUSTOMERS],
      transportOrders: [],
      warehouseLog: [...DEMO_LOG],
      notes: [],
      usersList: [],
      profile: {
        name: "Plásticos Temuco",
        rut: "76.567.711-4",
        phone: "+56 45 221 4455",
        email: "contacto@plasticostemuco.cl",
        address: "Gustavo Verniory Lote 1f",
        city: "Lautaro Region de la Araucanía"
      },
      theme: "light"
    };
    saveToLocalStorage();
  };

  // Helper to load SheetJS dynamically when needed
  const loadSheetJS = (callback) => {
    if (window.XLSX) {
      callback();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.onload = () => {
      if (window.XLSX) {
        callback();
      } else {
        alert("No se pudo cargar la librería Excel.");
      }
    };
    script.onerror = () => {
      alert("Error al cargar la librería de Excel. Por favor verifique su conexión a internet.");
    };
    document.head.appendChild(script);
  };

  const downloadCustomersTemplate = () => {
    loadSheetJS(() => {
      try {
        const sampleData = [
          {
            "RUT": "76.120.340-5",
            "Nombre del Cliente": "Comercial Ejemplo SpA",
            "Sucursal": "Lautaro",
            "Vendedor": "Javier Ortiz",
            "Contacto": "Carlos Pérez",
            "Teléfono": "+56 9 9876 5432",
            "Email": "carlos@comercialejemplo.cl"
          }
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, "Clientes");
        XLSX.writeFile(wb, "Formato_Importacion_Clientes.xlsx");
      } catch (err) {
        alert("Error al generar formato de clientes.");
        console.error(err);
      }
    });
  };

  const downloadStockTemplate = () => {
    loadSheetJS(() => {
      try {
        const sampleData = [
          {
            "OP (SKU)": "OP-80120",
            "Cliente": "Comercial Araucanía S.A.",
            "Descripción": "Bolsa de Basura Negra 80x120 cm",
            "Unidades/Metros": 1500,
            "Kilos": 120.5,
            "Bodega (Industrial/Agricola)": "Industrial",
            "Fecha Ingreso": "2026-06-12",
            "Observación": "Lote listo en pallet 1"
          }
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, "Stock");
        XLSX.writeFile(wb, "Formato_Importacion_Stock.xlsx");
      } catch (err) {
        alert("Error al generar formato de stock.");
        console.error(err);
      }
    });
  };


  // --- INITIALIZE & ROUTING ---
  // --- INITIALIZE & ROUTING ---
  const init = () => {
    loadFromLocalStorage();
    
    // Reset all existing folios to start from 0 if there are any
    if (state.notes && state.notes.length > 0) {
      state.notes.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((note, index) => {
        note.folio = String(index).padStart(6, '0');
      });
    }
    if (state.transportOrders && state.transportOrders.length > 0) {
      state.transportOrders.sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach((ot, index) => {
        ot.otNumber = "OT-" + String(index).padStart(6, '0');
      });
    }
    saveToLocalStorage();
    
    // Check user registration
    const storedUser = localStorage.getItem("plasticos_temuco_user");
    if (storedUser) {
      try {
        state.currentUser = JSON.parse(storedUser);
      } catch (e) {
        state.currentUser = null;
      }
    }
    
    if (!state.currentUser) {
      document.getElementById("login-overlay").classList.add("active");
      if (state.usersList.length === 0) {
        setLoginMode('register');
      } else {
        setLoginMode('login');
      }
    } else {
      document.getElementById("login-overlay").classList.remove("active");
      updateSidebarUserProfile();
    }
    
    setupTheme();
    setupSidebarNavigation();
    setupDates();
    renderAllViews();
    setupCompanyProfileForm();

    // Inicializar conexión de WebSockets para sincronización en tiempo real
    if (typeof io !== 'undefined') {
      try {
        window.socket = io();
        window.socket.on("state-updated", () => {
          console.log("Actualización recibida del servidor. Sincronizando ERP...");
          loadFromServer(false);
        });
        console.log("WebSocket: Conectado al servidor de actualizaciones en vivo.");
      } catch (e) {
        console.warn("WebSocket: No se pudo conectar. Iniciando polling de respaldo...", e);
        startPollingFallback();
      }
    } else {
      console.log("WebSocket: io no está definido. Iniciando polling de respaldo (15s)...");
      startPollingFallback();
    }
  };

  const startPollingFallback = () => {
    setInterval(() => {
      console.log("Polling: Sincronizando estado en segundo plano...");
      loadFromServer(false);
    }, 15000);
  };

  const setLoginMode = (mode) => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const tabBtnLogin = document.getElementById("tab-btn-login");
    const tabBtnRegister = document.getElementById("tab-btn-register");
    const titleEl = document.getElementById("login-overlay-title");
    const subtitleEl = document.getElementById("login-overlay-subtitle");

    if (mode === "register") {
      loginForm.style.display = "none";
      registerForm.style.display = "block";
      tabBtnLogin.classList.remove("active");
      tabBtnRegister.classList.add("active");
      titleEl.innerText = "Registro de Usuario";
      subtitleEl.innerText = "Cree una cuenta para comenzar a operar el ERP.";
    } else {
      if (state.usersList.length === 0) {
        alert("No hay usuarios registrados. Por favor regístrese primero.");
        setLoginMode('register');
        return;
      }
      loginForm.style.display = "block";
      registerForm.style.display = "none";
      tabBtnLogin.classList.add("active");
      tabBtnRegister.classList.remove("active");
      titleEl.innerText = "Acceso al Sistema ERP";
      subtitleEl.innerText = "Por favor, ingrese sus credenciales para operar.";
    }
  };

  const registerUser = (event) => {
    event.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const role = document.getElementById("register-role").value;
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm-password").value;

    if (!name || !role || !password || !confirmPassword) {
      alert("Por favor rellene todos los campos.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    const exists = state.usersList.find(u => u.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert(`El usuario "${name}" ya está registrado.`);
      return;
    }

    const newUser = {
      id: generateUUID(),
      name,
      role,
      password
    };

    state.usersList.push(newUser);
    saveToLocalStorage();

    alert("Usuario registrado con éxito! Ahora puede ingresar.");
    
    document.getElementById("register-name").value = "";
    document.getElementById("register-role").value = "";
    document.getElementById("register-password").value = "";
    document.getElementById("register-confirm-password").value = "";

    setLoginMode("login");
    document.getElementById("login-name").value = name;
  };

  const updateSidebarUserProfile = () => {
    const nameEl = document.getElementById("sidebar-user-name");
    const roleEl = document.getElementById("sidebar-user-role");
    if (state.currentUser) {
      if (nameEl) nameEl.innerText = state.currentUser.name;
      if (roleEl) roleEl.innerText = state.currentUser.role;
      
      const adjustNav = document.querySelector('.sidebar-nav [data-target="panel-adjust"]');
      const settingsNav = document.querySelector('.sidebar-nav [data-target="panel-settings"]');
      if (isAdmin()) {
        if (adjustNav) adjustNav.style.display = "block";
        if (settingsNav) settingsNav.style.display = "block";
      } else {
        if (adjustNav) adjustNav.style.display = "none";
        if (settingsNav) settingsNav.style.display = "none";
      }
    } else {
      if (nameEl) nameEl.innerText = "No Registrado";
      if (roleEl) roleEl.innerText = "Sin Sesión";
    }
  };

  const loginUser = (event) => {
    event.preventDefault();
    const name = document.getElementById("login-name").value.trim();
    const password = document.getElementById("login-password").value;

    if (!name || !password) {
      alert("Por favor ingrese su nombre de usuario y contraseña.");
      return;
    }

    const user = state.usersList.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    if (!user) {
      alert("Nombre de usuario o contraseña incorrectos.");
      return;
    }

    state.currentUser = { name: user.name, role: user.role };
    localStorage.setItem("plasticos_temuco_user", JSON.stringify(state.currentUser));

    document.getElementById("login-overlay").classList.remove("active");
    updateSidebarUserProfile();

    state.warehouseLog.push({
      id: generateUUID(),
      date: new Date().toISOString(),
      type: "adjustment",
      op: "SISTEMA",
      clientName: "N/A",
      warehouse: "Industrial",
      undMts: 0,
      kilos: 0,
      reference: "Inicio de Sesión",
      user: state.currentUser.name
    });
    saveToLocalStorage();

    alert(`Acceso registrado: ${user.name} (${user.role})`);
    
    document.getElementById("login-name").value = "";
    document.getElementById("login-password").value = "";
  };

  const logoutUser = () => {
    const confirmLogout = confirm("¿Desea cerrar la sesión del ERP?");
    if (!confirmLogout) return;
    
    if (state.currentUser) {
      state.warehouseLog.push({
        id: generateUUID(),
        date: new Date().toISOString(),
        type: "adjustment",
        op: "SISTEMA",
        clientName: "N/A",
        warehouse: "Industrial",
        undMts: 0,
        kilos: 0,
        reference: "Cierre de Sesión",
        user: state.currentUser.name
      });
    }
    
    state.currentUser = null;
    localStorage.removeItem("plasticos_temuco_user");
    saveToLocalStorage();
    
    document.getElementById("login-name").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("login-overlay").classList.add("active");
    
    if (state.usersList.length === 0) {
      setLoginMode('register');
    } else {
      setLoginMode('login');
    }
    
    updateSidebarUserProfile();
  };

  const setupTheme = () => {
    const body = document.body;
    const themeToggle = document.getElementById("theme-toggle");
    
    if (state.theme === "dark") {
      body.classList.add("dark-mode");
      body.classList.remove("light-mode");
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Modo Claro</span>';
    } else {
      body.classList.add("light-mode");
      body.classList.remove("dark-mode");
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> <span>Modo Oscuro</span>';
    }

    themeToggle.onclick = () => {
      if (body.classList.contains("dark-mode")) {
        body.classList.replace("dark-mode", "light-mode");
        state.theme = "light";
        themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i> <span>Modo Oscuro</span>';
      } else {
        body.classList.replace("light-mode", "dark-mode");
        state.theme = "dark";
        themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Modo Claro</span>';
      }
      saveToLocalStorage();
    };
  };

  const setupSidebarNavigation = () => {
    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");
    navItems.forEach(item => {
      item.onclick = (e) => {
        e.preventDefault();
        const targetPanel = item.getAttribute("data-target");
        navigateTo(targetPanel);
      };
    });
  };

  const toggleSidebar = () => {
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("active");
    if (overlay) overlay.classList.toggle("active");
  };

  const navigateTo = (panelId, startNewNote = false) => {
    // Close sidebar on mobile
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebar-overlay");
    if (sidebar && sidebar.classList.contains("active")) {
      sidebar.classList.remove("active");
    }
    if (overlay && overlay.classList.contains("active")) {
      overlay.classList.remove("active");
    }

    if (panelId === 'panel-settings' || panelId === 'panel-adjust') {
      if (!isAdmin()) {
        alert("Acceso denegado: Solo administradores pueden acceder a este módulo.");
        navigateTo('panel-dashboard');
        return;
      }
    }

    // Reset Navigation Styles
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(el => el.classList.remove("active"));
    const activeNav = document.querySelector(`.sidebar-nav .nav-item[data-target="${panelId}"]`);
    if (activeNav) activeNav.classList.add("active");

    // Hide all panels
    document.querySelectorAll(".panel-section").forEach(el => el.classList.remove("active"));
    // Show active panel
    const targetPanelEl = document.getElementById(panelId);
    if (targetPanelEl) targetPanelEl.classList.add("active");

    // Header updates
    const headerTitle = document.getElementById("current-panel-title");
    const headerSubtitle = document.getElementById("current-panel-subtitle");
    
    switch (panelId) {
      case "panel-dashboard":
        headerTitle.innerText = "Dashboard";
        headerSubtitle.innerText = "Resumen general y estadísticas rápidas";
        renderDashboard();
        break;
      case "panel-customers":
        headerTitle.innerText = "Clientes";
        headerSubtitle.innerText = "Gestión de cartera de clientes corporativos";
        renderCustomersList();
        break;
      case "panel-notes":
        headerTitle.innerText = "Notas de Venta";
        headerSubtitle.innerText = "Gestiona, emite e imprime notas de venta";
        if (startNewNote) {
          showNewNoteForm();
        } else {
          hideNewNoteForm();
        }
        break;
      case "panel-intake":
        headerTitle.innerText = "Ingreso a Bodega";
        headerSubtitle.innerText = "Registra ingresos de mercadería por Orden de Producción (OP)";
        setupIntakeForm();
        break;
      case "panel-stock":
        headerTitle.innerText = "Stock de Inventario";
        headerSubtitle.innerText = "Consulta y exporta el stock real en bodegas";
        renderStockList();
        break;
      case "panel-adjust":
        headerTitle.innerText = "Ajuste de Inventario";
        headerSubtitle.innerText = "Ajustes físicos manuales a lotes en bodega";
        setupAdjustForm();
        break;
      case "panel-ot":
        headerTitle.innerText = "Órdenes de Transporte (OT)";
        headerSubtitle.innerText = "Generación de OTs y logística de despachos";
        setupOTView();
        break;
      case "panel-reports":
        headerTitle.innerText = "Informes ERP";
        headerSubtitle.innerText = "Valorización e historial de movimientos de inventario";
        renderReports();
        break;
      case "panel-settings":
        headerTitle.innerText = "Configuración";
        headerSubtitle.innerText = "Ajustes de membrete corporativo y respaldos";
        break;
      case "panel-user-profile":
        headerTitle.innerText = "Mi Perfil";
        headerSubtitle.innerText = "Datos personales y cambio de contraseña";
        renderUserProfile();
        break;
    }
  };

  const setupDates = () => {
    const dateText = new Intl.DateTimeFormat("es-CL", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(new Date());
    document.getElementById("header-date").innerText = dateText.charAt(0).toUpperCase() + dateText.slice(1);
    document.getElementById("note-date").value = new Date().toISOString().split('T')[0];
  };

  const renderAllViews = () => {
    renderDashboard();
    renderCustomersList();
    renderNotesList();
    populateClientDropdowns();
  };

  // --- 1. DASHBOARD CONTROLLER ---
  const renderDashboard = () => {
    // Total notes sum
    const totalSalesSum = state.notes.reduce((acc, note) => acc + note.total, 0);
    const totalNotesCount = state.notes.length;
    
    // Physical inventory totals
    let stockIndustrialUnd = 0;
    let stockAgricolaUnd = 0;
    state.stock.forEach(item => {
      if (item.warehouse === "Industrial") {
        stockIndustrialUnd += item.undMts || 0;
      } else {
        stockAgricolaUnd += item.undMts || 0;
      }
    });
    
    const totalOTCount = state.transportOrders.length;
    const pendingOTCount = state.transportOrders.filter(ot => ot.status !== "Entregado").length;

    // Set DOM text
    document.getElementById("stat-total-sales").innerText = formatCurrency(totalSalesSum);
    document.getElementById("stat-total-notes").innerText = totalNotesCount;
    document.getElementById("stat-total-stock").innerText = (stockIndustrialUnd + stockAgricolaUnd) + " Und/Mts";
    document.getElementById("stat-stock-split-sub").innerHTML = `<span>Ind: <b>${stockIndustrialUnd}</b> | Agr: <b>${stockAgricolaUnd}</b></span>`;
    document.getElementById("stat-total-ot").innerText = totalOTCount;
    document.getElementById("stat-pending-ot").innerText = `${pendingOTCount} Pendientes`;

    // Last 5 notes
    const recentNotes = [...state.notes].sort((a, b) => (b.folio || '').localeCompare(a.folio || '')).slice(0, 5);
    const tbody = document.getElementById("dashboard-recent-notes-tbody");
    tbody.innerHTML = "";

    if (recentNotes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay notas de venta registradas.</td></tr>';
      return;
    }

    recentNotes.forEach(note => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>N° ${note.folio}</strong></td>
        <td>${formatDateString(note.date)}</td>
        <td>${note.customerName}</td>
        <td><span class="badge ${note.warehouse === 'Industrial' ? 'badge-info' : 'badge-success'}">${note.warehouse === 'Industrial' ? 'Ind. Industrial' : 'Agr. Agrícola'}</span></td>
        <td>${formatCurrency(note.total)}</td>
        <td>
          <div class="table-btn-group">
            <button class="btn-table-action view-btn" onclick="app.openInvoiceModal('${note.id}')" title="Ver Nota"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-table-action" onclick="app.printInvoiceDirectly('${note.id}')" title="Imprimir"><i class="fa-solid fa-print"></i></button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  // --- 2. CLIENTES CONTROLLER ---
  const renderCustomersList = () => {
    const tbody = document.getElementById("customers-list-tbody");
    const searchVal = document.getElementById("search-customers").value.toLowerCase().trim();
    tbody.innerHTML = "";
    
    const filtered = state.customers.filter(c => {
      const nameMatch = c.name ? c.name.toLowerCase().includes(searchVal) : false;
      const rutMatch = c.rut ? c.rut.toLowerCase().includes(searchVal) : false;
      const sucursalMatch = c.sucursal ? c.sucursal.toLowerCase().includes(searchVal) : false;
      const vendedorMatch = c.vendedor ? c.vendedor.toLowerCase().includes(searchVal) : false;
      return nameMatch || rutMatch || sucursalMatch || vendedorMatch;
    }).sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No se encontraron clientes.</td></tr>';
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.name}</strong></td>
        <td><code>${c.rut}</code></td>
        <td>${c.sucursal || "N/A"}</td>
        <td><span class="badge badge-info">${c.vendedor || "N/A"}</span></td>
        <td>${c.contacto || "N/A"}</td>
        <td>${c.phone}</td>
        <td>${c.email}</td>
        <td>
          <div class="table-btn-group">
            ${isAdmin() ? `
              <button class="btn-table-action edit-btn" onclick="app.openEditCustomerModal('${c.id}')" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-table-action delete-btn" onclick="app.deleteCustomer('${c.id}')" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const openAddCustomerModal = () => {
    document.getElementById("customer-modal-title").innerText = "Agregar Cliente";
    document.getElementById("customer-form").reset();
    document.getElementById("customer-id").value = "";
    document.getElementById("modal-customer").classList.add("active");
  };

  const openEditCustomerModal = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar clientes.");
      return;
    }
    const c = state.customers.find(client => client.id === id);
    if (!c) return;
    
    document.getElementById("customer-modal-title").innerText = "Editar Cliente";
    document.getElementById("customer-id").value = c.id;
    document.getElementById("customer-name").value = c.name;
    document.getElementById("customer-rut").value = c.rut;
    document.getElementById("customer-sucursal").value = c.sucursal || "";
    document.getElementById("customer-vendedor").value = c.vendedor || "";
    document.getElementById("customer-contacto").value = c.contacto || "";
    document.getElementById("customer-phone").value = c.phone;
    document.getElementById("customer-email").value = c.email;
    
    document.getElementById("modal-customer").classList.add("active");
  };

  const closeCustomerModal = () => {
    document.getElementById("modal-customer").classList.remove("active");
  };

  const saveCustomer = (event) => {
    event.preventDefault();
    const id = document.getElementById("customer-id").value;
    const name = document.getElementById("customer-name").value.trim();
    const rut = document.getElementById("customer-rut").value.trim();
    const sucursal = document.getElementById("customer-sucursal").value.trim();
    const vendedor = document.getElementById("customer-vendedor").value;
    const contacto = document.getElementById("customer-contacto").value.trim();
    const phone = document.getElementById("customer-phone").value.trim();
    const email = document.getElementById("customer-email").value.trim();

    if (id && !isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar clientes.");
      return;
    }

    if (rut) {
      const duplicate = state.customers.find(c => c.rut === rut && c.id !== id);
      if (duplicate) {
        alert(`El RUT "${rut}" ya pertenece al cliente: ${duplicate.name}`);
        return;
      }
    }

    if (id) {
      const c = state.customers.find(client => client.id === id);
      if (c) {
        c.name = name;
        c.rut = rut;
        c.sucursal = sucursal;
        c.vendedor = vendedor;
        c.contacto = contacto;
        c.phone = phone;
        c.email = email;
      }
    } else {
      state.customers.push({
        id: generateUUID(), name, rut, sucursal, vendedor, contacto, phone, email
      });
    }

    saveToLocalStorage();
    closeCustomerModal();
    renderCustomersList();
    renderDashboard();
    populateClientDropdowns();
  };

  const deleteCustomer = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden eliminar clientes.");
      return;
    }
    const c = state.customers.find(client => client.id === id);
    if (!c) return;
    
    const confirmDelete = confirm(`¿Desea eliminar permanentemente a: ${c.name}?`);
    if (!confirmDelete) return;
    
    state.customers = state.customers.filter(client => client.id !== id);
    saveToLocalStorage();
    renderCustomersList();
    renderDashboard();
    populateClientDropdowns();
  };

  const importCustomersExcel = (event) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden importar clientes.");
      event.target.value = "";
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    loadSheetJS(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          if (rows.length === 0) {
            alert("El archivo Excel está vacío.");
            return;
          }

          let importCount = 0;
          let updateCount = 0;
          let skipCount = 0;

          rows.forEach(row => {
            const keys = Object.keys(row);
            
            const rutKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('rut') || k.toLowerCase() === 'id');
            const nameKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('nombre') || k.toLowerCase().replace(/\s/g, '').includes('razon') || k.toLowerCase() === 'cliente');
            const sucursalKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('sucursal') || k.toLowerCase() === 'direccion' || k.toLowerCase() === 'ciudad');
            const vendedorKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('vendedor') || k.toLowerCase() === 'ejecutivo');
            const contactoKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('contacto') || k.toLowerCase() === 'persona');
            const phoneKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('telefono') || k.toLowerCase() === 'fono');
            const emailKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('email') || k.toLowerCase() === 'correo');

            const rut = rutKey ? String(row[rutKey]).trim() : '';
            const name = nameKey ? String(row[nameKey]).trim() : '';
            const sucursal = sucursalKey ? String(row[sucursalKey]).trim() : 'Casa Matriz';
            const vendedor = vendedorKey ? String(row[vendedorKey]).trim() : 'Javier Ortiz';
            const contacto = contactoKey ? String(row[contactoKey]).trim() : 'Sin Contacto';
            const phone = phoneKey ? String(row[phoneKey]).trim() : 'Sin Fono';
            const email = emailKey ? String(row[emailKey]).trim() : 'contacto@plasticostemuco.cl';

            if (!name) {
              skipCount++;
              return;
            }

            let existing = null;
            if (rut) {
              existing = state.customers.find(c => c.rut && c.rut.replace(/\./g,'').replace(/-/g,'').toLowerCase() === rut.replace(/\./g,'').replace(/-/g,'').toLowerCase());
            }

            if (existing) {
              existing.name = name;
              existing.sucursal = sucursal;
              existing.vendedor = vendedor;
              existing.contacto = contacto;
              existing.phone = phone;
              existing.email = email;
              updateCount++;
            } else {
              state.customers.push({
                id: generateUUID(), rut, name, sucursal, vendedor, contacto, phone, email
              });
              importCount++;
            }
          });

          saveToLocalStorage();
          alert(`Importación:\n\n* ${importCount} clientes nuevos.\n* ${updateCount} actualizados.\n* ${skipCount} omitidos.`);
          renderCustomersList();
          renderDashboard();
          populateClientDropdowns();
        } catch (err) {
          alert("Error al procesar planilla Excel.");
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
    event.target.value = "";
  };

  const populateClientDropdowns = () => {
    // Populate Client in Intake
    const intakeSelect = document.getElementById("intake-client-select");
    if (intakeSelect) {
      intakeSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
      const sortedCustomers = [...state.customers].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
      sortedCustomers.forEach(c => {
        intakeSelect.innerHTML += `<option value="${c.name}">${c.name} (${c.rut})</option>`;
      });
    }

    // Populate Client in OT
    const otSelect = document.getElementById("ot-client-select");
    if (otSelect) {
      otSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
      const sortedCustomers = [...state.customers].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
      sortedCustomers.forEach(c => {
        otSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.rut})</option>`;
      });
    }

    // Populate Client in Sales Notes
    const noteSelect = document.getElementById("note-client-select");
    if (noteSelect) {
      noteSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
      const sortedCustomers = [...state.customers].sort((a,b) => (a.name || '').localeCompare(b.name || ''));
      sortedCustomers.forEach(c => {
        noteSelect.innerHTML += `<option value="${c.id}">${c.name} (${c.rut})</option>`;
      });
    }
  };

  // --- 3. NOTAS DE VENTA CONTROLLER ---
  const renderNotesList = () => {
    const tbody = document.getElementById("notes-list-tbody");
    if (!tbody) return;
    const searchVal = document.getElementById("search-notes").value.toLowerCase().trim();
    tbody.innerHTML = "";
    
    const filtered = state.notes.filter(note => {
      const folioMatch = note.folio ? note.folio.toLowerCase().includes(searchVal) : false;
      const nameMatch = note.customerName ? note.customerName.toLowerCase().includes(searchVal) : false;
      const rutMatch = note.customerRut ? note.customerRut.toLowerCase().includes(searchVal) : false;
      return folioMatch || nameMatch || rutMatch;
    }).sort((a, b) => {
      const folioA = a.folio || '';
      const folioB = b.folio || '';
      return folioB.localeCompare(folioA);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No se encontraron notas de venta.</td></tr>`;
      return;
    }

    filtered.forEach(note => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>N° ${note.folio}</strong></td>
        <td>${formatDateString(note.date)}</td>
        <td>
          <div class="customer-info-cell">
            <span class="cell-name">${note.customerName}</span>
            <span class="cell-sub text-muted">${note.customerRut}</span>
          </div>
        </td>
        <td><span class="badge ${note.warehouse === 'Industrial' ? 'badge-info' : 'badge-success'}">${note.warehouse === 'Industrial' ? 'Bodega Industrial' : 'Bodega Agrícola'}</span></td>
        <td>${formatCurrency(note.netTotal)}</td>
        <td>${formatCurrency(note.ivaVal)}</td>
        <td><strong>${formatCurrency(note.total)}</strong></td>
        <td><code>${note.user || "Sistema"}</code></td>
        <td>
          <div class="table-btn-group">
            <button class="btn-table-action view-btn" onclick="app.openInvoiceModal('${note.id}')" title="Ver / Imprimir"><i class="fa-solid fa-eye"></i></button>
            ${isAdmin() ? `<button class="btn-table-action delete-btn" onclick="app.deleteSalesNote('${note.id}')" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const showNewNoteForm = () => {
    document.getElementById("notes-list-view").classList.remove("active");
    document.getElementById("notes-form-view").classList.add("active");
    
    document.getElementById("sales-note-form").reset();
    document.getElementById("note-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("note-folio").value = getNextFolioNumber();
    document.getElementById("client-preview-card").classList.add("hidden");
    
    tempNoteUploadedFile = { name: "", data: "" };
    const ocFileLabel = document.getElementById("note-oc-file-name");
    if (ocFileLabel) ocFileLabel.innerText = "Ningún archivo seleccionado";

    const tbody = document.getElementById("note-items-tbody");
    tbody.innerHTML = "";
    populateProductDropdowns();
    addNoteItemRow();
    recalculateNoteTotals();
  };

  const hideNewNoteForm = () => {
    document.getElementById("notes-form-view").classList.remove("active");
    document.getElementById("notes-list-view").classList.add("active");
    renderNotesList();
  };

  const getNextFolioNumber = () => {
    if (state.notes.length === 0) return "000000";
    const folios = state.notes.map(n => parseInt(n.folio, 10)).filter(f => !isNaN(f));
    if (folios.length === 0) return "000000";
    const max = Math.max(...folios);
    return String(max + 1).padStart(6, '0');
  };

  const onClientSelectChange = () => {
    const select = document.getElementById("note-client-select");
    const clientId = select.value;
    const previewCard = document.getElementById("client-preview-card");
    
    if (!clientId) {
      previewCard.classList.add("hidden");
      return;
    }
    
    const client = state.customers.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById("preview-client-name").innerText = client.name;
    document.getElementById("preview-client-rut").innerText = client.rut;
    document.getElementById("preview-client-address").innerText = `Sucursal: ${client.sucursal || "Casa Matriz"}`;
    document.getElementById("preview-client-phone").innerText = `Vendedor: ${client.vendedor || "No Asignado"}`;
    document.getElementById("preview-client-email").innerText = `Contacto: ${client.contacto || "Sin Contacto"}`;
    
    previewCard.classList.remove("hidden");
  };

  const onNoteFileChange = (event) => {
    const file = event.target.files[0];
    const label = document.getElementById("note-oc-file-name");
    
    if (!file) {
      label.innerText = "Ningún archivo seleccionado";
      tempNoteUploadedFile = { name: "", data: "" };
      return;
    }

    label.innerText = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      tempNoteUploadedFile = {
        name: file.name,
        data: e.target.result
      };
    };
    reader.readAsDataURL(file);
  };

  const addNoteItemRow = () => {
    const tbody = document.getElementById("note-items-tbody");
    const tr = document.createElement("tr");
    const rowId = generateUUID();
    tr.id = `row-${rowId}`;

    tr.innerHTML = `
      <td>
        <input type="number" class="row-qty-input" required value="1" min="1" oninput="app.onRowQtyChange('${rowId}')">
      </td>
      <td>
        <input type="number" class="row-kilos-input" required value="0" step="0.01" min="0" oninput="app.onRowKilosChange('${rowId}')">
      </td>
      <td>
        <input type="text" list="stock-options-list" class="row-product-desc-input" placeholder="Escribe o selecciona producto..." onchange="app.onRowProductDatalistChange('${rowId}')" style="width:100%;">
      </td>
      <td>
        <input type="number" class="row-price-input" value="0" min="0" oninput="app.recalculateNoteTotals()">
      </td>
      <td>
        <select class="row-price-basis-select" onchange="app.recalculateNoteTotals()" style="width:100%;">
          <option value="qty" selected>Por Und/Mts</option>
          <option value="kilos">Por Kilo</option>
        </select>
      </td>
      <td>
        <span class="row-total-span">$0</span>
      </td>
      <td class="text-center">
        <button type="button" class="btn-table-action delete-btn" onclick="app.removeNoteItemRow('${rowId}')" title="Eliminar fila">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  };

  const removeNoteItemRow = (rowId) => {
    const tbody = document.getElementById("note-items-tbody");
    const row = document.getElementById(`row-${rowId}`);
    if (row) {
      tbody.removeChild(row);
      if (tbody.children.length === 0) {
        addNoteItemRow();
      }
      recalculateNoteTotals();
    }
  };

  const onRowProductDatalistChange = (rowId) => {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    const descInput = row.querySelector(".row-product-desc-input");
    const priceInput = row.querySelector(".row-price-input");
    const qtyInput = row.querySelector(".row-qty-input");
    const kilosInput = row.querySelector(".row-kilos-input");
    
    const value = descInput.value.trim();
    if (!value) {
      priceInput.value = 0;
      recalculateNoteTotals();
      return;
    }
    
    const currentWarehouse = document.getElementById("note-warehouse-select").value;
    const stockItem = state.stock.find(s => 
      s.warehouse === currentWarehouse && 
      (value.toUpperCase().startsWith(s.op.toUpperCase()) || value.toLowerCase() === s.description.toLowerCase())
    );
    
    if (stockItem) {
      priceInput.value = 5000; 
      const qty = parseInt(qtyInput.value || 0, 10);
      
      const kilosPerUnit = stockItem.undMts > 0 ? (stockItem.kilos / stockItem.undMts) : 0;
      if (kilosInput) {
        kilosInput.value = (kilosPerUnit * qty).toFixed(2);
      }
      
      if (qty > stockItem.undMts) {
        qtyInput.style.borderColor = "var(--accent-red)";
      } else {
        qtyInput.style.borderColor = "";
      }
      
      descInput.value = `${stockItem.op} - ${stockItem.description}`;
      descInput.setAttribute("data-stock-id", stockItem.id);
    } else {
      descInput.removeAttribute("data-stock-id");
      qtyInput.style.borderColor = "";
      if (kilosInput) kilosInput.style.borderColor = "";
    }
    
    recalculateNoteTotals();
  };

  const onRowQtyChange = (rowId) => {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    const descInput = row.querySelector(".row-product-desc-input");
    const qtyInput = row.querySelector(".row-qty-input");
    const kilosInput = row.querySelector(".row-kilos-input");
    
    const qty = parseInt(qtyInput.value || 0, 10);
    
    const stockId = descInput.getAttribute("data-stock-id");
    if (stockId) {
      const stockItem = state.stock.find(s => s.id === stockId);
      if (stockItem) {
        if (qty > stockItem.undMts) {
          qtyInput.style.borderColor = "var(--accent-red)";
        } else {
          qtyInput.style.borderColor = "";
        }
        const kilosPerUnit = stockItem.undMts > 0 ? (stockItem.kilos / stockItem.undMts) : 0;
        if (kilosInput) {
          kilosInput.value = (kilosPerUnit * qty).toFixed(2);
        }
      }
    }
    recalculateNoteTotals();
  };

  const onRowKilosChange = (rowId) => {
    const row = document.getElementById(`row-${rowId}`);
    if (!row) return;
    const descInput = row.querySelector(".row-product-desc-input");
    const kilosInput = row.querySelector(".row-kilos-input");
    
    const stockId = descInput.getAttribute("data-stock-id");
    if (stockId) {
      const stockItem = state.stock.find(s => s.id === stockId);
      if (stockItem && kilosInput) {
        const kilos = parseFloat(kilosInput.value || 0);
        if (kilos > stockItem.kilos) {
          kilosInput.style.borderColor = "var(--accent-red)";
        } else {
          kilosInput.style.borderColor = "";
        }
      }
    }
    recalculateNoteTotals();
  };

  const populateProductDropdowns = () => {
    const datalist = document.getElementById("stock-options-list");
    if (datalist) {
      const warehouse = document.getElementById("note-warehouse-select").value;
      let optionsHTML = "";
      state.stock.filter(item => item.warehouse === warehouse && (item.undMts > 0 || item.kilos > 0)).forEach(item => {
        optionsHTML += `<option value="${item.op} - ${item.description}">${item.description} (Disp: ${item.undMts} Und / ${item.kilos} kg)</option>`;
      });
      datalist.innerHTML = optionsHTML;
    }
  };

  const populateOTProductDatalist = () => {
    const datalist = document.getElementById("ot-stock-options-list");
    if (!datalist) return;
    
    let optionsHTML = "";
    const otId = document.getElementById("ot-id").value;
    const editedOT = otId ? state.transportOrders.find(o => o.id === otId) : null;
    
    state.stock.forEach(item => {
      let tempUnd = item.undMts;
      let tempKilos = item.kilos;
      
      if (editedOT) {
        const origItem = editedOT.items.find(pi => pi.stockId === item.id);
        if (origItem) {
          tempUnd += origItem.undMts;
          tempKilos += origItem.kilos;
        }
      }
      
      if (tempUnd > 0 || tempKilos > 0) {
        optionsHTML += `<option value="${item.op} - ${item.clientName} [${item.warehouse}]">${item.description} (Disp: ${tempUnd}m / ${tempKilos}kg)</option>`;
      }
    });
    
    datalist.innerHTML = optionsHTML;
  };

  const recalculateNoteTotals = () => {
    const tbody = document.getElementById("note-items-tbody");
    if (!tbody) return;
    const rows = tbody.querySelectorAll("tr");
    let subtotal = 0;
    
    rows.forEach(row => {
      const descInput = row.querySelector(".row-product-desc-input");
      const priceInput = row.querySelector(".row-price-input");
      const qtyInput = row.querySelector(".row-qty-input");
      const kilosInput = row.querySelector(".row-kilos-input");
      const basisSelect = row.querySelector(".row-price-basis-select");
      const totalSpan = row.querySelector(".row-total-span");
      
      if (priceInput && qtyInput && totalSpan) {
        const price = parseFloat(priceInput.value || 0);
        const qty = parseInt(qtyInput.value || 0, 10);
        const kilos = parseFloat(kilosInput ? kilosInput.value || 0 : 0);
        const basis = basisSelect ? basisSelect.value : "qty";
        
        let rowTotal = 0;
        if (basis === "kilos") {
          rowTotal = price * kilos;
        } else {
          rowTotal = price * qty;
        }
        
        if (descInput && descInput.value.trim() !== "") {
          subtotal += rowTotal;
        }
        
        totalSpan.innerText = formatCurrency(rowTotal);
      }
    });

    document.getElementById("calc-subtotal").innerText = formatCurrency(subtotal);
    const discountPercent = parseFloat(document.getElementById("note-discount").value || 0);
    const discountVal = subtotal * (discountPercent / 100);
    document.getElementById("calc-discount").innerText = `-${formatCurrency(discountVal)}`;
    
    const netTotal = subtotal - discountVal;
    document.getElementById("calc-net-total").innerText = formatCurrency(netTotal);
    
    const applyIva = document.getElementById("note-apply-iva").checked;
    const ivaVal = applyIva ? Math.round(netTotal * 0.19) : 0;
    document.getElementById("calc-iva").innerText = formatCurrency(ivaVal);
    
    const total = netTotal + ivaVal;
    document.getElementById("calc-total").innerText = formatCurrency(total);
  };

  const saveSalesNote = (event) => {
    event.preventDefault();
    const clientId = document.getElementById("note-client-select").value;
    const date = document.getElementById("note-date").value;
    const paymentMethod = document.getElementById("note-payment-method").value;
    const deliveryDate = document.getElementById("note-delivery-date").value;
    const comments = document.getElementById("note-comments").value;
    const discountPercent = parseFloat(document.getElementById("note-discount").value || 0);
    const applyIva = document.getElementById("note-apply-iva").checked;
    const warehouse = document.getElementById("note-warehouse-select").value;
    
    // OC details
    const ocNumber = document.getElementById("note-oc-number").value.trim();
    const ocFileName = tempNoteUploadedFile.name || "Ninguno";
    const ocFileData = tempNoteUploadedFile.data || "";

    if (!clientId) {
      alert("Por favor seleccione un cliente.");
      return;
    }

    const client = state.customers.find(c => c.id === clientId);
    if (!client) return;

    const tbody = document.getElementById("note-items-tbody");
    const rows = tbody.querySelectorAll("tr");
    const items = [];
    let subtotal = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const descInput = row.querySelector(".row-product-desc-input");
      const priceInput = row.querySelector(".row-price-input");
      const qtyInput = row.querySelector(".row-qty-input");
      const kilosInput = row.querySelector(".row-kilos-input");
      const basisSelect = row.querySelector(".row-price-basis-select");
      
      if (!descInput) continue;
      const desc = descInput.value.trim();
      if (!desc) continue;

      const qty = parseInt(qtyInput.value || 0, 10);
      const price = parseFloat(priceInput.value || 0);
      const kilos = parseFloat(kilosInput ? kilosInput.value || 0 : 0);
      const basis = basisSelect ? basisSelect.value : "qty";
      
      let itemTotal = 0;
      if (basis === "kilos") {
        itemTotal = price * kilos;
      } else {
        itemTotal = price * qty;
      }
      
      subtotal += itemTotal;
      
      let code = "MANUAL";
      const stockId = descInput.getAttribute("data-stock-id");
      if (stockId) {
        const stockItem = state.stock.find(s => s.id === stockId);
        if (stockItem) {
          code = stockItem.op;
        }
      } else {
        const opMatch = desc.match(/^(OP-\w+)/i);
        if (opMatch) {
          code = opMatch[1].toUpperCase();
        }
      }

      items.push({
        productId: stockId || "manual",
        code: code,
        name: desc,
        price: price,
        quantity: qty,
        kilos: kilos,
        basis: basis,
        total: itemTotal
      });
    }

    const folio = document.getElementById("note-folio").value;
    const discountVal = Math.round(subtotal * (discountPercent / 100));
    const netTotal = subtotal - discountVal;
    const ivaVal = applyIva ? Math.round(netTotal * 0.19) : 0;
    const total = netTotal + ivaVal;

    const newNote = {
      id: generateUUID(),
      folio: folio,
      date: date,
      customerId: client.id,
      customerName: client.name,
      customerRut: client.rut,
      customerEmail: client.email,
      customerPhone: client.phone,
      customerAddress: client.sucursal || "Casa Matriz",
      customerCity: "Lautaro",
      paymentMethod: paymentMethod,
      deliveryDate: deliveryDate,
      comments: comments,
      warehouse: warehouse,
      items: items,
      subtotal: subtotal,
      discountPercent: discountPercent,
      discountVal: discountVal,
      netTotal: netTotal,
      ivaVal: ivaVal,
      applyIva: applyIva,
      total: total,
      ocNumber: ocNumber || "N/A",
      ocFileName: ocFileName,
      ocFileData: ocFileData,
      user: state.currentUser ? state.currentUser.name : "Sistema"
    };

    state.notes.push(newNote);
    
    // Reset temporary note upload variables and input label
    tempNoteUploadedFile = { name: "", data: "" };
    const ocFileInput = document.getElementById("note-oc-file");
    if (ocFileInput) ocFileInput.value = "";
    const ocFileLabel = document.getElementById("note-oc-file-name");
    if (ocFileLabel) ocFileLabel.innerText = "Ningún archivo seleccionado";

    // Log Note of Venta creation
    state.warehouseLog.push({
      id: generateUUID(),
      date: new Date().toISOString(),
      type: "adjustment",
      op: `NV-${folio}`,
      clientName: client.name,
      warehouse: warehouse,
      undMts: 0,
      kilos: 0,
      reference: `Nota de Venta Emitida (Total: ${formatCurrency(total)})`,
      user: state.currentUser ? state.currentUser.name : "Sistema"
    });

    saveToLocalStorage();
    alert(`Nota de Venta N° ${folio} guardada con éxito.`);
    hideNewNoteForm();
    renderDashboard();
  };

  const deleteSalesNote = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden eliminar notas de venta.");
      return;
    }
    const note = state.notes.find(n => n.id === id);
    if (!note) return;
    
    const confirmDelete = confirm(`¿Desea eliminar la Nota de Venta N° ${note.folio}?`);
    if (!confirmDelete) return;
    
    state.notes = state.notes.filter(n => n.id !== id);
    saveToLocalStorage();
    renderNotesList();
    renderDashboard();
  };

  // --- 4. INGRESO A BODEGA CONTROLLER ---
  const setIntakeWarehouse = (warehouse) => {
    document.getElementById("intake-warehouse").value = warehouse;
    const btnInd = document.getElementById("btn-intake-industrial");
    const btnAgr = document.getElementById("btn-intake-agricola");
    
    if (warehouse === "Industrial") {
      btnInd.className = "btn btn-primary btn-lg flex-1";
      btnInd.style.background = "linear-gradient(135deg, var(--accent-cyan) 0%, #0c4a6e 100%)";
      btnAgr.className = "btn btn-secondary btn-lg flex-1";
      btnAgr.style.background = "";
    } else {
      btnAgr.className = "btn btn-primary btn-lg flex-1";
      btnAgr.style.background = "linear-gradient(135deg, var(--accent-emerald) 0%, #064e3b 100%)";
      btnInd.className = "btn btn-secondary btn-lg flex-1";
      btnInd.style.background = "";
    }
  };

  const setupIntakeForm = () => {
    document.getElementById("intake-id").value = "";
    document.getElementById("intake-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("warehouse-intake-form").reset();
    document.getElementById("intake-warehouse").value = "Industrial";
    setIntakeWarehouse("Industrial");
    populateClientDropdowns();
    renderIntakesHistory();

    const formTitle = document.querySelector("#panel-intake h3");
    if (formTitle) formTitle.innerText = "Registrar Entrada de Mercadería (Ingreso)";
    
    const submitBtn = document.querySelector("#panel-intake form button[type='submit']");
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-square-plus"></i> Procesar Ingreso a Bodega';
  };

  const renderIntakesHistory = () => {
    const tbody = document.getElementById("intakes-history-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const intakes = state.warehouseLog
      .filter(log => log.type === "intake")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    if (intakes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay ingresos recientes.</td></tr>';
      return;
    }

    intakes.forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDateTime(log.date)}</td>
        <td><b>${log.op}</b></td>
        <td>${log.clientName}</td>
        <td><span class="badge ${log.warehouse === 'Industrial' ? 'badge-info' : 'badge-success'}">${log.warehouse}</span></td>
        <td class="text-center text-emerald"><b>+${log.undMts}</b></td>
        <td class="text-center text-emerald"><b>+${log.kilos} kg</b></td>
        <td><code>${log.user || "Sistema"}</code></td>
        <td>
          <div class="table-btn-group">
            <button class="btn-table-action" onclick="app.printIntakeLabel('${log.id}')" title="Imprimir Etiqueta" style="background-color: var(--accent-cyan); color: white;"><i class="fa-solid fa-print"></i></button>
            ${isAdmin() ? `
              <button class="btn-table-action edit-btn" onclick="app.openEditIntakeModal('${log.id}')" title="Editar"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-table-action delete-btn" onclick="app.deleteIntakeLog('${log.id}')" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const openEditIntakeModal = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar ingresos.");
      return;
    }
    const log = state.warehouseLog.find(l => l.id === id);
    if (!log) return;

    // Poblar formulario
    document.getElementById("intake-id").value = log.id;
    document.getElementById("intake-date").value = log.date.split('T')[0];
    document.getElementById("intake-op").value = log.op;
    
    setIntakeWarehouse(log.warehouse);

    populateClientDropdowns();
    document.getElementById("intake-client-select").value = log.clientName;

    document.getElementById("intake-und-mts").value = log.undMts;
    document.getElementById("intake-kilos").value = log.kilos;
    document.getElementById("intake-description").value = log.description || "";
    document.getElementById("intake-observacion").value = log.observacion || "";

    const formTitle = document.querySelector("#panel-intake h3");
    if (formTitle) formTitle.innerText = "Editar Entrada de Mercadería (Ingreso)";
    
    const submitBtn = document.querySelector("#panel-intake form button[type='submit']");
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios de Ingreso';
  };

  const deleteIntakeLog = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden eliminar registros de bodega.");
      return;
    }
    const log = state.warehouseLog.find(l => l.id === id);
    if (!log) return;

    const confirmDelete = confirm(`¿Desea eliminar este registro de ingreso?\n\nOP: ${log.op}\nCliente: ${log.clientName}\nCantidad: ${log.undMts} Und/Mts y ${log.kilos} kg.\n\nNota: Esto restará estas cantidades del stock físico.`);
    if (!confirmDelete) return;

    const stockItem = state.stock.find(item => 
      item.op === log.op && 
      item.clientName === log.clientName && 
      item.warehouse === log.warehouse
    );

    if (stockItem) {
      if (stockItem.undMts < log.undMts || stockItem.kilos < log.kilos) {
        const force = confirm(`El stock disponible actual (${stockItem.undMts}m / ${stockItem.kilos}kg) es menor que la cantidad a restar.\n¿Desea forzar la eliminación de todas formas (el stock quedará en 0 o negativo)?`);
        if (!force) return;
      }
      stockItem.undMts = Math.max(0, stockItem.undMts - log.undMts);
      stockItem.kilos = Math.max(0, stockItem.kilos - log.kilos);
    }

    state.warehouseLog = state.warehouseLog.filter(l => l.id !== id);

    saveToLocalStorage();
    alert("Registro de ingreso eliminado y stock actualizado.");
    renderIntakesHistory();
    renderStockList();
    renderDashboard();
    renderReports();
  };

  const saveWarehouseIntake = (event) => {
    event.preventDefault();
    const id = document.getElementById("intake-id").value;
    const date = document.getElementById("intake-date").value;
    const op = document.getElementById("intake-op").value.toUpperCase().trim();
    const clientName = document.getElementById("intake-client-select").value;
    const undMts = parseInt(document.getElementById("intake-und-mts").value || 0, 10);
    const kilos = parseFloat(document.getElementById("intake-kilos").value || 0);
    const description = document.getElementById("intake-description").value.trim();
    const observacion = document.getElementById("intake-observacion").value.trim();
    const warehouse = document.getElementById("intake-warehouse").value;

    if (id && !isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar registros de bodega.");
      return;
    }

    if (!clientName) {
      alert("Por favor seleccione un cliente.");
      return;
    }

    if (id) {
      const log = state.warehouseLog.find(l => l.id === id);
      if (!log) return;

      const originalStock = state.stock.find(item => 
        item.op === log.op && 
        item.clientName === log.clientName && 
        item.warehouse === log.warehouse
      );
      if (originalStock) {
        originalStock.undMts = Math.max(0, originalStock.undMts - log.undMts);
        originalStock.kilos = Math.max(0, originalStock.kilos - log.kilos);
      }

      const newStock = state.stock.find(item => 
        item.op === op && 
        item.clientName === clientName && 
        item.warehouse === warehouse
      );
      if (newStock) {
        newStock.undMts += undMts;
        newStock.kilos += kilos;
        newStock.description = description;
        newStock.observacion = observacion;
      } else {
        state.stock.push({
          id: generateUUID(),
          op,
          clientName,
          description,
          undMts,
          kilos,
          warehouse,
          date,
          observacion
        });
      }

      log.date = new Date(date).toISOString();
      log.op = op;
      log.clientName = clientName;
      log.warehouse = warehouse;
      log.undMts = undMts;
      log.kilos = kilos;
      log.description = description;
      log.observacion = observacion;
      log.reference = `Ingreso OP modificado (${description})`;
      log.user = state.currentUser ? state.currentUser.name : "Sistema";

      alert("Ingreso a bodega modificado con éxito.");
    } else {
      const existing = state.stock.find(item => 
        item.op === op && 
        item.clientName === clientName && 
        item.warehouse === warehouse
      );

      if (existing) {
        existing.undMts += undMts;
        existing.kilos += kilos;
        existing.description = description;
        existing.observacion = observacion;
      } else {
        state.stock.push({
          id: generateUUID(),
          op,
          clientName,
          description,
          undMts,
          kilos,
          warehouse,
          date,
          observacion
        });
      }

      state.warehouseLog.push({
        id: generateUUID(),
        date: new Date().toISOString(),
        type: "intake",
        op,
        clientName,
        warehouse,
        undMts,
        kilos,
        description,
        observacion,
        reference: `Ingreso OP manual (${description})`,
        user: state.currentUser ? state.currentUser.name : "Sistema"
      });

      alert(`Ingreso exitoso: ${undMts} Und/Mts y ${kilos} kg cargados a Bodega ${warehouse}.`);
    }

    saveToLocalStorage();
    setupIntakeForm();
    renderDashboard();
    renderReports();
  };

  // --- 5. STOCK CONTROLLER ---
  const setStockWarehouseTab = (warehouse) => {
    document.getElementById("stock-active-warehouse").value = warehouse;
    const btnInd = document.getElementById("tab-stock-industrial");
    const btnAgr = document.getElementById("tab-stock-agricola");
    
    if (warehouse === "Industrial") {
      btnInd.classList.add("active");
      btnInd.style.borderBottom = "3px solid var(--accent-cyan)";
      btnInd.style.color = "var(--text-primary)";
      
      btnAgr.classList.remove("active");
      btnAgr.style.borderBottom = "3px solid transparent";
      btnAgr.style.color = "var(--text-secondary)";
    } else {
      btnAgr.classList.add("active");
      btnAgr.style.borderBottom = "3px solid var(--accent-emerald)";
      btnAgr.style.color = "var(--text-primary)";
      
      btnInd.classList.remove("active");
      btnInd.style.borderBottom = "3px solid transparent";
      btnInd.style.color = "var(--text-secondary)";
    }
    
    renderStockList();
  };

  const renderStockList = () => {
    const tbody = document.getElementById("stock-list-tbody");
    if (!tbody) return;
    const searchVal = document.getElementById("search-stock").value.toLowerCase().trim();
    const activeWarehouse = document.getElementById("stock-active-warehouse").value;
    tbody.innerHTML = "";

    // Show only real stock (stock > 0)
    const filtered = state.stock.filter(item => {
      const isCorrectWarehouse = item.warehouse === activeWarehouse;
      const isRealStock = (item.undMts > 0 || item.kilos > 0);
      const opMatch = item.op ? item.op.toLowerCase().includes(searchVal) : false;
      const descMatch = item.description ? item.description.toLowerCase().includes(searchVal) : false;
      const clientMatch = item.clientName ? item.clientName.toLowerCase().includes(searchVal) : false;
      return isCorrectWarehouse && isRealStock && (opMatch || descMatch || clientMatch);
    }).sort((a, b) => {
      const opA = a.op || '';
      const opB = b.op || '';
      return opA.localeCompare(opB);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se encontró stock real disponible.</td></tr>';
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${item.op}</strong></td>
        <td>${item.clientName}</td>
        <td>${item.description}</td>
        <td class="text-center"><b>${item.undMts}</b></td>
        <td class="text-center"><b>${item.kilos} kg</b></td>
        <td><span class="text-muted" style="font-size:12px;">${item.observacion || "-"}</span></td>
        <td>
          <div class="table-btn-group">
            ${isAdmin() ? `<button class="btn-table-action edit-btn" onclick="app.navigateTo('panel-adjust')" title="Ir a Ajustes"><i class="fa-solid fa-sliders"></i> Ajustar</button>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const exportStockToExcel = () => {
    loadSheetJS(() => {
      try {
        const wb = XLSX.utils.book_new();
        
        // Stock real Industrial
        const industrialStock = state.stock.filter(item => item.warehouse === "Industrial" && (item.undMts > 0 || item.kilos > 0)).map(item => ({
          "OP (SKU)": item.op,
          "Cliente": item.clientName,
          "Descripción": item.description,
          "Unidades/Metros": item.undMts,
          "Kilos": item.kilos,
          "Fecha Ingreso": item.date,
          "Observación": item.observacion || ""
        }));

        // Stock real Agricola
        const agricolaStock = state.stock.filter(item => item.warehouse === "Agricola" && (item.undMts > 0 || item.kilos > 0)).map(item => ({
          "OP (SKU)": item.op,
          "Cliente": item.clientName,
          "Descripción": item.description,
          "Unidades/Metros": item.undMts,
          "Kilos": item.kilos,
          "Fecha Ingreso": item.date,
          "Observación": item.observacion || ""
        }));

        const wsInd = XLSX.utils.json_to_sheet(industrialStock);
        const wsAgr = XLSX.utils.json_to_sheet(agricolaStock);

        XLSX.utils.book_append_sheet(wb, wsInd, "Industrial");
        XLSX.utils.book_append_sheet(wb, wsAgr, "Agricola");

        XLSX.writeFile(wb, "Stock_Real_Plasticos_Temuco.xlsx");
        alert("Excel exportado exitosamente con hojas 'Industrial' y 'Agricola'.");
      } catch (err) {
        alert("Error al exportar Excel.");
        console.error(err);
      }
    });
  };

  const exportValuationToExcel = () => {
    loadSheetJS(() => {
      try {
        const wb = XLSX.utils.book_new();
        const data = state.stock.map(item => {
          const refPrice = 5000;
          const totalVal = item.undMts * refPrice;
          return {
            "Bodega": item.warehouse,
            "OP (SKU)": item.op,
            "Cliente": item.clientName,
            "Descripción": item.description,
            "Metros/Unidades": item.undMts,
            "Kilos": item.kilos,
            "Precio Ref ($)": refPrice,
            "Valor Neto Total ($)": totalVal,
            "Fecha Ingreso": item.date,
            "Observación": item.observacion || ""
          };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Valorizacion");
        XLSX.writeFile(wb, "Valorizacion_Inventario_Plasticos_Temuco.xlsx");
        alert("Valorización de inventario exportada exitosamente.");
      } catch (err) {
        alert("Error al exportar la valorización.");
        console.error(err);
      }
    });
  };

  const exportSalesReportToExcel = () => {
    loadSheetJS(() => {
      try {
        const wb = XLSX.utils.book_new();
        const data = state.notes.map(note => ({
          "Folio": note.folio,
          "Fecha Emisión": note.date,
          "Cliente": note.customerName,
          "RUT Cliente": note.customerRut || "N/A",
          "Bodega Despacho": note.warehouse,
          "Forma de Pago": note.paymentMethod,
          "Subtotal Neto ($)": note.subtotal,
          "Descuento (%)": note.discountPercent || 0,
          "Descuento ($)": note.discountVal || 0,
          "Neto Afecto ($)": note.netTotal,
          "IVA ($)": note.ivaVal,
          "Total ($)": note.total,
          "OC Referencia": note.ocNumber || "N/A",
          "Usuario Creador": note.user || "Administrador",
          "Comentarios": note.comments || ""
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Ventas");
        XLSX.writeFile(wb, "Resumen_Ventas_Plasticos_Temuco.xlsx");
        alert("Resumen de ventas exportado exitosamente.");
      } catch (err) {
        alert("Error al exportar el resumen de ventas.");
        console.error(err);
      }
    });
  };

  const exportMovementLogToExcel = () => {
    loadSheetJS(() => {
      try {
        const wb = XLSX.utils.book_new();
        const data = state.warehouseLog.map(log => ({
          "Fecha/Hora": formatDateTime(log.date),
          "Tipo Movimiento": log.type === "intake" ? "Ingreso" : (log.type === "ot_dispatch" ? "Despacho OT" : "Ajuste/Sistema"),
          "OP (SKU)": log.op,
          "Bodega": log.warehouse || "N/A",
          "Metros/Unidades": log.undMts || 0,
          "Kilos": log.kilos || 0,
          "Cliente/Referencia": log.clientName || "N/A",
          "Usuario": log.user || "Sistema",
          "Comentarios/Detalle": log.reference || ""
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Bitacora");
        XLSX.writeFile(wb, "Bitacora_Movimientos_Plasticos_Temuco.xlsx");
        alert("Bitácora de movimientos exportada exitosamente.");
      } catch (err) {
        alert("Error al exportar la bitácora.");
        console.error(err);
      }
    });
  };

  const importStockExcel = (event) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden importar stock.");
      event.target.value = "";
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    loadSheetJS(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);

          if (rows.length === 0) {
            alert("El archivo Excel está vacío.");
            return;
          }

          let importCount = 0;
          let updateCount = 0;
          let skipCount = 0;

          rows.forEach(row => {
            const keys = Object.keys(row);
            
            const opKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('op') || k.toLowerCase().replace(/\s/g, '').includes('sku'));
            const clientKey = keys.find(k => k.toLowerCase().includes('cliente') || k.toLowerCase().includes('client'));
            const descKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('descrip') || k.toLowerCase() === 'producto' || k.toLowerCase() === 'name');
            const undKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('unidad') || k.toLowerCase().replace(/\s/g, '').includes('metro') || k.toLowerCase().replace(/\s/g, '').includes('und') || k.toLowerCase().replace(/\s/g, '').includes('mts'));
            const kilosKey = keys.find(k => k.toLowerCase().includes('kilo') || k.toLowerCase() === 'kg' || k.toLowerCase() === 'kgs');
            const warehouseKey = keys.find(k => k.toLowerCase().includes('bodega') || k.toLowerCase().includes('warehouse'));
            const dateKey = keys.find(k => k.toLowerCase().includes('fecha') || k.toLowerCase().includes('date'));
            const obsKey = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes('observa') || k.toLowerCase() === 'obs' || k.toLowerCase() === 'comentario');

            const op = opKey ? String(row[opKey]).trim().toUpperCase() : '';
            const clientName = clientKey ? String(row[clientKey]).trim() : '';
            const description = descKey ? String(row[descKey]).trim() : 'Lote importado';
            const undMts = undKey ? Math.max(0, parseInt(row[undKey] || 0, 10)) : 0;
            const kilos = kilosKey ? Math.max(0, parseFloat(row[kilosKey] || 0)) : 0;
            const date = dateKey ? String(row[dateKey]).trim() : new Date().toISOString().split('T')[0];
            const observacion = obsKey ? String(row[obsKey]).trim() : '';
            
            let warehouse = "Industrial";
            if (warehouseKey) {
              const whVal = String(row[warehouseKey]).trim().toLowerCase();
              if (whVal.includes('agri') || whVal.includes('agr')) {
                warehouse = "Agricola";
              }
            }

            if (!op || !clientName) {
              skipCount++;
              return;
            }

            const existing = state.stock.find(item => 
              item.op === op && 
              item.clientName === clientName && 
              item.warehouse === warehouse
            );

            if (existing) {
              existing.undMts = undMts;
              existing.kilos = kilos;
              existing.description = description;
              existing.observacion = observacion;
              existing.date = date;
              updateCount++;
            } else {
              state.stock.push({
                id: generateUUID(),
                op,
                clientName,
                description,
                undMts,
                kilos,
                warehouse,
                date,
                observacion
              });
              importCount++;
            }

            state.warehouseLog.push({
              id: generateUUID(),
              date: new Date().toISOString(),
              type: "intake",
              op,
              clientName,
              warehouse,
              undMts,
              kilos,
              reference: `Carga masiva Excel (Importación Stock)`,
              user: state.currentUser ? state.currentUser.name : "Sistema"
            });
          });

          saveToLocalStorage();
          alert(`Importación de Stock:\n\n* ${importCount} lotes nuevos ingresados.\n* ${updateCount} lotes existentes actualizados.\n* ${skipCount} omitidos por falta de OP o Cliente.`);
          renderStockList();
          renderDashboard();
        } catch (err) {
          alert("Error al procesar planilla de stock.");
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
    event.target.value = "";
  };

  // --- 6. AJUSTE DE INVENTARIO CONTROLLER ---
  const setupAdjustForm = () => {
    const select = document.getElementById("adjust-product-select");
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleccionar OP de Stock --</option>';
    
    state.stock.filter(item => item.undMts > 0 || item.kilos > 0).sort((a,b) => (a.op || '').localeCompare(b.op || '')).forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.innerText = `${item.op} - ${item.clientName} [Bodega: ${item.warehouse}] (Disp: ${item.undMts}m / ${item.kilos}kg)`;
      select.appendChild(opt);
    });

    document.getElementById("inventory-adjust-form").reset();
    renderAdjustHistory();
  };

  const renderAdjustHistory = () => {
    const tbody = document.getElementById("adjust-history-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    const adjustments = state.warehouseLog
      .filter(log => log.type === "adjustment")
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8);

    if (adjustments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay ajustes registrados.</td></tr>';
      return;
    }

    adjustments.forEach(log => {
      const tr = document.createElement("tr");
      const isPositive = log.undMts > 0 || log.kilos > 0;
      tr.innerHTML = `
        <td>${formatDateTime(log.date)}</td>
        <td><b>${log.op}</b></td>
        <td><span class="badge ${log.warehouse === 'Industrial' ? 'badge-info' : 'badge-success'}">${log.warehouse}</span></td>
        <td class="text-center ${isPositive ? 'text-emerald' : 'text-danger'}">
          <b>${isPositive ? '+' : ''}${log.undMts} Und | ${isPositive ? '+' : ''}${log.kilos} kg</b>
        </td>
        <td><code>${log.user || "Sistema"}</code></td>
        <td><span class="text-muted" style="font-size:11px;">${log.reference}</span></td>
      `;
      tbody.appendChild(tr);
    });
  };

  const saveInventoryAdjustment = (event) => {
    event.preventDefault();
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden realizar ajustes de inventario.");
      return;
    }
    const stockId = document.getElementById("adjust-product-select").value;
    const type = document.getElementById("adjust-type-select").value;
    const undMts = parseInt(document.getElementById("adjust-und-mts").value || 0, 10);
    const kilos = parseFloat(document.getElementById("adjust-kilos").value || 0);
    const reason = document.getElementById("adjust-reason").value;

    if (!stockId) {
      alert("Debe seleccionar un lote de stock.");
      return;
    }

    const stockItem = state.stock.find(item => item.id === stockId);
    if (!stockItem) return;

    const multiplier = type === "increase" ? 1 : -1;
    const adjUnd = undMts * multiplier;
    const adjKil = kilos * multiplier;

    if (type === "decrease") {
      if (stockItem.undMts < undMts || stockItem.kilos < kilos) {
        const force = confirm(`Estás disminuyendo más stock del disponible (${stockItem.undMts}m / ${stockItem.kilos}kg).\n¿Deseas continuar?`);
        if (!force) return;
      }
    }

    // Apply adjustments
    stockItem.undMts = Math.max(0, stockItem.undMts + adjUnd);
    stockItem.kilos = Math.max(0, stockItem.kilos + adjKil);

    // Log adjustment
    state.warehouseLog.push({
      id: generateUUID(),
      date: new Date().toISOString(),
      type: "adjustment",
      op: stockItem.op,
      clientName: stockItem.clientName,
      warehouse: stockItem.warehouse,
      undMts: adjUnd,
      kilos: adjKil,
      reference: reason,
      user: state.currentUser ? state.currentUser.name : "Sistema"
    });

    saveToLocalStorage();
    alert("Ajuste aplicado exitosamente.");
    setupAdjustForm();
    renderDashboard();
  };

  // --- 7. CREAR OT CONTROLLER ---
  const setupOTView = () => {
    document.getElementById("ot-list-view").classList.add("active");
    document.getElementById("ot-form-view").classList.remove("active");
    renderOTList();
  };

  const renderOTList = () => {
    const tbody = document.getElementById("ot-list-tbody");
    if (!tbody) return;
    const searchVal = document.getElementById("search-ot").value.toLowerCase().trim();
    tbody.innerHTML = "";

    const filtered = state.transportOrders.filter(ot => {
      const otNumMatch = ot.otNumber ? ot.otNumber.toLowerCase().includes(searchVal) : false;
      const nameMatch = ot.clientName ? ot.clientName.toLowerCase().includes(searchVal) : false;
      const rutMatch = ot.clientRut ? ot.clientRut.toLowerCase().includes(searchVal) : false;
      const carrierMatch = ot.carrier ? ot.carrier.toLowerCase().includes(searchVal) : false;
      return otNumMatch || nameMatch || rutMatch || carrierMatch;
    }).sort((a, b) => {
      const otNumA = a.otNumber || '';
      const otNumB = b.otNumber || '';
      return otNumB.localeCompare(otNumA);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No se encontraron Órdenes de Transporte.</td></tr>';
      return;
    }

    filtered.forEach(ot => {
      const tr = document.createElement("tr");
      
      let statusBadge = '<span class="badge badge-warning">Emitida</span>';
      if (ot.status === "Despachada") {
        statusBadge = '<span class="badge badge-info">Despachada</span>';
      } else if (ot.status === "Entregado") {
        statusBadge = '<span class="badge badge-success">Entregado</span>';
      }

      tr.innerHTML = `
        <td><strong>${ot.otNumber}</strong></td>
        <td>
          OC: ${ot.ocNumber || 'N/A'}<br>
          NV: ${ot.nvNumber || 'N/A'}
        </td>
        <td>${formatDateString(ot.date)}</td>
        <td>
          <div class="customer-info-cell">
            <span class="cell-name">${ot.clientName}</span>
            <span class="cell-sub text-muted">${ot.clientRut}</span>
          </div>
        </td>
        <td>${ot.carrier}</td>
        <td>${ot.clientVendedor || "N/A"}</td>
        <td><code>${ot.plate}</code></td>
        <td><code>${ot.user || "Sistema"}</code></td>
        <td>
          <div style="cursor:pointer;" onclick="app.changeOTStatus('${ot.id}')" title="Cambiar Estado">
            ${statusBadge}
          </div>
        </td>
        <td>
          <div class="table-btn-group">
            <button class="btn-table-action view-btn" onclick="app.openOTModal('${ot.id}')" title="Ver / Imprimir"><i class="fa-solid fa-eye"></i></button>
            <button class="btn-table-action" onclick="app.openEmailModal('${ot.id}')" title="Enviar Correo" style="background-color: var(--accent-purple); color: white;"><i class="fa-solid fa-envelope"></i></button>
            ${isAdmin() ? `
              <button class="btn-table-action edit-btn" onclick="app.openEditOTModal('${ot.id}')" title="Editar" style="background-color: var(--accent-cyan); color: white;"><i class="fa-solid fa-pen-to-square"></i></button>
              <button class="btn-table-action delete-btn" onclick="app.deleteOTOrder('${ot.id}')" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
            ` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  };

  const openEditOTModal = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar órdenes de transporte.");
      return;
    }
    const ot = state.transportOrders.find(o => o.id === id);
    if (!ot) return;

    // Cambiar paneles activos
    document.getElementById("ot-list-view").classList.remove("active");
    document.getElementById("ot-form-view").classList.add("active");

    // Título de edición
    const formTitle = document.querySelector("#ot-form-view h2");
    if (formTitle) formTitle.innerText = "Editar Orden de Transporte (OT)";

    // Guardar ID en campo oculto
    document.getElementById("ot-id").value = ot.id;

    // Poblar clientes y seleccionar el correspondiente
    populateClientDropdowns();
    const clientSelect = document.getElementById("ot-client-select");
    const client = state.customers.find(c => c.name === ot.clientName || c.rut === ot.clientRut);
    if (client) {
      clientSelect.value = client.id;
    } else {
      clientSelect.value = "";
    }
    onOTClientSelectChange();

    // Campos de cabecera de la OT
    document.getElementById("ot-number-display").value = ot.otNumber;
    document.getElementById("ot-client-sucursal").value = ot.clientSucursal || "";
    document.getElementById("ot-client-vendedor").value = ot.clientVendedor || "";
    document.getElementById("ot-fecha-ocnv").value = ot.fechaOcNv;
    document.getElementById("ot-oc-number").value = ot.ocNumber || "";
    document.getElementById("ot-nv-number").value = ot.nvNumber || "";

    // Archivos adjuntos anteriores
    document.getElementById("ot-oc-file-name").innerText = ot.ocFileName || "Ningún archivo seleccionado";
    document.getElementById("ot-nv-file-name").innerText = ot.nvFileName || "Ningún archivo seleccionado";
    
    // Transportistas y patentes
    document.getElementById("ot-carrier").value = ot.carrier || "Retiro Cliente";
    onOTCarrierChange();
    document.getElementById("ot-carrier-rut").value = ot.carrierRut || "0";
    document.getElementById("ot-plate").value = ot.plate || "";
    document.getElementById("ot-dispatch-date").value = ot.date;
    document.getElementById("ot-observacion").value = ot.observacion || "";

    // Resetear archivos temporales con los datos actuales
    tempUploadedFiles = {
      oc: { name: ot.ocFileName || "", data: ot.ocFileData || "" },
      nv: { name: ot.nvFileName || "", data: ot.nvFileData || "" }
    };

    // Cargar los productos de la OT
    populateOTProductDatalist();
    const tbody = document.getElementById("ot-products-tbody");
    tbody.innerHTML = "";

    ot.items.forEach(p => {
      const rowId = generateUUID();
      const tr = document.createElement("tr");
      tr.id = `ot-row-${rowId}`;
      
      const item = state.stock.find(s => s.id === p.stockId);

      tr.innerHTML = `
        <td>
          <input type="text" list="ot-stock-options-list" class="row-ot-op-input" placeholder="Digita o selecciona OP..." onchange="app.onOTRowOPChange('${rowId}')" style="max-width:100%; width:100%;" value="${p.op} - ${item ? item.clientName : ot.clientName} [${p.warehouse}]" data-stock-id="${p.stockId}">
        </td>
        <td>
          <input type="text" class="row-ot-desc" readonly class="input-readonly" value="${p.description}">
        </td>
        <td>
          <input type="number" class="row-ot-und" min="1" value="${p.undMts}" oninput="app.validateOTRowStock('${rowId}')">
        </td>
        <td>
          <input type="number" class="row-ot-kilos" step="0.01" min="0.01" value="${p.kilos}" oninput="app.validateOTRowStock('${rowId}')">
        </td>
        <td>
          <div style="display: flex; gap: 4px; align-items: center;">
            <select class="row-ot-currency" style="width: 65px; padding: 4px 6px; font-size: 13px; height: 38px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); margin: 0;">
              <option value="CLP" ${p.currency === 'CLP' || !p.currency ? 'selected' : ''}>$</option>
              <option value="USD" ${p.currency === 'USD' ? 'selected' : ''}>US$</option>
            </select>
            <input type="number" class="row-ot-price" min="0" value="${p.price}" style="flex: 1; min-width: 60px; margin: 0;">
          </div>
        </td>
        <td class="text-center">
          <button type="button" class="btn-table-action delete-btn" onclick="app.removeOTProductRow('${rowId}')" title="Eliminar fila">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
      validateOTRowStock(rowId);
    });
  };

  const showNewOTForm = () => {
    document.getElementById("ot-list-view").classList.remove("active");
    document.getElementById("ot-form-view").classList.add("active");
    
    const formTitle = document.querySelector("#ot-form-view h2");
    if (formTitle) formTitle.innerText = "Emitir Orden de Transporte (OT)";
    document.getElementById("ot-id").value = "";

    document.getElementById("ot-generation-form").reset();
    document.getElementById("ot-dispatch-date").value = new Date().toISOString().split('T')[0];
    document.getElementById("ot-fecha-ocnv").value = new Date().toISOString().split('T')[0];
    document.getElementById("ot-number-display").value = getNextOTNumber();

    tempUploadedFiles = {
      oc: { name: "", data: "" },
      nv: { name: "", data: "" }
    };
    
    document.getElementById("ot-oc-file-name").innerText = "Ningún archivo seleccionado";
    document.getElementById("ot-nv-file-name").innerText = "Ningún archivo seleccionado";

    // Load clients dropdown
    populateClientDropdowns();
    populateOTProductDatalist();

    // Reset products list
    document.getElementById("ot-products-tbody").innerHTML = "";
    addOTProductRow();
  };

  const hideNewOTForm = () => {
    setupOTView();
  };

  const getNextOTNumber = () => {
    if (state.transportOrders.length === 0) return "OT-000000";
    const nums = state.transportOrders
      .map(o => parseInt(o.otNumber.replace("OT-", ""), 10))
      .filter(n => !isNaN(n));
    if (nums.length === 0) return "OT-000000";
    const max = Math.max(...nums);
    return "OT-" + String(max + 1).padStart(6, '0');
  };

  const onOTClientSelectChange = () => {
    const select = document.getElementById("ot-client-select");
    const clientId = select.value;
    
    const inputRut = document.getElementById("ot-client-rut");
    const inputSucursal = document.getElementById("ot-client-sucursal");
    const inputVendedor = document.getElementById("ot-client-vendedor");

    if (!clientId) {
      inputRut.value = "";
      inputSucursal.value = "";
      inputVendedor.value = "";
      return;
    }

    const client = state.customers.find(c => c.id === clientId);
    if (client) {
      inputRut.value = client.rut;
      inputSucursal.value = client.sucursal || "";
      inputVendedor.value = client.vendedor || "";
    }
  };

  const onOTCarrierChange = () => {
    const carrier = document.getElementById("ot-carrier").value;
    const rutInput = document.getElementById("ot-carrier-rut");
    
    const ruts = {
      "Retiro Cliente": "0",
      "Retiro Vendedor": "0",
      "Pablo Toro": "20.393.531-5",
      "Diego Lagos": "20.056.047-7",
      "Pedro Troncoso": "8.068.855-5",
      "Osvaldo Mediana": "9.449.354-4"
    };

    rutInput.value = ruts[carrier] || "0";
  };

  const onOTFileChange = (event, type) => {
    const file = event.target.files[0];
    const label = document.getElementById(`ot-${type}-file-name`);
    
    if (!file) {
      label.innerText = "Ningún archivo seleccionado";
      tempUploadedFiles[type] = { name: "", data: "" };
      return;
    }

    label.innerText = file.name;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      tempUploadedFiles[type] = {
        name: file.name,
        data: e.target.result
      };
    };
    reader.readAsDataURL(file);
  };

  const addOTProductRow = () => {
    const tbody = document.getElementById("ot-products-tbody");
    const tr = document.createElement("tr");
    const rowId = generateUUID();
    tr.id = `ot-row-${rowId}`;

    tr.innerHTML = `
      <td>
        <input type="text" list="ot-stock-options-list" class="row-ot-op-input" placeholder="Digita o selecciona OP..." onchange="app.onOTRowOPChange('${rowId}')" style="max-width:100%; width:100%;">
      </td>
      <td>
        <input type="text" class="row-ot-desc" readonly class="input-readonly">
      </td>
      <td>
        <input type="number" class="row-ot-und" min="1" value="1" oninput="app.validateOTRowStock('${rowId}')">
      </td>
      <td>
        <input type="number" class="row-ot-kilos" step="0.01" min="0.01" value="1" oninput="app.validateOTRowStock('${rowId}')">
      </td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center;">
          <select class="row-ot-currency" style="width: 65px; padding: 4px 6px; font-size: 13px; height: 38px; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); margin: 0;">
            <option value="CLP">$</option>
            <option value="USD">US$</option>
          </select>
          <input type="number" class="row-ot-price" min="0" value="0" style="flex: 1; min-width: 60px; margin: 0;">
        </div>
      </td>
      <td class="text-center">
        <button type="button" class="btn-table-action delete-btn" onclick="app.removeOTProductRow('${rowId}')" title="Eliminar fila">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  };

  const removeOTProductRow = (rowId) => {
    const tbody = document.getElementById("ot-products-tbody");
    const row = document.getElementById(`ot-row-${rowId}`);
    if (row) {
      tbody.removeChild(row);
      if (tbody.children.length === 0) {
        addOTProductRow();
      }
    }
  };

  const onOTRowOPChange = (rowId) => {
    const row = document.getElementById(`ot-row-${rowId}`);
    const opInput = row.querySelector(".row-ot-op-input");
    const descInput = row.querySelector(".row-ot-desc");
    const undInput = row.querySelector(".row-ot-und");
    const kilosInput = row.querySelector(".row-ot-kilos");
    const priceInput = row.querySelector(".row-ot-price");

    const value = opInput.value.trim();
    if (!value) {
      descInput.value = "";
      opInput.removeAttribute("data-stock-id");
      return;
    }

    const item = state.stock.find(s => 
      `${s.op} - ${s.clientName} [${s.warehouse}]` === value ||
      s.op.toUpperCase() === value.toUpperCase()
    );

    if (item) {
      descInput.value = item.description;
      
      let maxUnd = item.undMts;
      let maxKilos = item.kilos;
      const otId = document.getElementById("ot-id").value;
      if (otId) {
        const ot = state.transportOrders.find(o => o.id === otId);
        if (ot) {
          const originalItem = ot.items.find(pi => pi.stockId === item.id);
          if (originalItem) {
            maxUnd += originalItem.undMts;
            maxKilos += originalItem.kilos;
          }
        }
      }

      undInput.value = maxUnd;
      kilosInput.value = maxKilos;
      priceInput.value = 4500;
      
      opInput.setAttribute("data-stock-id", item.id);
      opInput.value = `${item.op} - ${item.clientName} [${item.warehouse}]`;
      
      validateOTRowStock(rowId);
    } else {
      opInput.removeAttribute("data-stock-id");
    }
  };

  const validateOTRowStock = (rowId) => {
    const row = document.getElementById(`ot-row-${rowId}`);
    const opInput = row.querySelector(".row-ot-op-input");
    const undInput = row.querySelector(".row-ot-und");
    const kilosInput = row.querySelector(".row-ot-kilos");

    const stockId = opInput ? opInput.getAttribute("data-stock-id") : null;
    if (stockId) {
      const item = state.stock.find(s => s.id === stockId);
      if (item) {
        let maxUnd = item.undMts;
        let maxKilos = item.kilos;

        const otId = document.getElementById("ot-id").value;
        if (otId) {
          const ot = state.transportOrders.find(o => o.id === otId);
          if (ot) {
            const originalItem = ot.items.find(pi => pi.stockId === stockId);
            if (originalItem) {
              maxUnd += originalItem.undMts;
              maxKilos += originalItem.kilos;
            }
          }
        }

        const enteredUnd = parseInt(undInput.value || 0, 10);
        const enteredKilos = parseFloat(kilosInput.value || 0);

        if (enteredUnd > maxUnd) {
          undInput.style.borderColor = "var(--accent-red)";
        } else {
          undInput.style.borderColor = "";
        }

        if (enteredKilos > maxKilos) {
          kilosInput.style.borderColor = "var(--accent-red)";
        } else {
          kilosInput.style.borderColor = "";
        }
      }
    }
  };

  const saveTransportOrder = (event) => {
    event.preventDefault();
    const id = document.getElementById("ot-id").value;
    const clientId = document.getElementById("ot-client-select").value;
    const otNumber = document.getElementById("ot-number-display").value;
    const clientRut = document.getElementById("ot-client-rut").value;
    const sucursal = document.getElementById("ot-client-sucursal").value.trim();
    const vendedor = document.getElementById("ot-client-vendedor").value;
    const fechaOcNv = document.getElementById("ot-fecha-ocnv").value;
    const ocNumber = document.getElementById("ot-oc-number").value.trim();
    const nvNumber = document.getElementById("ot-nv-number").value.trim();
    const carrier = document.getElementById("ot-carrier").value;
    const carrierRut = document.getElementById("ot-carrier-rut").value;
    const plate = document.getElementById("ot-plate").value;
    const date = document.getElementById("ot-dispatch-date").value;
    const observacion = document.getElementById("ot-observacion").value.trim();

    if (id && !isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden editar órdenes de transporte.");
      return;
    }

    if (!clientId) {
      alert("Por favor seleccione un cliente.");
      return;
    }

    const client = state.customers.find(c => c.id === clientId);
    if (!client) return;

    // Gather products rows
    const tbody = document.getElementById("ot-products-tbody");
    const rows = tbody.querySelectorAll("tr");
    const products = [];

    let stockError = false;
    let stockErrorMessage = "";

    // If editing, temporarily revert stock so that availability checks are accurate
    let existingOT = null;
    if (id) {
      existingOT = state.transportOrders.find(o => o.id === id);
      if (existingOT) {
        existingOT.items.forEach(p => {
          const stockItem = state.stock.find(s => s.id === p.stockId || (s.op === p.op && s.warehouse === p.warehouse));
          if (stockItem) {
            stockItem.undMts += p.undMts;
            stockItem.kilos += p.kilos;
          }
        });
      }
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const opInput = row.querySelector(".row-ot-op-input");
      const undInput = row.querySelector(".row-ot-und");
      const kilosInput = row.querySelector(".row-ot-kilos");
      const priceInput = row.querySelector(".row-ot-price");
      const currencySelect = row.querySelector(".row-ot-currency");

      const stockId = opInput ? opInput.getAttribute("data-stock-id") : null;
      if (!stockId) continue;

      const undMts = parseInt(undInput.value || 0, 10);
      const kilos = parseFloat(kilosInput.value || 0);
      const price = parseFloat(priceInput.value || 0);
      const currency = currencySelect ? currencySelect.value : "CLP";

      const stockItem = state.stock.find(s => s.id === stockId);
      if (stockItem) {
        if (stockItem.undMts < undMts || stockItem.kilos < kilos) {
          stockError = true;
          stockErrorMessage += `* OP: ${stockItem.op} (Disponible: ${stockItem.undMts}m / ${stockItem.kilos}kg - Requerido: ${undMts}m / ${kilos}kg)\n`;
        }

        products.push({
          stockId: stockItem.id,
          op: stockItem.op,
          description: stockItem.description,
          undMts: undMts,
          kilos: kilos,
          price: price,
          currency: currency,
          warehouse: stockItem.warehouse
        });
      }
    }

    // If validation fails, restore the stock we temporarily reverted
    if (products.length === 0 || (stockError && !confirm(`Stock insuficiente en el inventario de stock real:\n\n${stockErrorMessage}\n¿Desea forzar el despacho de todas formas (el stock quedará en 0 o negativo)?`))) {
      if (id && existingOT) {
        existingOT.items.forEach(p => {
          const stockItem = state.stock.find(s => s.id === p.stockId || (s.op === p.op && s.warehouse === p.warehouse));
          if (stockItem) {
            stockItem.undMts -= p.undMts;
            stockItem.kilos -= p.kilos;
          }
        });
      }
      if (products.length === 0) {
        alert("Debe agregar al menos un producto a despachar.");
      }
      return;
    }

    // Subtract from Stock & Create Log
    products.forEach(p => {
      const stockItem = state.stock.find(s => s.id === p.stockId);
      if (stockItem) {
        stockItem.undMts = Math.max(0, stockItem.undMts - p.undMts);
        stockItem.kilos = Math.max(0, stockItem.kilos - p.kilos);

        // Audit Log
        state.warehouseLog.push({
          id: generateUUID(),
          date: new Date().toISOString(),
          type: "ot_dispatch",
          op: p.op,
          clientName: client.name,
          warehouse: p.warehouse,
          undMts: -p.undMts,
          kilos: -p.kilos,
          reference: `OT N° ${otNumber} ${id ? 'Modificación' : 'Despacho'}`,
          user: state.currentUser ? state.currentUser.name : "Sistema"
        });
      }
    });

    if (id && existingOT) {
      existingOT.clientName = client.name;
      existingOT.clientRut = clientRut;
      existingOT.clientSucursal = sucursal;
      existingOT.clientVendedor = vendedor;
      existingOT.clientContacto = client.contacto || "Sin Contacto";
      existingOT.clientPhone = client.phone;
      existingOT.clientEmail = client.email;
      existingOT.fechaOcNv = fechaOcNv;
      existingOT.ocNumber = ocNumber;
      existingOT.nvNumber = nvNumber;
      if (tempUploadedFiles.oc.name) {
        existingOT.ocFileName = tempUploadedFiles.oc.name;
        existingOT.ocFileData = tempUploadedFiles.oc.data;
      }
      if (tempUploadedFiles.nv.name) {
        existingOT.nvFileName = tempUploadedFiles.nv.name;
        existingOT.nvFileData = tempUploadedFiles.nv.data;
      }
      existingOT.items = products;
      existingOT.carrier = carrier;
      existingOT.carrierRut = carrierRut;
      existingOT.plate = plate;
      existingOT.date = date;
      existingOT.observacion = observacion;
      existingOT.user = state.currentUser ? state.currentUser.name : "Sistema";

      saveToLocalStorage();
      alert(`Orden de Transporte N° ${otNumber} modificada y stock recalibrado.`);
      setupOTView();
      renderDashboard();
    } else {
      const newOT = {
        id: generateUUID(),
        otNumber,
        clientName: client.name,
        clientRut,
        clientSucursal: sucursal,
        clientVendedor: vendedor,
        clientContacto: client.contacto || "Sin Contacto",
        clientPhone: client.phone,
        clientEmail: client.email,
        fechaOcNv,
        ocNumber,
        nvNumber,
        ocFileName: tempUploadedFiles.oc.name || "Ninguno",
        ocFileData: tempUploadedFiles.oc.data || "",
        nvFileName: tempUploadedFiles.nv.name || "Ninguno",
        nvFileData: tempUploadedFiles.nv.data || "",
        items: products,
        carrier,
        carrierRut,
        plate,
        date,
        status: "Despachada",
        observacion,
        user: state.currentUser ? state.currentUser.name : "Sistema"
      };

      state.transportOrders.push(newOT);
      saveToLocalStorage();
      alert(`Orden de Transporte N° ${otNumber} generada y rebajada de stock.`);
      setupOTView();
      renderDashboard();
      openEmailModal(newOT.id);
    }
  };

  const deleteOTOrder = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden eliminar órdenes de transporte.");
      return;
    }
    const ot = state.transportOrders.find(o => o.id === id);
    if (!ot) return;

    const confirmDelete = confirm(`¿Desea eliminar la OT N° ${ot.otNumber}?\nNota: Esto no reintegrará el stock automáticamente.`);
    if (!confirmDelete) return;

    state.transportOrders = state.transportOrders.filter(o => o.id !== id);
    saveToLocalStorage();
    renderOTList();
    renderDashboard();
  };

  const changeOTStatus = (id) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden modificar el estado de una orden de transporte.");
      return;
    }
    const ot = state.transportOrders.find(o => o.id === id);
    if (!ot) return;

    const newStatus = prompt(`Cambiar estado de OT N° ${ot.otNumber}\n1. Emitida\n2. Despachada\n3. Entregado`, 
      ot.status === "Emitida" ? "1" : ot.status === "Despachada" ? "2" : "3");

    if (newStatus === "1") {
      ot.status = "Emitida";
    } else if (newStatus === "2") {
      ot.status = "Despachada";
    } else if (newStatus === "3") {
      ot.status = "Entregado";
    } else {
      return;
    }

    saveToLocalStorage();
    renderOTList();
    renderDashboard();
  };

  const openOTModal = (otId) => {
    const ot = state.transportOrders.find(o => o.id === otId);
    if (!ot) return;
    
    fillOTSheetData(ot);
    document.getElementById("modal-ot-print").classList.add("active");
  };

  const closeOTModal = () => {
    document.getElementById("modal-ot-print").classList.remove("active");
  };

  const fillOTSheetData = (ot) => {
    // Membrete
    document.getElementById("print-ot-company-name").innerText = state.profile.name;
    document.getElementById("print-ot-company-address").innerText = `${state.profile.address}, ${state.profile.city}`;
    document.getElementById("print-ot-company-rut").innerText = `R.U.T.: ${state.profile.rut}`;
    
    // Inject Logo
    const logoPlaceholder = document.getElementById("print-ot-logo-placeholder");
    logoPlaceholder.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 150" width="100%" height="100%">
        <text x="185" y="80" text-anchor="end" font-family="'Outfit', 'Arial', sans-serif" font-size="70" font-weight="700" fill="#1958a7" letter-spacing="-1">PLA</text>
        <g transform="translate(230, 65)">
          <path d="M -18,15 C -24,-15 -2,-48 32,-48 C 38,-48 28,-40 18,-33 C -4,-18 -14,2 -18,15 Z" fill="#1958a7" />
          <path d="M -10,10 C -15,-10 3,-32 23,-32 C 28,-32 19,-27 12,-21 C -2,-11 -6,0 -10,10 Z" fill="#2cb53b" />
          <g transform="rotate(180)">
            <path d="M -18,15 C -24,-15 -2,-48 32,-48 C 38,-48 28,-40 18,-33 C -4,-18 -14,2 -18,15 Z" fill="#1958a7" />
            <path d="M -10,10 C -15,-10 3,-32 23,-32 C 28,-32 19,-27 12,-21 C -2,-11 -6,0 -10,10 Z" fill="#2cb53b" />
          </g>
        </g>
        <text x="275" y="80" text-anchor="start" font-family="'Outfit', 'Arial', sans-serif" font-size="70" font-weight="700" fill="#1a1a1a" letter-spacing="-1">TEM</text>
        <line x1="18" y1="92" x2="185" y2="92" stroke="#1958a7" stroke-width="3" />
        <line x1="18" y1="110" x2="135" y2="110" stroke="#2cb53b" stroke-width="3.5" />
        <line x1="275" y1="92" x2="442" y2="92" stroke="#1958a7" stroke-width="3" />
        <line x1="325" y1="110" x2="442" y2="110" stroke="#2cb53b" stroke-width="3.5" />
        <text x="442" y="140" text-anchor="end" font-family="'Outfit', 'Arial', sans-serif" font-size="22" font-weight="700" fill="#1a1a1a" letter-spacing="0.5" text-decoration="underline">CHILE</text>
      </svg>
    `;

    document.getElementById("print-ot-number").innerText = ot.otNumber;
    document.getElementById("print-ot-date").innerText = formatDateString(ot.date);
    document.getElementById("print-ot-fecha-ocnv").innerText = formatDateString(ot.fechaOcNv);
    document.getElementById("print-ot-oc-number").innerText = ot.ocNumber || "N/A";
    document.getElementById("print-ot-nv-number").innerText = ot.nvNumber || "N/A";
    
    const otOcFileSpan = document.getElementById("print-ot-oc-file");
    if (ot.ocFileData) {
      otOcFileSpan.innerHTML = `<a href="${ot.ocFileData}" download="${ot.ocFileName}" style="color:var(--accent-purple); font-weight:600; text-decoration:underline;">${ot.ocFileName}</a>`;
    } else {
      otOcFileSpan.innerText = ot.ocFileName || "Ninguno";
    }

    const otNvFileSpan = document.getElementById("print-ot-nv-file");
    if (ot.nvFileData) {
      otNvFileSpan.innerHTML = `<a href="${ot.nvFileData}" download="${ot.nvFileName}" style="color:var(--accent-purple); font-weight:600; text-decoration:underline;">${ot.nvFileName}</a>`;
    } else {
      otNvFileSpan.innerText = ot.nvFileName || "Ninguno";
    }

    // Transport info
    document.getElementById("print-ot-carrier").innerText = ot.carrier;
    document.getElementById("print-ot-carrier-rut").innerText = ot.carrierRut;
    document.getElementById("print-ot-plate").innerText = ot.plate || "N/A";
    document.getElementById("print-ot-dispatch-date").innerText = formatDateString(ot.date);

    // Client info
    document.getElementById("print-ot-client-name").innerText = ot.clientName;
    document.getElementById("print-ot-client-rut").innerText = ot.clientRut;
    document.getElementById("print-ot-client-sucursal").innerText = ot.clientSucursal || "Casa Matriz";
    document.getElementById("print-ot-client-vendedor").innerText = ot.clientVendedor || "Sin Vendedor";
    document.getElementById("print-ot-client-contacto").innerText = ot.clientContacto || "Sin Contacto";
    document.getElementById("print-ot-client-phone").innerText = ot.clientPhone || "N/A";
    document.getElementById("print-ot-client-email").innerText = ot.clientEmail || "N/A";

    document.getElementById("print-ot-comments").innerText = ot.observacion || "Sin observaciones especiales.";

    // Items table in print
    const tbody = document.getElementById("print-ot-items-tbody");
    tbody.innerHTML = "";

    ot.items.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="text-center">${index + 1}</td>
        <td><b>${item.op}</b></td>
        <td>${item.description}</td>
        <td class="text-center"><b>${item.undMts}</b></td>
        <td class="text-center"><b>${item.kilos} kg</b></td>
        <td class="text-right">${item.currency === 'USD' ? 'US$ ' + Number(item.price || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : formatCurrency(item.price || 0)}</td>
        <td><span style="font-size:10px;">Bodega ${item.warehouse}</span></td>
      `;
      tbody.appendChild(tr);
    });

    const emptyRowsCount = Math.max(0, 4 - ot.items.length);
    for (let i = 0; i < emptyRowsCount; i++) {
      tbody.innerHTML += `
        <tr>
          <td class="text-center text-muted">-</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }
  };

  const printOTDirectly = (otId) => {
    const ot = state.transportOrders.find(o => o.id === otId);
    if (!ot) return;
    
    fillOTSheetData(ot);
    document.getElementById("modal-ot-print").classList.add("active");
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // --- 8. EMAIL NOTIFICATION CONTROLLER ---
  const openEmailModal = (otId) => {
    const ot = state.transportOrders.find(o => o.id === otId);
    if (!ot) return;

    document.getElementById("email-ot-id").value = ot.id;
    
    // Default subject prefilled
    document.getElementById("email-message-body").value = `Estimados\nJunto con saludar\nPor favor facturar lo solicitado en la Orden de Transporte ${ot.otNumber}.\n\nSaludos cordiales,\nLogística Plásticos Temuco\n(Contacto: logistica@plasticostemuco.cl)`;
    
    document.getElementById("modal-email-send").classList.add("active");
  };

  const openEmailModalFromPrint = () => {
    const otNumber = document.getElementById("print-ot-number").innerText;
    const ot = state.transportOrders.find(o => o.otNumber === otNumber);
    if (ot) {
      openEmailModal(ot.id);
    }
  };

  const closeEmailModal = () => {
    document.getElementById("modal-email-send").classList.remove("active");
  };

  const sendOTEmailMailto = (event) => {
    event.preventDefault();
    const otId = document.getElementById("email-ot-id").value;
    const ot = state.transportOrders.find(o => o.id === otId);
    if (!ot) return;

    const checkboxes = document.querySelectorAll('input[name="ot-emails"]:checked');
    const emails = Array.from(checkboxes).map(cb => cb.value);

    if (emails.length === 0) {
      alert("Por favor seleccione al menos un correo de la lista.");
      return;
    }

    const toEmails = emails.join(",");
    const subject = encodeURIComponent(`Facturación Orden de Transporte ${ot.otNumber} - ${ot.clientName}`);
    const body = encodeURIComponent(document.getElementById("email-message-body").value);

    // Open default mail client trying to specify sender
    window.location.href = `mailto:${toEmails}?subject=${subject}&body=${body}&from=logistica@plasticostemuco.cl`;
    
    closeEmailModal();
    alert("Redirigiendo a tu cliente de correo para enviar la solicitud de facturación.");
  };

  // --- 9. INFORMES CONTROLLER ---
  const renderReports = () => {
    // Valorización de inventario stock real
    let totalVal = 0;
    let indVal = 0;
    let agrVal = 0;

    state.stock.forEach(item => {
      const value = item.undMts * 5000; // mock value based on price
      totalVal += value;
      if (item.warehouse === "Industrial") {
        indVal += value;
      } else {
        agrVal += value;
      }
    });

    document.getElementById("report-total-valuation").innerText = formatCurrency(totalVal);
    document.getElementById("report-industrial-valuation").innerText = formatCurrency(indVal);
    document.getElementById("report-agricola-valuation").innerText = formatCurrency(agrVal);

    // Sales charts simulation
    const totalSales = state.notes.reduce((acc, note) => acc + note.netTotal, 0);
    let indSales = 0;
    let agrSales = 0;

    state.notes.forEach(note => {
      if (note.warehouse === "Industrial") {
        indSales += note.netTotal;
      } else {
        agrSales += note.netTotal;
      }
    });

    document.getElementById("sales-report-industrial").innerText = formatCurrency(indSales);
    document.getElementById("sales-report-agricola").innerText = formatCurrency(agrSales);
    document.getElementById("sales-report-total").innerText = formatCurrency(totalSales);

    const barInd = document.getElementById("bar-report-industrial");
    const barAgr = document.getElementById("bar-report-agricola");

    if (totalSales > 0) {
      barInd.style.width = `${(indSales / totalSales) * 100}%`;
      barAgr.style.width = `${(agrSales / totalSales) * 100}%`;
    } else {
      barInd.style.width = "0%";
      barAgr.style.width = "0%";
    }

    renderWarehouseLog();
  };

  const renderWarehouseLog = () => {
    const tbody = document.getElementById("reports-log-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const filterWarehouse = document.getElementById("filter-log-warehouse").value;
    const filterType = document.getElementById("filter-log-type").value;

    const filtered = state.warehouseLog.filter(log => {
      const matchW = filterWarehouse === "" || log.warehouse === filterWarehouse;
      const matchT = filterType === "" || log.type === filterType;
      return matchW && matchT;
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No se encontraron movimientos.</td></tr>';
      return;
    }

    filtered.forEach(log => {
      const tr = document.createElement("tr");
      
      let typeBadge = '';
      let qtyClass = '';

      if (log.type === "intake") {
        typeBadge = '<span class="badge badge-success">Ingreso Bodega</span>';
        qtyClass = 'text-emerald';
      } else if (log.type === "ot_dispatch") {
        typeBadge = '<span class="badge badge-info">Despacho OT</span>';
        qtyClass = 'text-danger';
      } else if (log.type === "adjustment") {
        typeBadge = '<span class="badge badge-warning">Ajuste Manual</span>';
        qtyClass = (log.undMts > 0) ? 'text-emerald' : 'text-danger';
      }

      let qtyText = "";
      if (log.undMts !== 0 || log.kilos !== 0) {
        qtyText = `<b>${log.undMts > 0 ? '+' : ''}${log.undMts} Und</b> / <b>${log.kilos > 0 ? '+' : ''}${log.kilos} kg</b>`;
      } else {
        qtyText = '<span class="text-muted">-</span>';
      }

      tr.innerHTML = `
        <td>${formatDateTime(log.date)}</td>
        <td>${typeBadge}</td>
        <td><b>${log.op}</b></td>
        <td><span class="badge ${log.warehouse === 'Industrial' ? 'badge-info' : 'badge-success'}">${log.warehouse}</span></td>
        <td class="text-center ${qtyClass}">${qtyText}</td>
        <td>${log.clientName || "-"}</td>
        <td><code>${log.user || "Sistema"}</code></td>
        <td><span class="text-muted" style="font-size:11px;">${log.reference}</span></td>
      `;
      tbody.appendChild(tr);
    });
  };

  // --- 9.5. USER PROFILE CONTROLLER ---
  const renderUserProfile = () => {
    if (!state.currentUser) return;
    
    const user = state.usersList.find(u => u.name === state.currentUser.name);
    if (!user) return;

    document.getElementById("profile-display-name").innerText = user.name;
    document.getElementById("profile-display-role").innerText = user.role;
    document.getElementById("profile-input-name").value = user.name;
    document.getElementById("profile-input-role").value = user.role;
    
    // Clear the password form fields
    document.getElementById("change-pwd-current").value = "";
    document.getElementById("change-pwd-new").value = "";
    document.getElementById("change-pwd-confirm").value = "";
  };

  const changeUserPassword = (event) => {
    event.preventDefault();
    if (!state.currentUser) return;

    const currentPwd = document.getElementById("change-pwd-current").value;
    const newPwd = document.getElementById("change-pwd-new").value;
    const confirmPwd = document.getElementById("change-pwd-confirm").value;

    const user = state.usersList.find(u => u.name === state.currentUser.name);
    if (!user) {
      alert("Error: Usuario no encontrado en la base de datos.");
      return;
    }

    if (user.password !== currentPwd) {
      alert("La contraseña actual es incorrecta.");
      return;
    }

    if (newPwd.length < 4) {
      alert("La nueva contraseña debe tener al menos 4 caracteres.");
      return;
    }

    if (newPwd !== confirmPwd) {
      alert("La nueva contraseña y la confirmación no coinciden.");
      return;
    }

    user.password = newPwd;
    saveToLocalStorage();

    alert("Contraseña actualizada con éxito.");
    
    document.getElementById("change-pwd-current").value = "";
    document.getElementById("change-pwd-new").value = "";
    document.getElementById("change-pwd-confirm").value = "";
  };

  // --- 10. SETTINGS CONTROLLER ---
  const setupCompanyProfileForm = () => {
    document.getElementById("company-name").value = state.profile.name;
    document.getElementById("company-rut").value = state.profile.rut;
    document.getElementById("company-phone").value = state.profile.phone;
    document.getElementById("company-email").value = state.profile.email;
    document.getElementById("company-address").value = state.profile.address;
    document.getElementById("company-city").value = state.profile.city;
  };

  const saveCompanyProfile = (event) => {
    event.preventDefault();
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden modificar la configuración de la empresa.");
      return;
    }
    state.profile = {
      name: document.getElementById("company-name").value.trim(),
      rut: document.getElementById("company-rut").value.trim(),
      phone: document.getElementById("company-phone").value.trim(),
      email: document.getElementById("company-email").value.trim(),
      address: document.getElementById("company-address").value.trim(),
      city: document.getElementById("company-city").value.trim()
    };
    saveToLocalStorage();
    alert("Membrete corporativo guardado exitosamente.");
  };

  const exportDatabase = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `plastem_erp_db_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const importDatabase = (event) => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden importar la base de datos.");
      event.target.value = "";
      return;
    }
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed && Array.isArray(parsed.stock) && Array.isArray(parsed.customers)) {
          state = parsed;
          saveToLocalStorage();
          alert("Base de datos cargada correctamente.");
          init();
          navigateTo('panel-dashboard');
        } else {
          alert("Formato JSON inválido. Estructura incompatible.");
        }
      } catch (err) {
        alert("Error al leer JSON.");
      }
    };
    reader.readAsText(file);
  };

  const loadDemoDatabase = () => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden cargar datos demo.");
      return;
    }
    const confirmDemo = confirm("¿Desea sobrescribir la base de datos con los datos demo del ERP?");
    if (!confirmDemo) return;
    loadSeeds();
    init();
    navigateTo('panel-dashboard');
    alert("Datos demo cargados con éxito.");
  };

  const clearDatabase = () => {
    if (!isAdmin()) {
      alert("Acceso denegado: Solo administradores pueden borrar la base de datos.");
      return;
    }
    const confirmClear = confirm("¿ATENCIÓN: Deseas borrar permanentemente todos los datos de este ERP?");
    if (!confirmClear) return;
    state.stock = [];
    state.customers = [];
    state.notes = [];
    state.transportOrders = [];
    state.warehouseLog = [];
    saveToLocalStorage();
    init();
    navigateTo('panel-dashboard');
    alert("Base de datos completamente vaciada.");
  };

  // --- PRINT INVOICE WIDGETS ---
  const openInvoiceModal = (noteId) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;

    fillInvoiceSheetData(note);
    document.getElementById("modal-invoice").classList.add("active");
  };

  const closeInvoiceModal = () => {
    document.getElementById("modal-invoice").classList.remove("active");
  };

  const fillInvoiceSheetData = (note) => {
    document.getElementById("print-company-name").innerText = state.profile.name;
    document.getElementById("print-company-address").innerText = `${state.profile.address}, ${state.profile.city}`;
    document.getElementById("print-company-phone").innerText = state.profile.phone;
    document.getElementById("print-company-email").innerText = state.profile.email;
    document.getElementById("print-company-rut").innerText = `R.U.T.: ${state.profile.rut}`;
    
    // Logo
    const logoPlaceholder = document.getElementById("print-logo-placeholder");
    logoPlaceholder.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 150" width="100%" height="100%">
        <text x="185" y="80" text-anchor="end" font-family="'Outfit', 'Arial', sans-serif" font-size="70" font-weight="700" fill="#1958a7" letter-spacing="-1">PLA</text>
        <g transform="translate(230, 65)">
          <path d="M -18,15 C -24,-15 -2,-48 32,-48 C 38,-48 28,-40 18,-33 C -4,-18 -14,2 -18,15 Z" fill="#1958a7" />
          <path d="M -10,10 C -15,-10 3,-32 23,-32 C 28,-32 19,-27 12,-21 C -2,-11 -6,0 -10,10 Z" fill="#2cb53b" />
          <g transform="rotate(180)">
            <path d="M -18,15 C -24,-15 -2,-48 32,-48 C 38,-48 28,-40 18,-33 C -4,-18 -14,2 -18,15 Z" fill="#1958a7" />
            <path d="M -10,10 C -15,-10 3,-32 23,-32 C 28,-32 19,-27 12,-21 C -2,-11 -6,0 -10,10 Z" fill="#2cb53b" />
          </g>
        </g>
        <text x="275" y="80" text-anchor="start" font-family="'Outfit', 'Arial', sans-serif" font-size="70" font-weight="700" fill="#1a1a1a" letter-spacing="-1">TEM</text>
        <line x1="18" y1="92" x2="185" y2="92" stroke="#1958a7" stroke-width="3" />
        <line x1="18" y1="110" x2="135" y2="110" stroke="#2cb53b" stroke-width="3.5" />
        <line x1="275" y1="92" x2="442" y2="92" stroke="#1958a7" stroke-width="3" />
        <line x1="325" y1="110" x2="442" y2="110" stroke="#2cb53b" stroke-width="3.5" />
        <text x="442" y="140" text-anchor="end" font-family="'Outfit', 'Arial', sans-serif" font-size="22" font-weight="700" fill="#1a1a1a" letter-spacing="0.5" text-decoration="underline">CHILE</text>
      </svg>
    `;

    document.getElementById("print-note-folio").innerText = note.folio;
    document.getElementById("print-note-date").innerText = formatDateString(note.date);
    
    document.getElementById("print-client-name").innerText = note.customerName;
    document.getElementById("print-client-rut").innerText = note.customerRut;
    document.getElementById("print-client-address").innerText = note.customerAddress;
    document.getElementById("print-client-city").innerText = note.customerCity;
    document.getElementById("print-client-phone").innerText = note.customerPhone;
    document.getElementById("print-client-email").innerText = note.customerEmail || "N/A";
    
    document.getElementById("print-note-payment").innerText = note.paymentMethod;
    document.getElementById("print-note-warehouse").innerText = `Bodega ${note.warehouse}`;
    document.getElementById("print-note-delivery").innerText = formatDateString(note.deliveryDate) || "No especificada";
    document.getElementById("print-note-comments").innerText = note.comments || "Mercadería sujeta a control de despacho.";

    // OC Fields mapping
    document.getElementById("print-note-oc-number").innerText = note.ocNumber || "N/A";
    const ocFileSpan = document.getElementById("print-note-oc-file");
    if (note.ocFileData) {
      ocFileSpan.innerHTML = `<a href="${note.ocFileData}" download="${note.ocFileName}" style="color:var(--accent-cyan); font-weight:600; text-decoration:underline;">${note.ocFileName}</a>`;
    } else {
      ocFileSpan.innerText = note.ocFileName || "Ninguno";
    }

    const barcodeContainer = document.querySelector(".barcode-text");
    if (barcodeContainer) barcodeContainer.innerText = `PT-NOTE-${note.folio}`;

    const itemsTbody = document.getElementById("print-items-tbody");
    itemsTbody.innerHTML = "";
    
    note.items.forEach((item, index) => {
      const tr = document.createElement("tr");
      const basisText = item.basis === "kilos" ? "Kilo" : "Und/Mts";
      tr.innerHTML = `
        <td class="text-center">${index + 1}</td>
        <td>${item.code}</td>
        <td>${item.name}</td>
        <td class="text-right">${formatCurrency(item.price)}</td>
        <td class="text-center">${basisText}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-center">${item.kilos || 0} kg</td>
        <td class="text-right">${formatCurrency(item.total)}</td>
      `;
      itemsTbody.appendChild(tr);
    });

    const emptyRowsCount = Math.max(0, 4 - note.items.length);
    for (let i = 0; i < emptyRowsCount; i++) {
      itemsTbody.innerHTML += `
        <tr>
          <td class="text-center text-muted">-</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `;
    }

    document.getElementById("print-subtotal").innerText = formatCurrency(note.subtotal);
    document.getElementById("print-discount-percentage").innerText = note.discountPercent;
    document.getElementById("print-discount").innerText = `-${formatCurrency(note.discountVal)}`;
    document.getElementById("print-net-total").innerText = formatCurrency(note.netTotal);
    document.getElementById("print-iva").innerText = formatCurrency(note.ivaVal);
    document.getElementById("print-total").innerText = formatCurrency(note.total);
  };

  const printInvoiceDirectly = (noteId) => {
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    
    fillInvoiceSheetData(note);
    document.getElementById("modal-invoice").classList.add("active");
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const printIntakeLabel = (logId) => {
    const log = state.warehouseLog.find(l => l.id === logId);
    if (!log) return;

    document.getElementById("print-label-barcode").innerText = `*${log.op}*`;
    document.getElementById("print-label-op-text").innerText = log.op;
    document.getElementById("print-label-desc").innerText = log.description || "Sin Descripción";
    document.getElementById("print-label-client").innerText = log.clientName || "Sin Cliente";
    document.getElementById("print-label-date").innerText = formatDateString(log.date.split('T')[0]);

    // Inject dynamic @page style for exact label dimensions
    let style = document.getElementById("label-print-size-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "label-print-size-style";
      document.head.appendChild(style);
    }
    style.innerHTML = `@page { size: 10cm 6.5cm; margin: 0; }`;

    document.getElementById("modal-label-print").classList.add("active");
    
    // Auto-trigger print
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const closeLabelModal = () => {
    document.getElementById("modal-label-print").classList.remove("active");
    // Remove dynamic label print size style so other printouts (invoices, OTs) default to letter size
    const style = document.getElementById("label-print-size-style");
    if (style) {
      style.remove();
    }
  };

  // --- RETURN OBJECT EXPOSURE ---
  return {
    init,
    navigateTo,
    toggleSidebar,
    
    // Customers
    renderCustomersList,
    openAddCustomerModal,
    openEditCustomerModal,
    closeCustomerModal,
    saveCustomer,
    deleteCustomer,
    importCustomersExcel,
    downloadCustomersTemplate,
    
    // User Session
    loginUser,
    logoutUser,
    setLoginMode,
    registerUser,
    
    // Notes
    renderNotesList,
    showNewNoteForm,
    hideNewNoteForm,
    onClientSelectChange,
    onNoteFileChange,
    addNoteItemRow,
    removeNoteItemRow,
    onRowProductDatalistChange,
    onRowQtyChange,
    onRowKilosChange,
    populateProductDropdowns,
    recalculateNoteTotals,
    saveSalesNote,
    deleteSalesNote,
    
    // Intakes
    setIntakeWarehouse,
    saveWarehouseIntake,
    openEditIntakeModal,
    deleteIntakeLog,
    
    // Stocks
    setStockWarehouseTab,
    renderStockList,
    exportStockToExcel,
    downloadStockTemplate,
    importStockExcel,
    
    // Adjustments
    saveInventoryAdjustment,
    
    // OTs (Transport Orders)
    showNewOTForm,
    hideNewOTForm,
    onOTClientSelectChange,
    onOTCarrierChange,
    onOTFileChange,
    addOTProductRow,
    removeOTProductRow,
    onOTRowOPChange,
    validateOTRowStock,
    saveTransportOrder,
    renderOTList,
    openOTModal,
    openEditOTModal,
    closeOTModal,
    deleteOTOrder,
    changeOTStatus,
    printOTDirectly,
    
    // Email Modals
    openEmailModal,
    closeEmailModal,
    openEmailModalFromPrint,
    sendOTEmailMailto,
    
    // Reports & Logs
    renderWarehouseLog,
    renderReports,
    exportValuationToExcel,
    exportSalesReportToExcel,
    exportMovementLogToExcel,
    
    // Print Views Invoice
    openInvoiceModal,
    closeInvoiceModal,
    printInvoiceDirectly,
    
    // Label Printing
    printIntakeLabel,
    closeLabelModal,
    
    // User Profile
    renderUserProfile,
    changeUserPassword,
    
    // Settings
    saveCompanyProfile,
    exportDatabase,
    importDatabase,
    loadDemoDatabase,
    clearDatabase
  };
  } catch (error) {
    console.error("ERP Script Evaluation Error:", error);
    alert("Error de Evaluación de Script (IIFE):\n\nMensaje: " + error.message + "\n\nStack:\n" + error.stack);
  }
})();

// DOM Load Init trigger
window.addEventListener("DOMContentLoaded", () => {
  try {
    if (app) app.init();
  } catch (error) {
    console.error("ERP Initialization Error:", error);
    alert("Error de Inicialización (Tiempo de Ejecución):\n\nMensaje: " + error.message + "\n\nStack:\n" + error.stack);
  }
});
