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
  currentStep: 1,
  pendingAction: null
};

function isAuthenticatedSession() {
  return sessionStorage.getItem("healthcare_session_auth") === "true";
}

function setAuthenticatedSession(isAuthenticated) {
  if (isAuthenticated) {
    sessionStorage.setItem("healthcare_session_auth", "true");
  } else {
    sessionStorage.removeItem("healthcare_session_auth");
  }
}

const uiTranslations = {
  "QUICK ROLE ACCESS (1-CLICK TEST):": "छिटो भूमिका पहुँच (एक क्लिक परीक्षण):",
  "Patient": "बिरामी",
  "Admin": "प्रशासन",
  "Nurse": "नर्स",
  "Doctor": "डाक्टर",
  "Therapist": "थेरापिस्ट",
  "Pharmacist": "फार्मासिस्ट",
  "Patient (John Doe)": "बिरामी (John Doe)",
  "Admin (Dr. Vance)": "प्रशासन (Dr. Vance)",
  "Nurse (Sarah, RN)": "नर्स (Sarah, RN)",
  "Doctor (Dr. Wilson)": "डाक्टर (Dr. Wilson)",
  "Therapist (Elena)": "थेरापिस्ट (Elena)",
  "Pharmacist (Chetna)": "फार्मासिस्ट (Chetna)",
  "Nurse (Rama)": "नर्स (राम)",
  "Nurse (Chetna)": "नर्स (चेतना)",
  "Doctor (Binod Thapa)": "डाक्टर (विनोद थापा)",
  "Doctor (Sunil)": "डाक्टर (सुनिल)",
  "Doctor (Sahil)": "डाक्टर (साहिल)",
  "Pharmacist": "फार्मासिस्ट",
  "ID/Password Login": "ID/पासवर्ड लगइन",
  "Login": "लगइन",
  "Logout": "लगआउट",
  "Nurse Dashboard": "नर्स ड्यासबोर्ड",
  "Doctor Dashboard": "डाक्टर ड्यासबोर्ड",
  "Therapist Dashboard": "थेरापिस्ट ड्यासबोर्ड",
  "Pharmacist Dashboard": "फार्मासिस्ट ड्यासबोर्ड",
  "Patient Dashboard": "बिरामी ड्यासबोर्ड",
  "Admin Command Center": "प्रशासनिक नियन्त्रण केन्द्र",
  "Nurse Dashboard Active": "नर्स ड्यासबोर्ड सक्रिय",
  "Home visits": "घर भ्रमण",
  "Check in and provide assigned bedside care.": "तोकिएको घरमै हेरचाह प्रदान गर्नुहोस्।",
  "Vitals & care": "vital र हेरचाह",
  "Record vital signs and nursing observations.": "vital संकेत र नर्सिङ अवलोकन लेख्नुहोस्।",
  "Care notes": "हेरचाह टिप्पणी",
  "Complete treatment notes for each visit.": "हरेक भ्रमणको उपचार विवरण पूरा गर्नुहोस्।",
  "Patient Details": "बिरामी विवरण",
  "Destination Address": "गन्तव्य ठेगाना",
  "Completed": "सम्पन्न",
  "PATIENT": "बिरामी",
  "NURSE": "नर्स",
  "DOCTOR": "डाक्टर",
  "THERAPIST": "थेरापिस्ट",
  "PHARMACIST": "फार्मासिस्ट",
  "ADMIN": "प्रशासन",
  "Language": "भाषा",
  "Home Service Healthcare Management System": "घर सेवा स्वास्थ्य व्यवस्थापन प्रणाली",
  "Home Healthcare Online Appointments with Expert Doctors": "घरमै स्वास्थ्य सेवा अनलाइन अपोइन्टमेन्ट विशेषज्ञ चिकित्सक",
  "Safe and Reliable Care": "सुरक्षित र भरपर्दो सेवा",
  "Home Healthcare Workflow Lifecycle (9 Steps)": "घरमै स्वास्थ्य सेवा प्रक्रिया (९ चरण)",
  "Phone:": "फोन:",
  "Email:": "इमेल:",
  "Navigation": "नेभिगेसन",
  "Click any step node to jump into action": "कार्य सुरु गर्न कुनै पनि चरण छान्नुहोस्",
  "1. Reg & Login": "१. दर्ता र लगइन",
  "2. Select Service": "२. सेवा छनोट",
  "3. Book & Docs": "३. बुकिङ र कागजात",
  "4. Admin Assign": "४. प्रशासनिक नियुक्ति",
  "5. Home Visit": "५. घर भ्रमण",
  "6. Records & Rx": "६. विवरण र औषधि",
  "7. Payment": "७. भुक्तानी",
  "8. View Records": "८. विवरण हेर्नुहोस्",
  "9. Feedback & Help": "९. प्रतिक्रिया र सहायता",
  "National Bedside": "घरमै राष्ट्रिय",
  "Healthcare At Home": "स्वास्थ्य सेवा",
  "Book Home Visit Now": "अहिले घर भ्रमण बुक गर्नुहोस्",
  "View My Health Records": "मेरो स्वास्थ्य विवरण हेर्नुहोस्",
  "Doctor Bedside Checkup": "डाक्टरको घरमै जाँच",
  "Auscultation: Heart Normal (72 bpm)": "जाँच: मुटुको अवस्था सामान्य (७२ bpm)",
  "Available Home Healthcare Services": "उपलब्ध घरमै स्वास्थ्य सेवाहरू",
  "Step 2: Choose a service below to book certified bedside medical assistance.": "चरण २: प्रमाणित स्वास्थ्य सहायता बुक गर्न तलको सेवा छान्नुहोस्।",
  "All Services": "सबै सेवाहरू",
  "Nursing Care": "नर्सिङ सेवा",
  "Elderly Care": "ज्येष्ठ नागरिक सेवा",
  "Physiotherapy": "फिजियोथेरापी",
  "Lab Diagnostic": "प्रयोगशाला जाँच",
  "Doctor Visit": "डाक्टर भ्रमण",
  "Patient Medical Vault & Timeline": "बिरामीको स्वास्थ्य विवरण र समयरेखा",
  "Step 8: View historical vitals, digital prescriptions, invoices, and diagnostic reports.": "चरण ८: पुराना vital विवरण, डिजिटल औषधि, बिल र जाँच रिपोर्ट हेर्नुहोस्।",
  "Book New Service": "नयाँ सेवा बुक गर्नुहोस्",
  "Vitals Health Trend Visualizer": "स्वास्थ्य vital प्रवृत्ति",
  "Pulse (bpm)": "नाडी (bpm)",
  "Blood Sugar (mg/dL)": "रक्तचिनी (mg/dL)",
  "Appointment & Visit History": "अपोइन्टमेन्ट र भ्रमण इतिहास",
  "Staff Dashboard": "कर्मचारी ड्यासबोर्ड",
  "Manage your assigned home visits and patient care tasks.": "तपाईंलाई तोकिएका घर भ्रमण र बिरामी हेरचाहका काम व्यवस्थापन गर्नुहोस्।",
  "Admin Dispatch & Resolution Command": "प्रशासनिक व्यवस्थापन केन्द्र",
  "Step 4: Match and assign verified healthcare professionals, track visits, and resolve patient complaints.": "चरण ४: प्रमाणित स्वास्थ्यकर्मी नियुक्त गर्नुहोस्, भ्रमण अनुगमन गर्नुहोस् र गुनासो समाधान गर्नुहोस्।",
  "Total Bookings": "जम्मा बुकिङ",
  "Pending Dispatch": "पठाउन बाँकी",
  "Completed Visits": "सम्पन्न भ्रमण",
  "Total Revenue": "जम्मा आम्दानी",
  "Open Issues": "खुला समस्या",
  "Live Appointment Requests & Assignments": "प्रत्यक्ष अपोइन्टमेन्ट अनुरोध र नियुक्ति",
  "Appt #": "अपोइन्टमेन्ट नं.",
  "Patient": "बिरामी",
  "Service & Time": "सेवा र समय",
  "Address": "ठेगाना",
  "Assigned Professional": "तोकिएको स्वास्थ्यकर्मी",
  "Status": "स्थिति",
  "Action": "कार्य",
  "Patient Issue Resolution & Dispute Center": "बिरामी समस्या समाधान केन्द्र",
  "National Healthcare Portal": "राष्ट्रिय स्वास्थ्य पोर्टल",
  "Sign in to your dedicated Patient, Staff, or Admin portal": "आफ्नो बिरामी, कर्मचारी वा प्रशासनिक पोर्टलमा लगइन गर्नुहोस्",
  "Sign In": "लगइन",
  "New Patient Registration": "नयाँ बिरामी दर्ता",
  "Nurse": "नर्स",
  "Doctor": "डाक्टर",
  "Therapist": "थेरापिस्ट",
  "Pharmacist": "फार्मासिस्ट",
  "Admin": "प्रशासन",
  "Email Address / Username *": "इमेल ठेगाना / प्रयोगकर्ता नाम *",
  "Password *": "पासवर्ड *",
  "Sign In to My Portal": "मेरो पोर्टलमा लगइन गर्नुहोस्",
  "Quick-Fill Credentials (Click to fill):": "छिटो भर्ने विवरण (भर्न क्लिक गर्नुहोस्):",
  "Full Name *": "पूरा नाम *",
  "Email Address *": "इमेल ठेगाना *",
  "Phone Number *": "फोन नम्बर *",
  "Age": "उमेर",
  "Gender": "लिङ्ग",
  "Blood Group": "रक्त समूह",
  "Account Role": "खाता भूमिका",
  "Healthcare Professional": "स्वास्थ्यकर्मी",
  "Home Address": "घरको ठेगाना",
  "Register Account & Sign In": "खाता दर्ता र लगइन",
  "Book Healthcare Appointment": "स्वास्थ्य अपोइन्टमेन्ट बुक गर्नुहोस्",
  "Preferred Date *": "रोजेको मिति *",
  "Preferred Time Slot *": "रोजेको समय *",
  "Home Visit Address *": "घर भ्रमण ठेगाना *",
  "Auto-Detect GPS": "GPS बाट ठेगाना पत्ता लगाउनुहोस्",
  "Medical Symptoms & Care Requirements": "स्वास्थ्य समस्या र हेरचाह आवश्यकता",
  "Emergency Contact Name": "आपतकालीन सम्पर्क नाम",
  "Emergency Contact Phone": "आपतकालीन सम्पर्क फोन",
  "Attach Previous Medical Documents / Prescription (Optional)": "अघिल्लो स्वास्थ्य कागजात / औषधि संलग्न गर्नुहोस् (वैकल्पिक)",
  "Submit Appointment Request (Step 3 Complete)": "अपोइन्टमेन्ट अनुरोध पठाउनुहोस् (चरण ३ पूरा)",
  "Assign Healthcare Professional": "स्वास्थ्यकर्मी नियुक्त गर्नुहोस्",
  "Select Verified Healthcare Provider": "प्रमाणित स्वास्थ्य सेवा प्रदायक छान्नुहोस्",
  "Confirm Staff Assignment & Notify Patient": "कर्मचारी नियुक्ति पुष्टि गरी बिरामीलाई जानकारी दिनुहोस्",
  "Healthcare Service Payment": "स्वास्थ्य सेवा भुक्तानी",
  "Total Payable": "तिर्नुपर्ने जम्मा",
  "Credit / Debit Card": "क्रेडिट / डेबिट कार्ड",
  "UPI & QR Code": "UPI र QR कोड",
  "Cash on Service": "सेवा लिँदा नगद",
  "Authorize & Complete Payment": "स्वीकृत गरी भुक्तानी पूरा गर्नुहोस्",
  "Feedback & Service Rating": "प्रतिक्रिया र सेवा मूल्याङ्कन",
  "Rate Attending Healthcare Professional": "सेवा दिने स्वास्थ्यकर्मीलाई मूल्याङ्कन गर्नुहोस्",
  "Service Highlights": "सेवाका विशेषता",
  "Written Comments / Experience Review": "लिखित टिप्पणी / अनुभव समीक्षा",
  "Yes, Satisfied": "हो, सन्तुष्ट छु",
  "No, Issue Faced": "होइन, समस्या भयो",
  "Submit Feedback & Resolution Decision": "प्रतिक्रिया र समाधान निर्णय पठाउनुहोस्",
  "Resolve Issue": "समस्या समाधान",
  "Resolution Status": "समाधान स्थिति",
  "Print / Download PDF": "प्रिन्ट / PDF डाउनलोड",
  "No services found.": "कुनै सेवा भेटिएन।",
  "No past health records or appointments found.": "पुराना स्वास्थ्य विवरण वा अपोइन्टमेन्ट भेटिएन।",
  "No visits assigned currently.": "हाल कुनै भ्रमण तोकिएको छैन।",
  "No appointments found.": "कुनै अपोइन्टमेन्ट भेटिएन।",
  "No unresolved issues. All patients satisfied!": "समाधान गर्नुपर्ने समस्या छैन। सबै बिरामी सन्तुष्ट छन्!"
};

const originalTextNodes = new WeakMap();

function localizePage(language = document.documentElement.lang === "ne" ? "ne" : "en") {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const text = element.dataset[language];
    if (text) element.textContent = text;
  });

  const translate = (value) => {
    const source = value.trim();
    if (!source) return value;
    if (language === "en") return source;
    const translated = uiTranslations[source];
    return translated || source;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest("script, style, [data-i18n]")) continue;
    if (!originalTextNodes.has(node)) originalTextNodes.set(node, node.nodeValue);
    const original = originalTextNodes.get(node);
    node.nodeValue = translate(original);
  }

  document.querySelectorAll("[placeholder], [title]").forEach((element) => {
    ["placeholder", "title"].forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      const key = `data-original-${attribute}`;
      if (!element.hasAttribute(key)) element.setAttribute(key, value);
      const original = element.getAttribute(key);
      element.setAttribute(attribute, language === "ne" ? uiTranslations[original] || original : original);
    });
  });
}

function translateRuntimeMessage(message) {
  if (document.documentElement.lang !== "ne") return message;
  return Object.entries(uiTranslations).reduce((translatedMessage, [english, nepali]) => {
    return translatedMessage.replaceAll(english, nepali);
  }, message);
}

// All monetary values in this system are displayed in Nepali rupees (NPR).
function formatNpr(amount) {
  return `रु ${Number(amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function setLanguage(language) {
  const selectedLanguage = language === "ne" ? "ne" : "en";
  document.documentElement.lang = selectedLanguage === "ne" ? "ne" : "en";
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const text = element.dataset[selectedLanguage];
    if (text) element.textContent = text;
  });
  document.querySelectorAll(".language-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.language === selectedLanguage);
  });
  localizePage(selectedLanguage);
  localStorage.setItem("preferredLanguage", selectedLanguage);
}

// ==========================================================================
// Toast Notification Engine
// ==========================================================================
function showToast(message, type = "success", duration = 4000) {
  message = translateRuntimeMessage(message);
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
  const hasFreshLogin = isAuthenticatedSession();
  const data = await apiRequest("/api/auth/me");

  if (data.success && data.user && hasFreshLogin) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    setAuthenticatedSession(true);
    setAppLockedState(false);
    updateUserHeaderUI();
    renderRoleSpecificViews();
  } else {
    AppState.currentUser = null;
    AppState.currentRole = "patient";
    setAuthenticatedSession(false);
    setAppLockedState(false);
    updateUserHeaderUI();
    renderRoleSpecificViews();
  }
}

function updateUserHeaderUI() {
  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");
  const avatarEl = document.getElementById("headerUserAvatar");
  const badgeSection = document.getElementById("userBadgeSection");
  const loginBtn = document.getElementById("headerLoginBtn");
  const logoutBtn = document.getElementById("headerLogoutBtn");

  if (AppState.currentUser) {
    if (nameEl) {
      const genericUserNames = { admin: "Admin", pharmacist: "Pharmacist" };
      nameEl.textContent = genericUserNames[AppState.currentUser.role] || AppState.currentUser.name;
    }
    if (roleEl) {
      let roleDisplay = AppState.currentUser.role.toUpperCase();
      if (AppState.currentUser.specialization) {
        roleDisplay = AppState.currentUser.specialization.split(' ')[0].toUpperCase();
      }
      roleEl.textContent = roleDisplay;
    }
    if (avatarEl) avatarEl.src = AppState.currentUser.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100";
    if (badgeSection) {
      badgeSection.style.display = "flex";
      if (AppState.currentUser.role === "patient") {
        badgeSection.title = "Click to view/edit My Patient Profile";
      } else if (AppState.currentUser.role === "admin") {
        badgeSection.title = "Admin Command Center - Click to view";
      } else {
        badgeSection.title = `${AppState.currentUser.name} (${AppState.currentUser.role.toUpperCase()}) - Click to view`;
      }
    }
    if (loginBtn) loginBtn.style.display = "none";
    const regBtn = document.getElementById("headerRegisterBtn");
    if (regBtn) regBtn.style.display = "none";
    const profileBtn = document.getElementById("headerProfileBtn");
    if (profileBtn) profileBtn.style.display = (AppState.currentUser.role === "patient") ? "inline-flex" : "none";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";

    // Populate Patient Identity Overview Card in My Health Vault (view-records)
    const cardName = document.getElementById("patientCardName");
    const cardId = document.getElementById("patientCardId");
    const cardEmail = document.getElementById("patientCardEmail");
    const cardPhone = document.getElementById("patientCardPhone");
    const cardBlood = document.getElementById("patientCardBlood");
    const cardAvatar = document.getElementById("patientCardAvatar");
    if (cardName) cardName.textContent = AppState.currentUser.name;
    if (cardId) cardId.textContent = `#PAT-${AppState.currentUser.id || 1}`;
    if (cardEmail) cardEmail.textContent = AppState.currentUser.email || "";
    if (cardPhone) cardPhone.textContent = AppState.currentUser.phone || "Not provided";
    if (cardBlood) cardBlood.textContent = AppState.currentUser.blood_group || "O+";
    if (cardAvatar && AppState.currentUser.avatar) cardAvatar.src = AppState.currentUser.avatar;
  } else {
    if (badgeSection) badgeSection.style.display = "none";
    if (loginBtn) loginBtn.style.display = "inline-flex";
    const regBtn = document.getElementById("headerRegisterBtn");
    if (regBtn) regBtn.style.display = "inline-flex";
    const profileBtn = document.getElementById("headerProfileBtn");
    if (profileBtn) profileBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
  }

  // Toggle patient-session CSS class so top demo role bar is completely hidden for patients
  document.body.classList.toggle("patient-session", Boolean(AppState.currentUser && AppState.currentUser.role === "patient"));

  // Update active chip state in top demo switcher
  document.querySelectorAll(".role-chip-btn").forEach(btn => {
    btn.classList.remove("active");
    if (AppState.currentUser && (btn.dataset.role === AppState.currentRole || (AppState.currentUser.email && AppState.currentUser.email.includes(btn.dataset.role)))) {
      btn.classList.add("active");
    }
  });
}

function handleUserBadgeClick() {
  if (!AppState.currentUser) {
    openLoginModal();
    return;
  }
  if (AppState.currentUser.role === "patient") {
    openPatientProfileModal();
  } else if (AppState.currentUser.role === "admin") {
    switchTab("admin");
    showToast("Active Portal: Admin Command & Healthcare Dispatch Center", "info");
  } else {
    switchTab("professional");
    showToast(`Active Portal: ${AppState.currentUser.name} (${AppState.currentUser.role.toUpperCase()})`, "info");
  }
}

function getStaffPortal(user) {
  const detail = `${user.email || ""} ${user.specialization || ""}`.toLowerCase();
  if (user.role === "pharmacist" || detail.includes("pharmac")) {
    return { key: "pharmacist", label: "Pharmacy Dashboard", icon: "fa-pills", accent: "#7c3aed", description: "Review prescriptions, medication instructions, and dispensing tasks.", cards: [["fa-pills", "Prescription queue", "Review prescribed medicines and dosage instructions."], ["fa-box-open", "Dispensing", "Prepare medicines for approved home-care visits."], ["fa-comments", "Medication support", "Share safe-use guidance with patients."]] };
  }
  if (detail.includes("therap") || detail.includes("physio") || detail.includes("rehabilitation")) {
    return { key: "therapist", label: "Therapy Dashboard", icon: "fa-person-walking", accent: "#2563eb", description: "Manage rehabilitation sessions, mobility plans, and progress notes.", cards: [["fa-calendar-check", "Therapy sessions", "View your scheduled home therapy visits."], ["fa-person-walking", "Care plans", "Record exercises and functional progress."], ["fa-chart-line", "Recovery tracking", "Keep each patient's therapy goals on course."]] };
  }
  if (detail.includes("doctor") || detail.includes("physician") || detail.includes("consultant") || detail.includes("mbbs")) {
    return { key: "doctor", label: "Doctor Dashboard", icon: "fa-user-doctor", accent: "#0f766e", description: "Manage home consultations, diagnoses, prescriptions, and follow-up care.", cards: [["fa-stethoscope", "Consultations", "View your assigned home consultations."], ["fa-file-prescription", "Clinical decisions", "Document diagnoses and digital prescriptions."], ["fa-calendar-plus", "Follow-ups", "Plan safe and timely follow-up care."]] };
  }
  return { key: "nurse", label: "Nurse Dashboard", icon: "fa-user-nurse", accent: "#059669", description: "Manage assigned visits, bedside vitals, nursing care, and clinical notes.", cards: [["fa-house-medical", "Home visits", "Check in and provide assigned bedside care."], ["fa-heart-pulse", "Vitals & care", "Record vital signs and nursing observations."], ["fa-clipboard-check", "Care notes", "Complete treatment notes for each visit."]] };
}

function renderStaffDashboard(user) {
  const portal = getStaffPortal(user);
  const navLabel = document.getElementById("staffNavLabel");
  const title = document.getElementById("staffDashboardTitle");
  const description = document.getElementById("staffDashboardDescription");
  const intro = document.getElementById("staffDashboardIntro");
  if (navLabel) navLabel.textContent = portal.label;
  if (title) title.innerHTML = `<i class="fa-solid ${portal.icon}" style="color:${portal.accent};"></i> ${portal.label}`;
  if (description) description.textContent = portal.description;
  if (intro) intro.innerHTML = portal.cards.map(([icon, heading, text]) => `<article class="staff-workflow-card"><h4><i class="fa-solid ${icon}"></i>${heading}</h4><p>${text}</p></article>`).join("");
  return portal;
}

function renderRoleSpecificViews() {
  const navServices = document.getElementById("navBtnServices");
  const navDoctors = document.getElementById("navBtnDoctors");
  const navReviews = document.getElementById("navBtnReviews");
  const navRecords = document.getElementById("navBtnRecords");
  const navProfessional = document.getElementById("navBtnProfessional");
  const navAdmin = document.getElementById("navBtnAdmin");
  const heroSection = document.getElementById("heroSection");
  const roleBanner = document.getElementById("roleBanner");
  const demoBar = document.querySelector(".demo-role-bar");

  if (!AppState.currentUser) {
    // Guest Exploration Mode: All discovery tabs are accessible
    document.body.classList.remove("patient-session");
    if (demoBar) demoBar.style.display = "flex";
    if (navServices) navServices.style.display = "inline-flex";
    if (navDoctors) navDoctors.style.display = "inline-flex";
    if (navReviews) navReviews.style.display = "inline-flex";
    if (navRecords) navRecords.style.display = "inline-flex";
    if (navProfessional) navProfessional.style.display = "inline-flex";
    if (navAdmin) navAdmin.style.display = "inline-flex";
    if (heroSection) heroSection.style.display = "block";
    if (roleBanner) roleBanner.innerHTML = "";
    return;
  }

  const role = AppState.currentUser.role;

  if (role === "admin") {
    // ADMIN SECTION ONLY
    document.body.classList.remove("patient-session");
    if (demoBar) demoBar.style.display = "flex";
    if (navServices) navServices.style.display = "inline-flex";
    if (navDoctors) navDoctors.style.display = "inline-flex";
    if (navReviews) navReviews.style.display = "inline-flex";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "inline-flex";
    if (heroSection) heroSection.style.display = "none";
    
    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); color: white; padding: 1rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #38bdf8;">
          <div>
            <div style="font-size:0.75rem; color:#38bdf8; font-weight:700; text-transform:uppercase;">Admin Portal Active</div>
            <h3 style="margin:0; font-size:1.2rem; font-weight:800;">Command & Healthcare Dispatch Center</h3>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-assigned" style="font-size:0.8rem;"><i class="fa-solid fa-shield-halved"></i> Admin</span>
          </div>
        </div>
      `;
    }
    switchTab("admin");

  } else if (role === "professional" || role === "pharmacist") {
    // Dedicated staff portals: nurse, doctor, therapist, or pharmacist.
    document.body.classList.remove("patient-session");
    if (demoBar) demoBar.style.display = "flex";
    const portal = renderStaffDashboard(AppState.currentUser);
    if (navServices) navServices.style.display = "none";
    if (navDoctors) navDoctors.style.display = "none";
    if (navReviews) navReviews.style.display = "none";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "inline-flex";
    if (navAdmin) navAdmin.style.display = "none";
    if (heroSection) heroSection.style.display = "none";

    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); color: white; padding: 1rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #10b981;">
          <div>
            <div style="font-size:0.75rem; color:#34d399; font-weight:700; text-transform:uppercase;">${portal.label} Active</div>
            <h3 style="margin:0; font-size:1.2rem; font-weight:800;">${portal.label}</h3>
            <div style="font-size:0.8rem; color:#cbd5e1;">${AppState.currentUser.specialization || 'Registered Healthcare Professional'}</div>
          </div>
          <div style="text-align:right;">
            <span class="badge badge-completed" style="font-size:0.8rem;"><i class="fa-solid fa-star" style="color:#f59e0b;"></i> ${portal.label}</span>
          </div>
        </div>
      `;
    }
    switchTab("professional");

  } else {
    // PATIENT SECTION ONLY: Strict isolation so patients only access their own profile
    document.body.classList.add("patient-session");
    const demoBar = document.querySelector(".demo-role-bar");
    if (demoBar) demoBar.style.display = "none";

    if (navServices) navServices.style.display = "inline-flex";
    if (navDoctors) navDoctors.style.display = "inline-flex";
    if (navReviews) navReviews.style.display = "inline-flex";
    if (navRecords) navRecords.style.display = "inline-flex";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "none";
    if (heroSection) heroSection.style.display = "block";

    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #065f46 0%, #1e293b 100%); color: white; padding: 0.85rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #10b981; flex-wrap:wrap; gap:0.75rem;">
          <div>
            <div style="font-size:0.7rem; color:#34d399; font-weight:700; text-transform:uppercase;">Personal Patient Portal Active</div>
            <h4 style="margin:0; font-size:1.05rem; font-weight:800;">Namaste, ${AppState.currentUser.name}</h4>
          </div>
          <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; font-size:0.8rem; color:#cbd5e1;">
            <span>Blood Group: <strong style="color:#34d399;">${AppState.currentUser.blood_group || 'O+'}</strong> | Phone: ${AppState.currentUser.phone || 'N/A'}</span>
            <button class="btn btn-primary btn-sm" onclick="openPatientProfileModal()"><i class="fa-solid fa-id-card"></i> My Profile</button>
            <button class="btn btn-secondary btn-sm" onclick="openChangePasswordModal()"><i class="fa-solid fa-user-lock"></i> Change Password</button>
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
function setAppLockedState(isLocked) {
  const topBar = document.querySelector(".demo-role-bar");
  if (topBar) {
    if (isLocked || (AppState.currentUser && AppState.currentUser.role === "patient")) {
      topBar.style.display = "none";
    } else {
      topBar.style.display = "";
    }
  }
  document.body.classList.toggle("app-locked", isLocked);
}

function requireAuth(actionCallback, intentMessage, targetRole = "patient") {
  if (AppState.currentUser) {
    if (typeof actionCallback === "function") {
      actionCallback();
    }
    return true;
  }
  AppState.pendingAction = actionCallback;
  openLoginModal(
    intentMessage || "Please sign in or create an account to access this healthcare feature. Your action will resume automatically.",
    targetRole
  );
  return false;
}

function handlePostAuthRedirect(user) {
  if (AppState.pendingAction) {
    const action = AppState.pendingAction;
    AppState.pendingAction = null;
    try {
      action();
      return;
    } catch (e) {
      console.warn("Post-auth action execution error:", e);
    }
  }

  // Default role dashboard redirection
  if (user.role === "admin") {
    switchTab("admin");
  } else if (user.role === "professional" || user.role === "pharmacist") {
    switchTab("professional");
  } else {
    switchTab("services");
  }
}

function openLoginModal(intentMessage, targetRole) {
  switchAuthTab('login');
  const roleToSelect = targetRole || (AppState.currentUser ? AppState.currentUser.role : 'patient');
  if (typeof selectRolePortal === "function") {
    selectRolePortal(roleToSelect);
  }

  const gateBanner = document.getElementById("authGateNoticeBanner");
  const gateTitle = document.getElementById("authGateNoticeTitle");
  const gateText = document.getElementById("authGateNoticeText");
  if (gateBanner) {
    if (intentMessage) {
      gateBanner.style.display = "flex";
      if (gateTitle) gateTitle.textContent = "Action Requires Sign In";
      if (gateText) gateText.textContent = intentMessage;
    } else {
      gateBanner.style.display = "none";
    }
  }

  // Clear password input to avoid phantom or demo password clashes
  const passInput = document.getElementById("loginPassword");
  if (passInput) passInput.value = "";

  // Pre-fill email with last patient email if field is empty
  const emailInput = document.getElementById("loginEmail");
  if (emailInput && !emailInput.value) {
    const lastEmail = localStorage.getItem("hc_last_patient_email") || "";
    if (lastEmail) emailInput.value = lastEmail;
  }

  openModal("authModal");
}

function openRegisterModal(intentMessage) {
  openLoginModal(intentMessage, 'patient');
  switchAuthTab('register');
}

function openForgotPasswordModal() {
  closeModal("authModal");
  openModal("forgotPasswordModal");
}

function openChangePasswordModal() {
  openModal("changePasswordModal");
}

function openPatientProfileModal() {
  if (!AppState.currentUser) {
    openLoginModal();
    return;
  }
  const nameEl = document.getElementById("profileName");
  const emailEl = document.getElementById("profileEmail");
  const phoneEl = document.getElementById("profilePhone");
  const ageEl = document.getElementById("profileAge");
  const genderEl = document.getElementById("profileGender");
  const bloodEl = document.getElementById("profileBloodGroup");
  const addrEl = document.getElementById("profileAddress");
  const idEl = document.getElementById("profileUserIdDisplay");

  if (nameEl) nameEl.value = AppState.currentUser.name || "";
  if (emailEl) emailEl.value = AppState.currentUser.email || "";
  if (phoneEl) phoneEl.value = AppState.currentUser.phone || "";
  if (ageEl) ageEl.value = AppState.currentUser.age || "";
  if (genderEl) genderEl.value = AppState.currentUser.gender || "Other";
  if (bloodEl) bloodEl.value = AppState.currentUser.blood_group || "O+";
  if (addrEl) addrEl.value = AppState.currentUser.address || "";
  if (idEl) idEl.textContent = `#PAT-${AppState.currentUser.id}`;

  openModal("patientProfileModal");
}

async function handlePatientProfileSubmit(event) {
  event.preventDefault();
  const name = document.getElementById("profileName").value.trim();
  const phone = document.getElementById("profilePhone").value.trim();
  const age = parseInt(document.getElementById("profileAge").value) || null;
  const gender = document.getElementById("profileGender").value;
  const bloodGroup = document.getElementById("profileBloodGroup").value;
  const address = document.getElementById("profileAddress").value.trim();

  if (!name) {
    showToast("Full Name is required.", "warning");
    return;
  }

  const res = await apiRequest("/api/patient/profile", "POST", {
    name, phone, age, gender, blood_group: bloodGroup, address
  });

  if (res.success && res.user) {
    AppState.currentUser = res.user;
    updateUserHeaderUI();
    renderRoleSpecificViews();
    closeModal("patientProfileModal");
    showToast("Your profile has been updated successfully!", "success");
  } else {
    showToast(res.message || "Failed to update profile.", "error");
  }
}

function fillLoginCredentials(email, password) {
  document.getElementById("loginEmail").value = email;
  document.getElementById("loginPassword").value = password;
  showToast(`Credentials filled for ${email}. Click 'Sign In' or hit Enter!`, "info");
}

function selectRolePortal(role) {
  document.querySelectorAll(".role-login-card").forEach(card => {
    card.classList.toggle("active", card.dataset.loginRole === role);
  });

  const staffPinGroup = document.getElementById("staffPinGroup");
  const staffPinInput = document.getElementById("loginStaffPin");
  const submitBtn = document.getElementById("loginSubmitBtn");

  if (role === "patient") {
    if (staffPinGroup) staffPinGroup.style.display = "none";
    if (staffPinInput) staffPinInput.value = "";
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In to Patient Portal';
  } else {
    if (staffPinGroup) staffPinGroup.style.display = "block";
    if (staffPinInput) staffPinInput.value = "";
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-user-shield"></i> Verify PIN & Sign In to ${roleLabel} Portal`;
  }
}

function selectRoleLogin(role, email, password) {
  selectRolePortal(role);
  if (email !== undefined && password !== undefined) {
    fillLoginCredentials(email, password);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const staffPin = (document.getElementById("loginStaffPin")?.value || "").trim();

  if (!email || !password) {
    showToast("Please enter both ID/Email and Password.", "warning");
    return;
  }

  showToast("Verifying credentials...", "info", 1500);

  let data = await apiRequest("/api/auth/login", "POST", { email, password, staff_pin: staffPin });

  // Resilient Recovery: If server reports account not found (e.g., fresh serverless container on Vercel),
  // check locally registered patient profiles and restore them automatically!
  if (!data.success && data.message && (data.message.includes("Account not found") || data.message.includes("not found"))) {
    const localPatients = (typeof getLocalRegisteredPatients === "function") ? getLocalRegisteredPatients() : [];
    const emailLower = email.toLowerCase();
    const matched = localPatients.find(p => (p.email || "").toLowerCase() === emailLower || (p.phone && p.phone === email));
    if (matched) {
      const syncRes = await apiRequest("/api/auth/sync-patient", "POST", {
        ...matched,
        password: password
      });
      if (syncRes && syncRes.success) {
        // Retry login with newly synchronized account
        data = await apiRequest("/api/auth/login", "POST", { email, password, staff_pin: staffPin });
      }
    }
  }

  if (data.success) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    if (data.user.role === "patient" && data.user.email) {
      localStorage.setItem("hc_last_patient_email", data.user.email.toLowerCase());
    }
    setAuthenticatedSession(true);
    setAppLockedState(false);
    showToast(`Welcome, ${data.user.name}! Access granted to ${data.user.role.toUpperCase()} section.`, "success");
    closeModal("authModal");
    updateUserHeaderUI();
    renderRoleSpecificViews();
    if (typeof loadServices === "function") loadServices();
    if (typeof loadAppointments === "function") loadAppointments();
    if (typeof loadPatientRecords === "function") loadPatientRecords();
    updateWorkflowStepper(2);
    handlePostAuthRedirect(data.user);
  } else {
    setAuthenticatedSession(false);
    showToast(data.message || "Invalid Email or Password.", "error");
  }
}

function togglePasswordVisibility(inputId, toggleButton) {
  const passwordInput = document.getElementById(inputId);
  const icon = toggleButton.querySelector("i");
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";
  toggleButton.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
  toggleButton.setAttribute("title", isHidden ? "Hide password" : "Show password");
  icon.classList.toggle("fa-eye", !isHidden);
  icon.classList.toggle("fa-eye-slash", isHidden);
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
  const role = "patient";

  if (!name || !email || !password) {
    showToast("Please fill in Name, Email, and Password.", "warning");
    return;
  }
  if (password.length < 6) {
    showToast("Password must be at least 6 characters with letters and numbers.", "warning");
    return;
  }

  const payload = {
    name, email, password, phone, age, gender, blood_group: bloodGroup, address, role: "patient"
  };

  const data = await apiRequest("/api/auth/register", "POST", payload);
  if (data.success) {
    if (typeof saveLocalRegisteredPatient === "function") {
      saveLocalRegisteredPatient(payload);
    }
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    setAuthenticatedSession(true);
    setAppLockedState(false);
    showToast(`Registration successful! Logged in as ${data.user.name}.`, "success");
    closeModal("authModal");

    // Pre-populate login form with newly registered email so it's ready upon logout
    const loginEmailInput = document.getElementById("loginEmail");
    const loginPassInput = document.getElementById("loginPassword");
    if (loginEmailInput) loginEmailInput.value = email;
    if (loginPassInput) loginPassInput.value = "";

    updateUserHeaderUI();
    renderRoleSpecificViews();
    if (typeof loadServices === "function") loadServices();
    if (typeof loadAppointments === "function") loadAppointments();
    if (typeof loadPatientRecords === "function") loadPatientRecords();
    updateWorkflowStepper(2);
    handlePostAuthRedirect(data.user);
  } else {
    setAuthenticatedSession(false);
    showToast(data.message || "Registration failed.", "error");
  }
}

async function handleForgotPasswordSubmit(event) {
  event.preventDefault();
  const identifier = document.getElementById("forgotPasswordIdentifier").value.trim();
  const data = await apiRequest("/api/auth/forgot-password", "POST", { identifier });
  if (data.success) {
    showToast(data.message || "Verification code sent.", "success");
    document.getElementById("forgotPasswordOtp").value = data.otp || "";
  } else {
    showToast(data.message || "Unable to send verification code.", "error");
  }
}

async function handleResetPasswordSubmit(event) {
  event.preventDefault();
  const identifier = document.getElementById("forgotPasswordIdentifier").value.trim();
  const otp = document.getElementById("forgotPasswordOtp").value.trim();
  const newPassword = document.getElementById("forgotPasswordNew").value.trim();
  const confirmPassword = document.getElementById("forgotPasswordConfirm").value.trim();

  const data = await apiRequest("/api/auth/reset-password", "POST", {
    identifier,
    otp,
    new_password: newPassword,
    confirm_password: confirmPassword
  });
  if (data.success) {
    try {
      const localPatients = (typeof getLocalRegisteredPatients === "function") ? getLocalRegisteredPatients() : [];
      const idLower = identifier.toLowerCase();
      const p = localPatients.find(item => item.email.toLowerCase() === idLower || item.phone === identifier);
      if (p) {
        p.password = newPassword;
        localStorage.setItem("hc_registered_patients", JSON.stringify(localPatients));
      }
    } catch (e) {}
    showToast(data.message || "Password reset successful.", "success");
    closeModal("forgotPasswordModal");
    openLoginModal();
  } else {
    showToast(data.message || "Password reset failed.", "error");
  }
}

async function handleChangePasswordSubmit(event) {
  event.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value.trim();
  const newPassword = document.getElementById("newPassword").value.trim();
  const confirmPassword = document.getElementById("confirmPassword").value.trim();

  const data = await apiRequest("/api/auth/change-password", "POST", {
    current_password: currentPassword,
    new_password: newPassword,
    confirm_password: confirmPassword
  });
  if (data.success) {
    try {
      if (AppState.currentUser && AppState.currentUser.email) {
        const localPatients = (typeof getLocalRegisteredPatients === "function") ? getLocalRegisteredPatients() : [];
        const userEmail = AppState.currentUser.email.toLowerCase();
        const p = localPatients.find(item => item.email.toLowerCase() === userEmail);
        if (p) {
          p.password = newPassword;
          localStorage.setItem("hc_registered_patients", JSON.stringify(localPatients));
        }
      }
    } catch (e) {}
    showToast(data.message || "Password updated successfully.", "success");
    closeModal("changePasswordModal");
    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("confirmPassword").value = "";
  } else {
    showToast(data.message || "Password change failed.", "error");
  }
}

async function logoutUser() {
  const lastPatientEmail = (AppState.currentUser && AppState.currentUser.role === 'patient' && AppState.currentUser.email)
    ? AppState.currentUser.email
    : (localStorage.getItem("hc_last_patient_email") || "");

  await apiRequest("/api/auth/logout", "POST");
  AppState.currentUser = null;
  AppState.currentRole = "patient";
  setAuthenticatedSession(false);
  setAppLockedState(false);
  showToast("Logged out successfully. You are now exploring in Guest Mode.", "info");
  updateUserHeaderUI();
  renderRoleSpecificViews();
  switchTab("services");

  if (lastPatientEmail) {
    const emailInput = document.getElementById("loginEmail");
    if (emailInput) emailInput.value = lastPatientEmail;
    const passInput = document.getElementById("loginPassword");
    if (passInput) passInput.value = "";
  }
}

async function switchDemoRole(role) {
  // 1. Strict Isolation: If currently logged in as a patient, block switching to ANY staff or admin profile
  if (AppState.currentUser && AppState.currentUser.role === "patient") {
    if (role !== "patient") {
      showToast("Access Denied: Logged-in patients cannot view or access Doctor, Nurse, or Admin profiles.", "error");
      return;
    }
  }

  // 2. If target is a staff/admin role, require existing staff authentication or prompt PIN login
  if (role !== "patient") {
    const isStaffOrAdmin = AppState.currentUser && (AppState.currentUser.role === "admin" || AppState.currentUser.role === "professional" || AppState.currentUser.role === "pharmacist");
    if (!isStaffOrAdmin) {
      showToast("Hospital Clearance Required: Access to Doctor, Nurse, or Admin profiles requires credentials and Authorization PIN.", "warning");
      const cleanRole = role.startsWith("doctor") ? "doctor" : (role.startsWith("nurse") ? "nurse" : role);
      selectRoleLogin(cleanRole, "", "");
      openLoginModal();
      return;
    }
  }

  // 3. For authorized staff/admin:
  const data = await apiRequest("/api/auth/demo-switch", "POST", { role });
  if (data.success) {
    AppState.currentUser = data.user;
    AppState.currentRole = data.user.role;
    setAppLockedState(false);
    showToast(`Switched account to: ${data.user.name} (${data.user.role.toUpperCase()} Section)`, "info");
    updateUserHeaderUI();
    renderRoleSpecificViews();
    if (typeof loadAppointments === "function") loadAppointments();
    if (typeof loadServices === "function") loadServices();
  } else {
    showToast(data.message || "Role switch restricted.", "warning");
  }
}

// ==========================================================================
// Navigation & Tab Switching
// ==========================================================================
function switchTab(tabName) {
  // Public tabs: Doctors and Reviews showcase sections
  if (tabName === "doctors") {
    const svcView = document.getElementById("view-services");
    if (svcView) {
      document.querySelectorAll(".dashboard-view").forEach(v => v.classList.remove("active-view"));
      svcView.classList.add("active-view");
    }
    const docSec = document.getElementById("doctorsShowcaseSection");
    if (docSec) {
      docSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "doctors");
    });
    return;
  }

  if (tabName === "reviews") {
    const svcView = document.getElementById("view-services");
    if (svcView) {
      document.querySelectorAll(".dashboard-view").forEach(v => v.classList.remove("active-view"));
      svcView.classList.add("active-view");
    }
    const revSec = document.getElementById("reviewsShowcaseSection");
    if (revSec) {
      revSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "reviews");
    });
    return;
  }

  // Protected Actions: require authentication for private/staff sections
  if (!AppState.currentUser) {
    if (tabName === "records") {
      requireAuth(() => switchTab("records"), "Please sign in or register to access your personal Health Vault, medical records, and vitals history.", "patient");
      return;
    }
    if (tabName === "professional") {
      requireAuth(() => switchTab("professional"), "Healthcare Staff clearance required. Please sign in with staff credentials and Hospital PIN.", "doctor");
      return;
    }
    if (tabName === "admin") {
      requireAuth(() => switchTab("admin"), "Administrative clearance required. Please sign in with administrator credentials and Security PIN.", "admin");
      return;
    }
  }

  // Strict Isolation: Patients cannot view staff or admin tabs
  if (AppState.currentUser && AppState.currentUser.role === "patient" && (tabName === "admin" || tabName === "professional")) {
    showToast("Access Denied: Patient accounts cannot access healthcare staff or admin portals.", "warning");
    tabName = "services";
  }

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

// Public Showcase Fetch & Render Handlers
async function loadPublicDoctors() {
  const container = document.getElementById("publicDoctorsGridContainer");
  if (!container) return;

  const data = await apiRequest("/api/public/doctors");
  if (data.success && data.doctors && data.doctors.length > 0) {
    container.innerHTML = data.doctors.map(doc => `
      <div class="doctor-card animate-fade-in">
        <div class="doctor-card-header">
          <img src="${doc.avatar || 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=160'}" alt="${doc.name}" class="doctor-avatar">
          <div class="doctor-info-head">
            <h4>${doc.name}</h4>
            <div class="doctor-spec">${doc.specialization || 'Clinical Specialist'}</div>
          </div>
        </div>
        <div class="doctor-meta-row">
          <span><i class="fa-solid fa-user-graduate" style="color:var(--primary);"></i> ${doc.qualification || 'MBBS, MD'}</span>
          <span class="doctor-rating"><i class="fa-solid fa-star"></i> ${doc.rating || 5.0}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.75rem;">
          <i class="fa-solid fa-briefcase-medical"></i> ${doc.experience_years || 8}+ Years Clinical Experience
        </div>
        <div class="doctor-card-footer">
          <button class="btn btn-outline btn-sm" style="width:100%; font-weight:700;" onclick="bookDoctorConsultation(${doc.id}, '${doc.name}')">
            <i class="fa-solid fa-calendar-check"></i> Book Consultation
          </button>
        </div>
      </div>
    `).join("");
  } else {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:var(--text-muted);">Specialist directory available during appointment dispatch.</div>`;
  }
}

async function loadPublicReviews() {
  const container = document.getElementById("publicReviewsGridContainer");
  if (!container) return;

  const data = await apiRequest("/api/public/reviews");
  if (data.success && data.reviews && data.reviews.length > 0) {
    container.innerHTML = data.reviews.map(rev => {
      const stars = Array(Math.min(5, Math.max(1, rev.rating || 5))).fill('<i class="fa-solid fa-star"></i>').join("");
      return `
        <div class="review-card animate-fade-in">
          <div class="review-stars">${stars}</div>
          <p class="review-quote">"${rev.comments || 'Professional and compassionate home healthcare visit.'}"</p>
          <div style="font-size:0.75rem; color:var(--primary-dark); font-weight:600; margin-bottom:0.5rem;">
            <i class="fa-solid fa-stethoscope"></i> Attending: ${rev.doctor_name || 'Healthcare Professional'}
          </div>
          <div class="review-patient-meta">
            <span class="review-patient-name">
              <i class="fa-solid fa-circle-check" style="color:#059669;"></i> ${rev.patient_display_name || 'Verified Patient'}
            </span>
            <span class="review-service-tag">${rev.service_title || 'Home Visit'}</span>
          </div>
        </div>
      `;
    }).join("");
  } else {
    container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:1.5rem; color:var(--text-muted);">Verified clinical feedback will appear here.</div>`;
  }
}

function bookDoctorConsultation(doctorId, doctorName) {
  const docSvc = (AppState.services && AppState.services.find(s => s.title.toLowerCase().includes("doctor") || s.category.toLowerCase().includes("doctor"))) || (AppState.services && AppState.services[0]);
  const svcId = docSvc ? docSvc.id : 1;

  if (!AppState.currentUser) {
    requireAuth(
      () => {
        if (typeof openBookingModal === "function") openBookingModal(svcId);
      },
      `Please sign in or register to schedule a home consultation with ${doctorName}. Your appointment booking will open immediately.`,
      "patient"
    );
    return;
  }
  if (typeof openBookingModal === "function") {
    openBookingModal(svcId);
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
      if (AppState.currentUser) {
        showToast(`Already logged in as ${AppState.currentUser.name} (${AppState.currentUser.role.toUpperCase()}).`, "info");
      } else {
        openLoginModal();
      }
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
      if (AppState.currentUser && AppState.currentUser.role === "patient") {
        showToast("Step 4 (Provider Dispatch) is handled by administrators. Clinicians will be assigned to your visit.", "info");
      } else if (AppState.currentRole !== "admin") {
        showToast("Step 4 requires Admin login to assign professionals.", "info");
      } else {
        switchTab("admin");
      }
      break;
    case 5:
    case 6:
      if (AppState.currentUser && AppState.currentUser.role === "patient") {
        showToast("Steps 5 & 6 (Bedside Examination & Care) are conducted in person by your assigned clinician.", "info");
      } else if (AppState.currentRole !== "professional") {
        showToast("Steps 5 & 6 are conducted by Healthcare Staff.", "info");
      } else {
        switchTab("professional");
      }
      break;
    case 7:
    case 8:
      switchTab("records");
      break;
    case 9:
      switchTab("records");
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
  if (AppState.currentUser) {
    setAppLockedState(false);
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
  setLanguage(localStorage.getItem("preferredLanguage") || "en");
  
  const localizationObserver = new MutationObserver(() => {
    localizationObserver.disconnect();
    localizePage();
    localizationObserver.observe(document.body, { childList: true, subtree: true });
  });
  localizationObserver.observe(document.body, { childList: true, subtree: true });

  if (!isAuthenticatedSession()) {
    // Guest Exploration Mode: open, friendly landing experience
    AppState.currentUser = null;
    AppState.currentRole = "patient";
    setAppLockedState(false);
    updateUserHeaderUI();
    renderRoleSpecificViews();
  } else {
    await fetchCurrentUser();
  }

  // Always load public catalog, verified doctors, and authentic patient reviews
  if (typeof loadServices === "function") await loadServices();
  if (typeof loadPublicDoctors === "function") await loadPublicDoctors();
  if (typeof loadPublicReviews === "function") await loadPublicReviews();

  updateWorkflowStepper(AppState.currentUser ? 2 : 1);
});

// ==========================================================================
// Fail-safe State Synchronization Helpers (Ensures cross-role consistency)
// ==========================================================================
function getLocalBookings() {
  try {
    return JSON.parse(localStorage.getItem("hc_local_bookings") || "[]");
  } catch (e) {
    return [];
  }
}

function saveLocalBooking(appData) {
  try {
    const list = getLocalBookings();
    // Filter out if same appointment_number already exists
    const filtered = list.filter(item => item.appointment_number !== appData.appointment_number && item.id !== appData.id);
    filtered.unshift(appData);
    localStorage.setItem("hc_local_bookings", JSON.stringify(filtered));
  } catch (e) {
    console.error("Local booking save failed", e);
  }
}

function updateLocalBooking(bookingUpdates) {
  try {
    const list = getLocalBookings();
    let found = false;
    const updatedList = list.map(item => {
      const matchId = bookingUpdates.id && item.id && (String(item.id) === String(bookingUpdates.id));
      const matchNum = bookingUpdates.appointment_number && item.appointment_number && (item.appointment_number === bookingUpdates.appointment_number);
      if (matchId || matchNum) {
        found = true;
        return { ...item, ...bookingUpdates };
      }
      return item;
    });

    if (!found && (bookingUpdates.id || bookingUpdates.appointment_number)) {
      updatedList.unshift(bookingUpdates);
    }

    localStorage.setItem("hc_local_bookings", JSON.stringify(updatedList));

    // Also trigger background sync to backend
    try {
      fetch("/api/appointments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointments: updatedList })
      }).catch(e => console.warn("Background sync error:", e));
    } catch (e) {}

    return true;
  } catch (e) {
    console.error("updateLocalBooking failed", e);
    return false;
  }
}

window.getLocalBookings = getLocalBookings;
window.saveLocalBooking = saveLocalBooking;
window.updateLocalBooking = updateLocalBooking;

window.loadAppointments = async function() {
  if (typeof loadAdminAppointments === "function") await loadAdminAppointments();
  if (typeof loadPatientRecords === "function") await loadPatientRecords();
  if (typeof loadProfessionalDashboard === "function") await loadProfessionalDashboard();
};

function getLocalRegisteredPatients() {
  try {
    return JSON.parse(localStorage.getItem("hc_registered_patients") || "[]");
  } catch (e) {
    return [];
  }
}

function saveLocalRegisteredPatient(patientData) {
  try {
    const list = getLocalRegisteredPatients();
    const emailLower = (patientData.email || "").trim().toLowerCase();
    const filtered = list.filter(p => (p.email || "").toLowerCase() !== emailLower);
    filtered.unshift({
      name: patientData.name || "",
      email: emailLower,
      password: patientData.password || "",
      phone: patientData.phone || "",
      age: patientData.age || null,
      gender: patientData.gender || "Other",
      blood_group: patientData.blood_group || "",
      address: patientData.address || "",
      role: "patient",
      registered_at: new Date().toISOString()
    });
    localStorage.setItem("hc_registered_patients", JSON.stringify(filtered.slice(0, 30)));
    localStorage.setItem("hc_last_patient_email", emailLower);
  } catch (e) {
    console.warn("Could not save local registered patient:", e);
  }
}
