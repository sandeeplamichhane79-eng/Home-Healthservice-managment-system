/**
 * Home Healthcare Management System - Booking Module (Steps 2 & 3)
 * Manages Service Selection, Booking Wizard, and Document Upload
 */

let uploadedDocumentList = [];
let selectedServiceForBooking = null;

// ==========================================================================
// Step 2: Service Selection & Catalog
// ==========================================================================
async function loadServices() {
  const data = await apiRequest("/api/services");
  if (data.success) {
    AppState.services = data.services;
    renderServicesGrid(data.services);
  }
}

function renderServicesGrid(services) {
  const container = document.getElementById("servicesGridContainer");
  if (!container) return;

  if (services.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 2rem; color: #94a3b8;">No services found.</div>`;
    return;
  }

  container.innerHTML = services.map(svc => `
    <div class="service-card animate-fade-in">
      <div class="service-img-wrapper">
        <img src="${svc.image_url}" alt="${svc.title}" class="service-img" loading="lazy">
        <span class="service-category-tag"><i class="fa-solid ${svc.icon}"></i> ${svc.category}</span>
        <span class="service-price-tag">${formatNpr(svc.price)}</span>
      </div>
      <div class="service-body">
        <h3 class="service-title">${svc.title}</h3>
        <p class="service-desc">${svc.description}</p>
        
        <ul class="service-inclusions">
          ${svc.inclusions.slice(0, 4).map(inc => `<li><i class="fa-solid fa-circle-check"></i> ${inc}</li>`).join("")}
        </ul>

        <div class="service-footer">
          <span class="service-duration"><i class="fa-regular fa-clock"></i> ${svc.duration}</span>
          <button class="btn btn-primary btn-sm" onclick="openBookingModal(${svc.id})">
            Book Now <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

function filterServices(category) {
  document.querySelectorAll(".service-filter-btn").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");

  if (category === "All") {
    renderServicesGrid(AppState.services);
  } else {
    const filtered = AppState.services.filter(s => s.category.toLowerCase().includes(category.toLowerCase()) || s.title.toLowerCase().includes(category.toLowerCase()));
    renderServicesGrid(filtered);
  }
}

// ==========================================================================
// Step 3: Interactive Booking Modal & Document Upload
// ==========================================================================
function openBookingModal(serviceId) {
  const svc = AppState.services.find(s => s.id === serviceId);
  if (!svc) return;

  // Protected Action Gate: Require login/registration before booking
  if (!AppState.currentUser) {
    if (typeof requireAuth === "function") {
      requireAuth(
        () => openBookingModal(serviceId),
        `Please sign in or register to book "${svc.title}". Your booking details will resume immediately.`,
        "patient"
      );
    } else if (typeof openLoginModal === "function") {
      openLoginModal();
    }
    return;
  }

  selectedServiceForBooking = svc;
  uploadedDocumentList = [];

  // Update Modal UI
  document.getElementById("bookingServiceTitle").textContent = svc.title;
  document.getElementById("bookingServicePrice").textContent = formatNpr(svc.price);
  document.getElementById("bookingServiceDuration").textContent = svc.duration;
  document.getElementById("bookingServiceIcon").className = `fa-solid ${svc.icon}`;

  // Set default minimum date to today
  const todayStr = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("bookingDate");
  dateInput.min = todayStr;
  dateInput.value = todayStr;

  // Default patient address to Banke, Nepalgunj
  const defaultNepalgunjAddress = "Dhamboji Chowk, Nepalgunj-2, Banke";
  if (AppState.currentUser) {
    document.getElementById("bookingAddress").value = AppState.currentUser.address || defaultNepalgunjAddress;
    document.getElementById("bookingEmergencyName").value = "Sita Sharma (Spouse)";
    document.getElementById("bookingEmergencyPhone").value = "+977 9841000000";
  } else {
    document.getElementById("bookingAddress").value = defaultNepalgunjAddress;
  }

  renderUploadedFilesList();
  updateWorkflowStepper(3);
  openModal("bookingModal");

  // Initialize or update the interactive Leaflet map for Banke, Nepalgunj
  setTimeout(() => {
    initOrUpdateBookingMap(28.0560, 81.6210, document.getElementById("bookingAddress").value);
  }, 250);
}

// ==========================================================================
// Banke, Nepalgunj Interactive Map Logic (Leaflet.js)
// ==========================================================================
let bookingMap = null;
let bookingMarker = null;

const NEPALGUNJ_LANDMARKS = [
  { name: "Dhamboji Chowk", lat: 28.0560, lng: 81.6210, ward: "Ward 2" },
  { name: "Tribhuvan Chowk", lat: 28.0435, lng: 81.6150, ward: "Ward 1" },
  { name: "BP Chowk", lat: 28.0482, lng: 81.6262, ward: "Ward 4" },
  { name: "Bageshwori Temple Area", lat: 28.0400, lng: 81.6230, ward: "Ward 3" },
  { name: "Karkando", lat: 28.0670, lng: 81.6190, ward: "Ward 18" },
  { name: "Pushpalal Chowk / Surkhet Road", lat: 28.0520, lng: 81.6200, ward: "Ward 2" },
  { name: "Kohalpur Chowk", lat: 28.1880, lng: 81.7040, ward: "Kohalpur" }
];

function getNepalgunjAreaHint(lat, lng) {
  let closest = NEPALGUNJ_LANDMARKS[0];
  let minDist = 9999;
  NEPALGUNJ_LANDMARKS.forEach(lm => {
    const d = Math.hypot(lm.lat - lat, lm.lng - lng);
    if (d < minDist) {
      minDist = d;
      closest = lm;
    }
  });
  return `${closest.name}, ${closest.ward}, Nepalgunj, Banke`;
}

function initOrUpdateBookingMap(lat, lng, addressText) {
  lat = parseFloat(lat) || 28.0560;
  lng = parseFloat(lng) || 81.6210;

  const latInput = document.getElementById("bookingLatitude");
  const lngInput = document.getElementById("bookingLongitude");
  const badgeEl = document.getElementById("bookingCoordsBadge");

  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);
  if (badgeEl) badgeEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

  if (typeof L === "undefined") {
    console.warn("Leaflet library not loaded yet.");
    return;
  }

  const container = document.getElementById("bookingMap");
  if (!container) return;

  if (!bookingMap) {
    bookingMap = L.map("bookingMap", {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(bookingMap);

    bookingMarker = L.marker([lat, lng], { draggable: true }).addTo(bookingMap);

    bookingMarker.on("dragend", function () {
      const pos = bookingMarker.getLatLng();
      onMapLocationSelected(pos.lat, pos.lng);
    });

    bookingMap.on("click", function (e) {
      bookingMarker.setLatLng(e.latlng);
      onMapLocationSelected(e.latlng.lat, e.latlng.lng);
    });
  } else {
    bookingMap.setView([lat, lng], 14);
    if (bookingMarker) {
      bookingMarker.setLatLng([lat, lng]);
    }
  }

  const popupText = addressText || getNepalgunjAreaHint(lat, lng);
  bookingMarker.bindPopup(`<b><i class="fa-solid fa-house-user"></i> Patient Home</b><br>${popupText}<br><small style="color:#0284c7;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</small>`).openPopup();

  setTimeout(() => {
    if (bookingMap) bookingMap.invalidateSize();
  }, 200);
}

function onMapLocationSelected(lat, lng) {
  const latInput = document.getElementById("bookingLatitude");
  const lngInput = document.getElementById("bookingLongitude");
  const badgeEl = document.getElementById("bookingCoordsBadge");
  const addrInput = document.getElementById("bookingAddress");

  if (latInput) latInput.value = lat.toFixed(6);
  if (lngInput) lngInput.value = lng.toFixed(6);
  if (badgeEl) badgeEl.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;

  const suggestedArea = getNepalgunjAreaHint(lat, lng);
  if (addrInput) {
    addrInput.value = `Near ${suggestedArea} (GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;
  }

  if (bookingMarker) {
    bookingMarker.setPopupContent(`<b><i class="fa-solid fa-house-user"></i> Patient Home Location</b><br>${suggestedArea}<br><small style="color:#0284c7;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</small>`).openPopup();
  }

  showToast(`Pinned location: ${suggestedArea}`, "info", 2000);
}

function jumpToNepalgunjLandmark(lat, lng, landmarkName) {
  const addrInput = document.getElementById("bookingAddress");
  if (addrInput) addrInput.value = landmarkName;
  initOrUpdateBookingMap(lat, lng, landmarkName);
  showToast(`Map centered to ${landmarkName}`, "info", 1800);
}

function autoDetectLocation() {
  const addressInput = document.getElementById("bookingAddress");
  if (addressInput) addressInput.value = "Detecting GPS coordinates in Banke...";
  showToast("Locating your GPS coordinates...", "info", 1500);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = `My GPS Location, Banke (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;
        if (addressInput) addressInput.value = addr;
        initOrUpdateBookingMap(lat, lng, addr);
        showToast("GPS location verified and pinned!", "success");
      },
      (err) => {
        // Default to Nepalgunj center
        const lat = 28.0560, lng = 81.6210;
        const addr = "Dhamboji Chowk, Nepalgunj-2, Banke (GPS: 28.0560° N, 81.6210° E)";
        if (addressInput) addressInput.value = addr;
        initOrUpdateBookingMap(lat, lng, addr);
        showToast("Using Banke Nepalgunj center location.", "info");
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  } else {
    const lat = 28.0560, lng = 81.6210;
    const addr = "Dhamboji Chowk, Nepalgunj-2, Banke";
    if (addressInput) addressInput.value = addr;
    initOrUpdateBookingMap(lat, lng, addr);
    showToast("GPS pinned to Dhamboji, Nepalgunj.", "info");
  }
}

// File Upload Handler
async function handleFileUpload(files) {
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append("file", file);

    showToast(`Uploading document: ${file.name}...`, "info", 2000);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        uploadedDocumentList.push({
          name: data.original_name,
          url: data.url,
          filename: data.filename
        });
        renderUploadedFilesList();
        showToast(`Uploaded ${data.original_name} successfully!`, "success");
      } else {
        showToast(`Upload failed: ${data.message}`, "error");
      }
    } catch (err) {
      showToast(`Upload error: ${err.message}`, "error");
    }
  }
}

function renderUploadedFilesList() {
  const container = document.getElementById("bookingUploadedFilesList");
  if (!container) return;

  if (uploadedDocumentList.length === 0) {
    container.innerHTML = `<span style="font-size: 0.8rem; color: #94a3b8;">No medical documents attached yet (optional).</span>`;
    return;
  }

  container.innerHTML = uploadedDocumentList.map((doc, idx) => `
    <div class="upload-file-item">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <i class="fa-solid fa-file-pdf" style="color: #ef4444; font-size:1.1rem;"></i>
        <a href="${doc.url}" target="_blank" style="color:var(--secondary); font-weight:600; text-decoration:underline;">${doc.name}</a>
      </div>
      <button type="button" onclick="removeUploadedDoc(${idx})" style="color: #ef4444;"><i class="fa-solid fa-trash-can"></i></button>
    </div>
  `).join("");
}

function removeUploadedDoc(index) {
  uploadedDocumentList.splice(index, 1);
  renderUploadedFilesList();
}

// Dropzone drag-and-drop listeners
document.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("bookingDropzone");
  const fileInput = document.getElementById("bookingFileInput");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => handleFileUpload(e.target.files));

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      handleFileUpload(e.dataTransfer.files);
    });
  }
});

// Submit Appointment Booking Request
async function submitBookingRequest(event) {
  event.preventDefault();

  if (!selectedServiceForBooking) {
    showToast("Please select a healthcare service first.", "warning");
    return;
  }

  const date = document.getElementById("bookingDate").value;
  const timeSlot = document.getElementById("bookingTimeSlot").value;
  const address = document.getElementById("bookingAddress").value.trim();
  const symptoms = document.getElementById("bookingSymptoms").value.trim();
  const emergencyName = document.getElementById("bookingEmergencyName").value.trim();
  const emergencyPhone = document.getElementById("bookingEmergencyPhone").value.trim();

  if (!date || !timeSlot || !address) {
    showToast("Please fill in the date, time slot, and home address.", "warning");
    return;
  }

  const latitude = parseFloat(document.getElementById("bookingLatitude")?.value) || 28.0560;
  const longitude = parseFloat(document.getElementById("bookingLongitude")?.value) || 81.6210;

  const payload = {
    service_id: selectedServiceForBooking.id,
    appointment_date: date,
    time_slot: timeSlot,
    address: address,
    latitude: latitude,
    longitude: longitude,
    symptoms: symptoms || "Routine home healthcare checkup requested.",
    emergency_contact_name: emergencyName,
    emergency_contact_phone: emergencyPhone,
    uploaded_docs: uploadedDocumentList.map(d => d.filename)
  };

  const data = await apiRequest("/api/appointments", "POST", payload);

  if (data.success) {
    showToast(data.message, "success", 5000);
    closeModal("bookingModal");
    
    // Save to local storage so it immediately transfers and appears across Admin and Patient sections
    const newBooking = {
      id: data.appointment_id,
      appointment_number: data.appointment_number,
      patient_id: AppState.currentUser ? AppState.currentUser.id : 1,
      patient_name: AppState.currentUser ? AppState.currentUser.name : "Patient",
      patient_phone: (AppState.currentUser && AppState.currentUser.phone) ? AppState.currentUser.phone : emergencyPhone,
      service_id: selectedServiceForBooking.id,
      service_title: selectedServiceForBooking.title,
      service_icon: selectedServiceForBooking.icon || "fa-stethoscope",
      service_category: selectedServiceForBooking.category || "Medical",
      service_price: selectedServiceForBooking.price || 65.0,
      appointment_date: date,
      time_slot: timeSlot,
      address: address,
      latitude: latitude,
      longitude: longitude,
      symptoms: symptoms || "Routine home healthcare checkup requested.",
      status: "Pending",
      current_step: 4,
      emergency_contact_name: emergencyName,
      emergency_contact_phone: emergencyPhone,
      uploaded_docs: uploadedDocumentList.map(d => d.filename)
    };
    if (typeof saveLocalBooking === "function") saveLocalBooking(newBooking);

    // Update Stepper to Step 4 (Admin Assignment)
    updateWorkflowStepper(4);

    // Refresh appointments list
    if (typeof loadAppointments === "function") await loadAppointments();
    if (typeof loadPatientRecords === "function") await loadPatientRecords();
    if (typeof loadAdminAppointments === "function") await loadAdminAppointments();
    
    showToast("Appointment submitted! It is now queued for hospital dispatch and visible in My Health Vault.", "success", 6000);
  } else {
    showToast(data.message || "Failed to submit booking.", "error");
  }
}

// ==========================================================================
// Staff, Doctor, Nurse & Admin Location Viewer Modal
// ==========================================================================
let patientLocationMap = null;
let patientLocationMarker = null;

function openPatientLocationModal(lat, lng, patientName, address) {
  lat = parseFloat(lat) || 28.0560;
  lng = parseFloat(lng) || 81.6210;
  patientName = patientName || "Patient";
  address = address || "Banke, Nepalgunj";

  const nameEl = document.getElementById("locModalPatientName");
  const addrEl = document.getElementById("locModalAddress");
  const coordsEl = document.getElementById("locModalCoords");
  const gmapsLink = document.getElementById("locModalGmapsLink");

  if (nameEl) nameEl.textContent = `Patient: ${patientName}`;
  if (addrEl) addrEl.textContent = address;
  if (coordsEl) coordsEl.textContent = `GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (Banke, Nepalgunj)`;
  if (gmapsLink) {
    gmapsLink.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  openModal("patientLocationModal");

  setTimeout(() => {
    if (typeof L === "undefined") return;
    const container = document.getElementById("patientLocationMap");
    if (!container) return;

    if (!patientLocationMap) {
      patientLocationMap = L.map("patientLocationMap", {
        center: [lat, lng],
        zoom: 15,
        scrollWheelZoom: true
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(patientLocationMap);
      patientLocationMarker = L.marker([lat, lng]).addTo(patientLocationMap);
    } else {
      patientLocationMap.setView([lat, lng], 15);
      if (patientLocationMarker) patientLocationMarker.setLatLng([lat, lng]);
    }
    
    patientLocationMarker.bindPopup(`<b><i class="fa-solid fa-house-medical-circle-check" style="color:#0284c7;"></i> Home Visit Destination</b><br><strong>${patientName}</strong><br>${address}<br><small style="color:#0284c7;">${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E</small>`).openPopup();
    patientLocationMap.invalidateSize();
  }, 250);
}
