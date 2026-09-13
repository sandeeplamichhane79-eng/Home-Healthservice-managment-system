p1 = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>National Home Healthcare Management System</title>
  
  <!-- Google Fonts: Plus Jakarta Sans -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  
  <!-- Font Awesome 6 Icons -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
  
  <!-- Core & Animation Stylesheets -->
  <link rel="stylesheet" href="/static/css/style.css">
  <link rel="stylesheet" href="/static/css/animations.css">
  <link rel="stylesheet" href="/static/css/doctor_animation.css">
</head>
<body>

  <!-- Top Quick Demo Role Switcher Bar -->
  <aside class="demo-role-bar">
    <div class="demo-title">
      <i class="fa-solid fa-arrows-spin animate-spin" style="animation-duration: 4s;"></i>
      <span>DEMO QUICK ROLE ACCESS (1-CLICK):</span>
    </div>
    <div class="role-chips">
      <button class="role-chip-btn active" data-role="patient" onclick="switchDemoRole('patient')" title="Switch to Patient Ram">
        <i class="fa-solid fa-user"></i> Patient (Ram)
      </button>
      <button class="role-chip-btn" data-role="admin" onclick="switchDemoRole('admin')" title="Switch to Admin Sandeep">
        <i class="fa-solid fa-shield-halved"></i> Admin (Sandeep)
      </button>
      <button class="role-chip-btn" data-role="doctor" onclick="switchDemoRole('doctor')" title="Switch to Doctor Dr. Binod Thapa">
        <i class="fa-solid fa-user-doctor"></i> Doctor (Dr. Binod Thapa)
      </button>
      <button class="role-chip-btn" data-role="nurse" onclick="switchDemoRole('nurse')" title="Switch to Nurse Rama">
        <i class="fa-solid fa-user-nurse"></i> Nurse (Rama)
      </button>
      <button class="role-chip-btn" data-role="pharmacist" onclick="switchDemoRole('pharmacist')" title="Switch to Pharmacist Chetna">
        <i class="fa-solid fa-pills"></i> Pharmacist (Chetna)
      </button>
      <button class="role-chip-btn" data-role="login" onclick="openLoginModal()" style="background:#0284c7; color:white; border-color:#38bdf8;">
        <i class="fa-solid fa-key"></i> ID/Password Login
      </button>
    </div>
  </aside>

  <!-- Main Navbar with National Emblem Logo -->
  <header class="navbar">
    <div class="container nav-wrapper">
      <a href="#" class="brand-logo" onclick="switchTab('services')" style="text-decoration:none;">
        <img src="/static/images/nepal_emblem_logo.png" alt="National Emblem Logo" class="emblem-logo">
        <div class="gov-branding-text">
          <span class="gov-title-np">नेपाल सरकार | स्वास्थ्य तथा जनसङ्ख्या मन्त्रालय</span>
          <span class="gov-title-en">Home Healthcare System</span>
          <span class="gov-subtitle"><i class="fa-solid fa-circle-check"></i> Certified Bedside Clinical Care</span>
        </div>
      </a>

      <nav class="nav-links">
        <button class="nav-btn active" id="navBtnServices" data-tab="services" onclick="switchTab('services')">
          <i class="fa-solid fa-hand-holding-medical"></i> Services Catalog
        </button>
        <button class="nav-btn" id="navBtnRecords" data-tab="records" onclick="switchTab('records')">
          <i class="fa-solid fa-folder-medical"></i> My Health Vault & Vitals
        </button>
        <button class="nav-btn" id="navBtnProfessional" data-tab="professional" onclick="switchTab('professional')">
          <i class="fa-solid fa-stethoscope"></i> Clinician Visit Console
        </button>
        <button class="nav-btn" id="navBtnAdmin" data-tab="admin" onclick="switchTab('admin')">
          <i class="fa-solid fa-chart-line"></i> Admin Dispatch & Resolution
        </button>
      </nav>

      <div style="display:flex; align-items:center; gap:0.5rem;">
        <div class="user-badge-menu" id="userBadgeSection" onclick="openLoginModal()" style="cursor:pointer;" title="Click to view or switch user credentials">
          <img id="headerUserAvatar" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100" alt="Avatar" class="user-avatar-mini">
          <div class="user-info-text">
            <span id="headerUserName" class="user-info-name">Ram</span>
            <span id="headerUserRole" class="user-info-role">PATIENT</span>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="openLoginModal()" style="font-size:0.75rem; padding:0.4rem 0.6rem;" title="Sign In with ID and Password">
          <i class="fa-solid fa-right-to-bracket"></i> Login
        </button>
        <button class="btn btn-sm btn-danger" onclick="logoutUser()" style="font-size:0.75rem; padding:0.4rem 0.6rem;" title="Logout">
          <i class="fa-solid fa-power-off"></i>
        </button>
      </div>
    </div>
  </header>
"""
with open("templates/index.html", "w", encoding="utf-8") as f:
    f.write(p1)
print("P1 complete")
