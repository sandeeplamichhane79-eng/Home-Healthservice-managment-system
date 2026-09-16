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
    const portal = renderStaffDashboard(AppState.currentUser);
    if (navServices) navServices.style.display = "none";
    if (navRecords) navRecords.style.display = "none";
    if (navProfessional) navProfessional.style.display = "flex";
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
    // PATIENT SECTION ONLY
    if (navServices) navServices.style.display = "flex";
    if (navRecords) navRecords.style.display = "flex";
    if (navProfessional) navProfessional.style.display = "none";
    if (navAdmin) navAdmin.style.display = "none";
    if (heroSection) heroSection.style.display = "block";

    if (roleBanner) {
      roleBanner.innerHTML = `
        <div style="background: linear-gradient(135deg, #065f46 0%, #1e293b 100%); color: white; padding: 0.85rem 1.5rem; border-radius: var(--radius-lg); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; border-left: 5px solid #10b981;">
          <div>
            <div style="font-size:0.7rem; color:#34d399; font-weight:700; text-transform:uppercase;">Patient Portal Active</div>
            <h4 style="margin:0; font-size:1.05rem; font-weight:800;">Namaste, ${AppState.currentUser.name}</h4>
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

function selectRoleLogin(role, email, password) {
  document.querySelectorAll(".role-login-card").forEach(card => card.classList.toggle("active", card.dataset.loginRole === role));
  fillLoginCredentials(email, password);
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
  setLanguage(localStorage.getItem("preferredLanguage") || "en");
  const localizationObserver = new MutationObserver(() => {
    localizationObserver.disconnect();
    localizePage();
    localizationObserver.observe(document.body, { childList: true, subtree: true });
  });
  localizationObserver.observe(document.body, { childList: true, subtree: true });
  await fetchCurrentUser();
  if (typeof loadServices === "function") await loadServices();
  updateWorkflowStepper(2);
});
