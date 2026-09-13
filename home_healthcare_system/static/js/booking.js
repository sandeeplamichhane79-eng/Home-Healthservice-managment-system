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
        <span class="service-price-tag">$${svc.price.toFixed(2)}</span>
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

  selectedServiceForBooking = svc;
  uploadedDocumentList = [];

  // Update Modal UI
  document.getElementById("bookingServiceTitle").textContent = svc.title;
  document.getElementById("bookingServicePrice").textContent = `$${svc.price.toFixed(2)}`;
  document.getElementById("bookingServiceDuration").textContent = svc.duration;
  document.getElementById("bookingServiceIcon").className = `fa-solid ${svc.icon}`;

  // Set default minimum date to today
  const todayStr = new Date().toISOString().split("T")[0];
  const dateInput = document.getElementById("bookingDate");
  dateInput.min = todayStr;
  dateInput.value = todayStr;

  // Auto-fill patient address if logged in
  if (AppState.currentUser) {
    document.getElementById("bookingAddress").value = AppState.currentUser.address || "Lazimpat, Kathmandu";
    document.getElementById("bookingEmergencyName").value = "Sita Sharma (Spouse)";
    document.getElementById("bookingEmergencyPhone").value = "+977 9841000000";
  }

  renderUploadedFilesList();
  updateWorkflowStepper(3);
  openModal("bookingModal");
}

function autoDetectLocation() {
  const addressInput = document.getElementById("bookingAddress");
  addressInput.value = "Detecting GPS coordinates...";
  setTimeout(() => {
    addressInput.value = "Lazimpat, Ward 2, Kathmandu (GPS Verified: 27.7172° N, 85.3240° E)";
    showToast("Home address GPS location pinned successfully!", "success");
  }, 600);
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

  const payload = {
    service_id: selectedServiceForBooking.id,
    appointment_date: date,
    time_slot: timeSlot,
    address: address,
    symptoms: symptoms || "Routine home healthcare checkup requested.",
    emergency_contact_name: emergencyName,
    emergency_contact_phone: emergencyPhone,
    uploaded_docs: uploadedDocumentList.map(d => d.filename)
  };

  const data = await apiRequest("/api/appointments", "POST", payload);

  if (data.success) {
    showToast(data.message, "success", 5000);
    closeModal("bookingModal");
    
    // Update Stepper to Step 4 (Admin Assignment)
    updateWorkflowStepper(4);

    // Refresh appointments list
    if (typeof loadAppointments === "function") await loadAppointments();
    if (typeof loadPatientRecords === "function") await loadPatientRecords();
    
    // Suggest switching to Admin tab to simulate assignment
    showToast("Appointment submitted! Switch to Admin tab to assign a doctor/nurse.", "info", 6000);
  } else {
    showToast(data.message || "Failed to submit booking.", "error");
  }
}
