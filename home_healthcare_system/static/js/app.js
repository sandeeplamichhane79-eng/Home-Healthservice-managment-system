/**
 * Home Healthcare Management System - Core Application JS
 * Handles Authentication, Role-based Sections, Workflow Stepper, and Notifications
 */

const AppState = {
  currentUser: null,
  currentRole: "patient", // patient | admin | professional
  activeTab: "services",  // services | records | admin | professional
  services: [],
  appointments: [],
  selectedAppointment: null,
  currentStep: 1
};

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = "success", duration = 4000) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let icon = "fa-check-circle";
  if (type === "error") icon = "fa-exclamation-circle";
  if (type === "warning") icon = "fa-triangle-exclamation";
  if (type === "info") icon = "fa-circle-info";

  toast.innerHTML = `
    <i class="fa-solid ${icon}" style="font-size: 1.25rem;"></i>
    <div style="flex:1;">
      <div style="font-weight:600; font-size:0.875rem;">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" style="color:#94a3b8; font-size:0.9rem;"><i class="fa-solid fa-xmark"></i></button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ==========================================================================
// API Helper
// ==========================================================================
async function apiRequest(endpoint, method = "GET", body = null) {
  try {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json"
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    showToast(`Network or Server error: ${error.message}`, "error");
    return { success: false, message: error.message };
  }
}

// ==========================================================================
// Authentication & Role-Based Section Routing
// ==========================================================================
async function fetchCurrentUser() {
  const data = await apiRequest("/api/auth/me");
  if (data.success && data.user) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    updateUserHeaderUI();
    renderRoleSpecificViews();
  } else {
    // If not logged in, open login modal
    openLoginModal();
  }
}

function updateUserHeaderUI() {
  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");
  const avatarEl = document.getElementById("headerUserAvatar");
  const badgeSection = document.getElementById("userBadgeSection");

  if (AppState.currentUser) {
    if (nameEl) nameEl.textContent = AppState.currentUser.name;
    if (roleEl) {
      let roleDisplay = AppState.currentUser.role.toUpperCase();
      if (AppState.currentUser.specialization) {
        roleDisplay = AppState.currentUser.specialization.split(' ')[0].toUpperCase();
      }
      roleEl.textContent = roleDisplay;
    }
    if (avatarEl) avatarEl.src = AppState.currentUser.avatar || "/static/images/nepal_emblem_logo.png";
    if (badgeSection) badgeSection.style.display = "flex";
  }

  // Update active chip state in top demo switcher
  document.querySelectorAll(".role-chip-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.role === AppState.currentRole || (AppState.currentUser && AppState.currentUser.email.includes(btn.dataset.role))) {
      btn.classList.add("active");
    }
  });
}

function renderRoleSpecificViews() {
  const navServices = document.getElementById("navBtnServices");
  const navRecords = document.getElementById("navBtnRecords");
  const navProfessional = document.getElementById("navBtnProfessional");
  const navAdmin = document.getElementById("navBtnAdmin");
  const heroSection = document.getElementById("heroSection");
  const roleBanner = document.getElementById("roleBanner");

  if (!AppState.currentUser) {
    if (navServices) navServices.style.display = "flex";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "none";
    switchTab("services");
    return;
  }

  const role = AppState.currentUser.role;

  if (role === "admin") {
    // ADMIN SECTION ONLY
    if (navServices) navServices.style.display = "flex";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "flex";
    if (heroSection) heroSection.style.display = "none";
    
    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 1rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #38bdf8;">
          <div style="display:flex; align-items:center; gap:1rem;">
            <img src="/static/images/nepal_emblem_logo.png" style="height:44px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <div>
              <div style="font-size:0.75rem; color:#38bdf8; font-weight:700; text-transform:uppercase;">Admin Portal Active</div>
              <h3 style="margin:0; font-size:1.2rem; font-weight:800;">Command & Healthcare Dispatch Center</h3>
            </div>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-assigned" style="font-size:0.8rem;"><i class="fa-solid fa-shield-halved"></i> Administrator: ${AppState.currentUser.name}</span>
          </div>
        </div>
      `;
    }
    switchTab("admin");

  } else if (role === "professional") {
    // HEALTHCARE PROFESSIONAL SECTION ONLY (Doctor / Nurse / Physiotherapist / Lab Tech)
    if (navServices) navServices.style.display = "none";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "flex";
    if (navAdmin) navAdmin.style.display = "none";
    if (heroSection) heroSection.style.display = "none";

    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); color: white; padding: 1rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #10b981;">
          <div style="display:flex; align-items:center; gap:1rem;">
            <img src="/static/images/nepal_emblem_logo.png" style="height:44px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <div>
              <div style="font-size:0.75rem; color:#34d399; font-weight:700; text-transform:uppercase;">Clinician Portal Active</div>
              <h3 style="margin:0; font-size:1.2rem; font-weight:800;">${AppState.currentUser.name}</h3>
              <div style="font-size:0.8rem; color:#cbd5e1;">${AppState.currentUser.specialization || 'Registered Healthcare Professional'} (${AppState.currentUser.qualification || 'Certified'})</div>
            </div>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-completed" style="font-size:0.8rem;"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> Rating: ${AppState.currentUser.rating || 4.9}</span>
          </div>
        </div>
      `;
    }
    switchTab("professional");

  } else {
    // PATIENT SECTION ONLY
    if (navServices) navServices.style.display = "flex";
    if (navRecords) navRecords.style.display = "flex";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "none";
    if (heroSection) heroSection.style.display = "block";

    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #065f46 0%, #1e293b 100%); color: white; padding: 0.85rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #10b981;">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <img src="/static/images/nepal_emblem_logo.png" style="height:38px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            <div>
              <div style="font-size:0.7rem; color:#34d399; font-weight:700; text-transform:uppercase;">Patient Portal Active</div>
              <h4 style="margin:0; font-size:1.05rem; font-weight:800;">Namaste, ${AppState.currentUser.name}</h4>
            </div>
          </div>
          <div style="font-size:0.8rem; color:#cbd5e1;">
            Blood Group: <strong style="color:#34d399;">${AppState.currentUser.blood_group || 'O+'}</strong> | Phone: ${AppState.currentUser.phone || 'N/A'}
          </div>
        </div>
      `;
    }
    switchTab("services");
  }
}

// ==========================================================================
// Login, Register & Logout Handlers
// ==========================================================================
function openLoginModal() {
  openModal("authModal");
}

function fillLoginCredentials(email, password) {
  document.getElementById("loginEmail").value = email;
  document.getElementById("loginPassword").value = password;
  showToast(`Credentials filled for ${email}. Click 'Sign In' or hit Enter!`, "info");
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showToast("Please enter both ID/Email and Password.", "warning");
    return;
  }

  showToast("Verifying credentials...", "info", 1500);

  const data = await apiRequest("/api/auth/login", "POST", { email, password });
  if (data.success) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    showToast(`Welcome, ${data.user.name}! Access granted to ${data.user.role.toUpperCase()} section.`, "success");
    closeModal("authModal");
    updateUserHeaderUI();
    renderRoleSpecificViews();
    if (typeof loadAppointments === "function") loadAppointments();
  } else {
    showToast(data.message || "Invalid Email or Password.", "error");
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim().toLowerCase();
  const password = document.getElementById("regPassword").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const age = parseInt(document.getElementById("regAge").value) || 30;
  const gender = document.getElementById("regGender").value;
  const bloodGroup = document.getElementById("regBloodGroup").value;
  const address = document.getElementById("regAddress").value.trim();
  const role = document.getElementById("regRole").value;

  if (!name || !email || !password) {
    showToast("Please fill in Name, Email, and Password.", "warning");
    return;
  }

  const payload = {
    name, email, password, phone, age, gender, blood_group: bloodGroup, address, role
  };

  const data = await apiRequest("/api/auth/register", "POST", payload);
  if (data.success) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    showToast(`Registration successful! Logged in as ${data.user.name}.`, "success");
    closeModal("authModal");
    updateUserHeaderUI();
    renderRoleSpecificViews();
  } else {
    showToast(data.message || "Registration failed.", "error");
  }
}

async function logoutUser() {
  await apiRequest("/api/auth/logout", "POST");
  AppState.currentUser = null;
  AppState.currentRole = "patient";
  showToast("Logged out successfully.", "info");
  updateUserHeaderUI();
  openLoginModal();
}

async function switchDemoRole(role) {
  const data = await apiRequest("/api/auth/demo-switch", "POST", { role });
  if (data.success) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    showToast(`Switched account to: ${data.user.name} (${data.user.role.toUpperCase()} Section)`, "info");
    updateUserHeaderUI();
    renderRoleSpecificViews();
    if (typeof loadAppointments === "function") loadAppointments();
  }
}

// ==========================================================================
// Navigation & Tab Switching
// ==========================================================================
function switchTab(tabName) {
  AppState.activeTab = tabName;
  
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
    if (btn.dataset.tab === tabName) btn.classList.add("active");
  });

  document.querySelectorAll(".dashboard-view").forEach(view => {
    view.classList.remove("active-view");
  });

  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.classList.add("active-view");
    targetView.classList.add("animate-fade-in");
  }

  if (tabName === "records" && typeof loadPatientRecords === "function") {
    loadPatientRecords();
  } else if (tabName === "admin" && typeof loadAdminDashboard === "function") {
    loadAdminDashboard();
  } else if (tabName === "professional" && typeof loadProfessionalDashboard === "function") {
    loadProfessionalDashboard();
  } else if (tabName === "services" && typeof loadServices === "function") {
    loadServices();
  }
}

// ==========================================================================
// 9-Step Interactive Workflow Stepper Controller
// ==========================================================================
function updateWorkflowStepper(stepNumber) {
  AppState.currentStep = stepNumber;
  const progressLine = document.getElementById("stepProgressBar");
  const nodes = document.querySelectorAll(".step-node");

  nodes.forEach(node => {
    const step = parseInt(node.dataset.step);
    node.classList.remove("completed", "active");
    if (step < stepNumber) {
      node.classList.add("completed");
    } else if (step === stepNumber) {
      node.classList.add("active");
    }
  });

  if (progressLine) {
    const percentage = ((stepNumber - 1) / 8) * 100;
    progressLine.style.width = `${percentage}%`;
  }
}

function onStepperClick(stepNumber) {
  updateWorkflowStepper(stepNumber);
  switch (stepNumber) {
    case 1:
      openLoginModal();
      break;
    case 2:
      switchTab("services");
      break;
    case 3:
      if (AppState.services.length > 0) {
        openBookingModal(AppState.services[0].id);
      } else {
        switchTab("services");
      }
      break;
    case 4:
      if (AppState.currentRole !== "admin") {
        showToast("Step 4 requires Admin login to assign professionals. Switching to Admin...", "info");
        switchDemoRole("admin");
      } else {
        switchTab("admin");
      }
      break;
    case 5:
    case 6:
      if (AppState.currentRole !== "professional") {
        showToast("Step 5 & 6 requires Healthcare Professional login. Switching to Nurse Sarah...", "info");
        switchDemoRole("nurse");
      } else {
        switchTab("professional");
      }
      break;
    case 7:
    case 8:
      if (AppState.currentRole !== "patient") {
        showToast("Viewing records and making payment requires Patient login. Switching to Patient...", "info");
        switchDemoRole("patient");
      } else {
        switchTab("records");
      }
      break;
    case 9:
      if (AppState.currentRole !== "patient") {
        showToast("Submitting feedback and issue tickets is done from Patient account.", "info");
        switchDemoRole("patient");
      } else {
        switchTab("records");
      }
      break;
  }
}

// ==========================================================================
// Modal Helpers
// ==========================================================================
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("open");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("open");
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("loginFormSection");
  const regForm = document.getElementById("registerFormSection");
  const tabLogin = document.getElementById("authTabLogin");
  const tabReg = document.getElementById("authTabRegister");

  if (tab === "login") {
    loginForm.style.display = "block";
    regForm.style.display = "none";
    tabLogin.classList.add("active");
    tabReg.classList.remove("active");
  } else {
    loginForm.style.display = "none";
    regForm.style.display = "block";
    tabLogin.classList.remove("active");
    tabReg.classList.add("active");
  }
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    e.target.classList.remove("open");
  }
});

// App Initialization
document.addEventListener("DOMContentLoaded", async () => {
  await fetchCurrentUser();
  if (typeof loadServices === "function") await loadServices();
  updateWorkflowStepper(2);
});
