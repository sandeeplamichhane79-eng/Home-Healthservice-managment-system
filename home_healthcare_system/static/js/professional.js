/**
 * Home Healthcare Management System - Healthcare Professional Module (Steps 5 & 6)
 * Manages Home Visits, Check-in, Vitals Recording, and Digital Prescription Builder
 */

let activeVisitingAppointmentId = null;
let activeRespondingAppointmentId = null;
let prescriptionMedicinesList = [];
let attachedReportFilename = "";

async function loadProfessionalDashboard() {
  const data = await apiRequest("/api/appointments");
  const container = document.getElementById("proAppointmentsContainer");
  if (!container) return;

  let appointments = (data && data.success && Array.isArray(data.appointments)) ? [...data.appointments] : [];

  // Merge locally stored bookings for instant visibility
  if (typeof getLocalBookings === "function") {
    try {
      const localBookings = getLocalBookings();
      const appMap = new Map();
      appointments.forEach(a => appMap.set(a.appointment_number, a));
      for (const lb of localBookings) {
        if (appMap.has(lb.appointment_number)) {
          const existing = appMap.get(lb.appointment_number);
          if (lb.professional_id && !existing.professional_id) {
            existing.professional_id = lb.professional_id;
            existing.professional_name = lb.professional_name || existing.professional_name;
            existing.professional_specialization = lb.professional_specialization || existing.professional_specialization;
            existing.professional_phone = lb.professional_phone || existing.professional_phone;
            existing.status = lb.status || "Assigned";
            existing.current_step = lb.current_step || 5;
          }
          if (lb.staff_response) existing.staff_response = lb.staff_response;
          if (lb.eta) existing.eta = lb.eta;
          if (lb.status && lb.status !== "Pending") existing.status = lb.status;
          if (lb.current_step) existing.current_step = lb.current_step;
        } else {
          appointments.unshift(lb);
        }
      }
    } catch (e) {
      console.warn("Local bookings read failed in pro dashboard:", e);
    }
  }

  // Filter for currently active staff member (unless admin)
  const curUser = AppState.currentUser;
  if (curUser && curUser.role !== 'admin') {
    const myId = String(curUser.id || '');
    const myName = (curUser.name || '').toLowerCase().trim();
    const myEmail = (curUser.email || '').toLowerCase().trim();

    appointments = appointments.filter(app => {
      const matchId = app.professional_id && String(app.professional_id) === myId;
      const proName = (app.professional_name || '').toLowerCase().trim();
      const matchName = proName && (proName.includes(myName) || myName.includes(proName));
      const matchEmail = app.professional_email && (app.professional_email.toLowerCase().trim() === myEmail);
      return matchId || matchName || matchEmail;
    });
  }

  if (appointments.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fa-solid fa-calendar-check" style="font-size:2.5rem; margin-bottom:0.75rem; display:block;"></i>No visits assigned currently.</div>`;
    return;
  }

  container.innerHTML = appointments.map(app => {
    let badgeClass = "badge-pending";
    if (app.status === "Assigned") badgeClass = "badge-assigned";
    if (app.status === "In-Progress") badgeClass = "badge-in-progress";
    if (app.status === "Completed") badgeClass = "badge-completed";

    return `
      <div class="card-panel card-hover-glow" style="margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <span class="badge ${badgeClass}">${app.status}</span>
            <span style="font-size:0.85rem; color:var(--text-muted); margin-left:0.5rem;">Appt #${app.appointment_number}</span>
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--dark); margin-top:0.25rem;">
              <i class="fa-solid ${app.service_icon || 'fa-stethoscope'}" style="color:var(--primary)"></i> ${app.service_title}
            </h3>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--secondary); font-size:0.95rem;">${app.appointment_date}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${app.time_slot}</div>
          </div>
        </div>

        ${(app.staff_response || app.eta) ? `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius-md); padding:0.75rem 1rem; margin-bottom:1rem; font-size:0.85rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem; flex-wrap:wrap; gap:0.5rem;">
              <span style="font-weight:700; color:#15803d;">
                <i class="fa-solid fa-circle-check"></i> Latest Response Sent to Patient:
              </span>
              ${app.eta ? `<span class="badge" style="background:#0284c7; color:#fff; font-size:0.75rem;"><i class="fa-solid fa-clock"></i> ETA: ${app.eta}</span>` : ''}
            </div>
            <div style="color:#1e293b; font-weight:500;">${app.staff_response}</div>
          </div>
        ` : ''}

        <div style="background:#f8fafc; border-radius:var(--radius-md); padding:1rem; margin-bottom:1rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Patient Details</div>
            <div style="font-weight:700; color:var(--dark);">${app.patient_name} (${app.patient_age || 'Adult'} yrs, ${app.patient_blood_group || 'N/A'})</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-phone"></i> ${app.patient_phone || 'N/A'}</div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Destination Address (Banke, Nepalgunj)</div>
            <div style="font-size:0.85rem; color:var(--dark); font-weight:600;"><i class="fa-solid fa-house-medical" style="color:var(--primary);"></i> ${app.address}</div>
            <div style="display:flex; gap:0.4rem; margin-top:0.35rem; flex-wrap:wrap;">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${app.latitude || 28.0560},${app.longitude || 81.6210}" target="_blank" class="btn btn-sm btn-outline" style="font-size:0.72rem; padding:0.2rem 0.5rem; text-decoration:none;">
                <i class="fa-solid fa-diamond-turn-right" style="color:#0284c7;"></i> Google Maps Navigation
              </a>
              <button type="button" class="btn btn-sm btn-outline" onclick="openPatientLocationModal(${app.latitude || 28.0560}, ${app.longitude || 81.6210}, '${(app.patient_name || 'Patient').replace(/'/g, "\\'")}', '${(app.address || 'Nepalgunj, Banke').replace(/'/g, "\\'")}')" style="font-size:0.72rem; padding:0.2rem 0.5rem;">
                <i class="fa-solid fa-map-location-dot" style="color:var(--primary);"></i> View on Map
              </button>
            </div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Chief Complaints</div>
            <div style="font-size:0.85rem; color:var(--text-main);">${app.symptoms || 'General Checkup'}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" onclick="openStaffResponseModal(${app.id})">
            <i class="fa-solid fa-paper-plane"></i> Respond / Send Update
          </button>

          ${app.status === 'Assigned' ? `
            <button class="btn btn-primary btn-sm" onclick="startHomeVisit(${app.id})">
              <i class="fa-solid fa-person-walking-arrow-right"></i> Check-in & Start Visit (Step 5)
            </button>
          ` : ''}

          ${app.status === 'In-Progress' ? `
            <button class="btn btn-secondary btn-sm" onclick="openCompleteRecordsModal(${app.id})">
              <i class="fa-solid fa-stethoscope"></i> Enter Vitals & Prescription (Step 6)
            </button>
          ` : ''}

          ${app.status === 'Completed' ? `
            <button class="btn btn-outline btn-sm" onclick="viewAppointmentFullModal(${app.id})">
              <i class="fa-solid fa-file-medical"></i> View Summary & Prescription
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
}

// Step 5: Check-In & Start Home Visit
async function startHomeVisit(appId) {
  const data = await apiRequest(`/api/appointments/${appId}/start-visit`, "POST");
  if (data.success) {
    if (typeof updateLocalBooking === "function") {
      updateLocalBooking({
        id: appId,
        status: "In-Progress",
        current_step: 5,
        staff_response: data.message || "Healthcare professional checked in at your location. Home visit in progress."
      });
    }

    showToast(data.message, "success");
    updateWorkflowStepper(5);
    await loadProfessionalDashboard();
    // Prompt next step
    setTimeout(() => {
      openCompleteRecordsModal(appId);
    }, 1000);
  }
}

// Step 6: Open Records & Prescription Console
function openCompleteRecordsModal(appId) {
  activeVisitingAppointmentId = appId;
  attachedReportFilename = "";
  prescriptionMedicinesList = [
    { name: "Amoxicillin 500mg", dosage: "1 Tab", frequency: "Twice daily (1-0-1)", duration: "5 Days", instructions: "After meals" }
  ];

  renderPrescriptionRows();
  updateWorkflowStepper(6);
  openModal("completeRecordsModal");
}

function addPrescriptionRow() {
  prescriptionMedicinesList.push({
    name: "",
    dosage: "1 Tab / Cap",
    frequency: "Twice daily",
    duration: "5 Days",
    instructions: "After meals"
  });
  renderPrescriptionRows();
}

function removePrescriptionRow(idx) {
  prescriptionMedicinesList.splice(idx, 1);
  renderPrescriptionRows();
}

function updatePrescriptionField(idx, field, value) {
  if (prescriptionMedicinesList[idx]) {
    prescriptionMedicinesList[idx][field] = value;
  }
}

function renderPrescriptionRows() {
  const container = document.getElementById("prescriptionRowsContainer");
  if (!container) return;

  container.innerHTML = prescriptionMedicinesList.map((med, idx) => `
    <div style="display:grid; grid-template-columns: 2fr 1fr 1.2fr 1fr 1.5fr 30px; gap:0.5rem; align-items:center; margin-bottom:0.5rem;">
      <input type="text" class="form-control" placeholder="Medicine Name (e.g. Paracetamol 650)" value="${med.name}" oninput="updatePrescriptionField(${idx}, 'name', this.value)">
      <input type="text" class="form-control" placeholder="Dosage" value="${med.dosage}" oninput="updatePrescriptionField(${idx}, 'dosage', this.value)">
      <select class="form-control" onchange="updatePrescriptionField(${idx}, 'frequency', this.value)">
        <option value="Once daily (1-0-0)" ${med.frequency.includes('Once') ? 'selected' : ''}>Once daily (1-0-0)</option>
        <option value="Twice daily (1-0-1)" ${med.frequency.includes('Twice') ? 'selected' : ''}>Twice daily (1-0-1)</option>
        <option value="Thrice daily (1-1-1)" ${med.frequency.includes('Thrice') ? 'selected' : ''}>Thrice daily (1-1-1)</option>
        <option value="As needed (SOS)" ${med.frequency.includes('SOS') ? 'selected' : ''}>As needed (SOS)</option>
      </select>
      <input type="text" class="form-control" placeholder="Duration" value="${med.duration}" oninput="updatePrescriptionField(${idx}, 'duration', this.value)">
      <input type="text" class="form-control" placeholder="Instructions" value="${med.instructions}" oninput="updatePrescriptionField(${idx}, 'instructions', this.value)">
      <button type="button" onclick="removePrescriptionRow(${idx})" style="color:var(--danger);"><i class="fa-solid fa-circle-xmark"></i></button>
    </div>
  `).join("");
}

// Upload Report during visit
async function handleVisitReportUpload(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const formData = new FormData();
  formData.append("file", file);

  showToast(`Uploading report: ${file.name}...`, "info");
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.success) {
      attachedReportFilename = data.filename;
      document.getElementById("visitReportUploadStatus").innerHTML = `
        <span style="color:var(--success); font-size:0.85rem; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Report attached: ${data.original_name}</span>
      `;
      showToast("Report uploaded and attached to visit record!", "success");
    }
  } catch (err) {
    showToast("Report upload failed.", "error");
  }
}

// Submit Step 6 (Vitals + Notes + Prescription)
async function submitVisitRecords(event) {
  event.preventDefault();

  const bp = document.getElementById("vrBloodPressure").value.trim() || "120/80";
  const pulse = parseInt(document.getElementById("vrPulse").value) || 72;
  const temp = parseFloat(document.getElementById("vrTemp").value) || 98.6;
  const spo2 = parseInt(document.getElementById("vrSpo2").value) || 98;
  const sugar = parseFloat(document.getElementById("vrSugar").value) || 100.0;
  const resp = parseInt(document.getElementById("vrResp").value) || 16;
  const notes = document.getElementById("vrNotes").value.trim();
  const treatment = document.getElementById("vrTreatment").value.trim();

  const doctorName = document.getElementById("rxDoctorName").value.trim() || (AppState.currentUser ? AppState.currentUser.name : "Attending Clinician");
  const diagnosis = document.getElementById("rxDiagnosis").value.trim() || "Clinical Examination";
  const specialInstructions = document.getElementById("rxSpecialInstructions").value.trim();
  const followUpDate = document.getElementById("rxFollowUpDate").value;

  const validMedicines = prescriptionMedicinesList.filter(m => m.name.trim() !== "");

  const payload = {
    blood_pressure: bp,
    pulse_rate: pulse,
    temperature: temp,
    spo2: spo2,
    blood_sugar: sugar,
    respiration_rate: resp,
    clinical_notes: notes || "Patient examined at bedside. Vitals within stable parameters.",
    treatment_given: treatment || "Clinical nursing care, vitals check, and care instructions provided.",
    attached_report_path: attachedReportFilename || "sample_visit_summary.pdf",
    
    doctor_name: doctorName,
    diagnosis: diagnosis,
    medicines: validMedicines,
    special_instructions: specialInstructions || "Maintain good hydration, rest adequately, and follow up if symptoms persist.",
    follow_up_date: followUpDate
  };

  const data = await apiRequest(`/api/appointments/${activeVisitingAppointmentId}/complete-service`, "POST", payload);

  if (data.success) {
    if (typeof updateLocalBooking === "function") {
      updateLocalBooking({
        id: activeVisitingAppointmentId,
        status: "In-Progress",
        current_step: 7,
        staff_response: `Visit completed by ${doctorName}. Assessment: ${diagnosis}. Clinical vitals and prescription recorded.`
      });
    }

    showToast(data.message, "success", 5000);
    closeModal("completeRecordsModal");
    updateWorkflowStepper(7);
    await loadProfessionalDashboard();
    
    // Switch to records or prompt payment
    showToast("Records updated! Ready for Step 7: Online or Cash Payment.", "info", 6000);
  } else {
    showToast(data.message || "Failed to update records.", "error");
  }
}

// ==========================================
// Direct Staff Response Modal & Handlers
// ==========================================
async function openStaffResponseModal(appId) {
  activeRespondingAppointmentId = appId;
  
  let app = null;
  if (typeof getLocalBookings === "function") {
    const list = getLocalBookings();
    app = list.find(a => String(a.id) === String(appId));
  }
  
  if (!app) {
    const res = await apiRequest(`/api/appointments/${appId}`);
    if (res.success && res.appointment) app = res.appointment;
  }

  const numEl = document.getElementById("staffRespApptNumber");
  const nameEl = document.getElementById("staffRespPatientName");
  const addrEl = document.getElementById("staffRespAddress");
  const badgeEl = document.getElementById("staffRespStatusBadge");
  const statusSelect = document.getElementById("staffRespStatusSelect");
  const etaInput = document.getElementById("staffRespEtaInput");
  const msgText = document.getElementById("staffRespMessageText");

  if (numEl) numEl.textContent = app ? `Appt #${app.appointment_number}` : `Appt #${appId}`;
  if (nameEl) nameEl.textContent = app ? `${app.patient_name || 'Patient'} (${app.patient_phone || ''})` : "Patient";
  if (addrEl) {
    if (app) {
      const lat = app.latitude || 28.0560;
      const lng = app.longitude || 81.6210;
      addrEl.innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--primary);"></i> Destination: ${app.address} 
        <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="color:var(--primary); font-weight:700; margin-left:0.5rem; text-decoration:underline;">
          <i class="fa-solid fa-diamond-turn-right"></i> Navigate (Google Maps)
        </a>`;
    } else {
      addrEl.innerHTML = "";
    }
  }
  if (badgeEl) badgeEl.textContent = app ? app.status : "Assigned";
  if (statusSelect && app) statusSelect.value = app.status || "Assigned";
  if (etaInput) etaInput.value = (app && app.eta) ? app.eta : "";
  if (msgText) msgText.value = (app && app.staff_response) ? app.staff_response : "I have accepted your appointment request and will arrive at your home shortly.";

  openModal("staffResponseModal");
}

function setEtaPreset(val) {
  const el = document.getElementById("staffRespEtaInput");
  if (el) el.value = val;
}

function setMessagePreset(val) {
  const el = document.getElementById("staffRespMessageText");
  if (el) el.value = val;
}

async function submitStaffResponse(event) {
  event.preventDefault();
  if (!activeRespondingAppointmentId) return;

  const eta = (document.getElementById("staffRespEtaInput")?.value || "").trim();
  const staffResponse = (document.getElementById("staffRespMessageText")?.value || "").trim();
  const status = document.getElementById("staffRespStatusSelect")?.value || "Assigned";

  if (!staffResponse) {
    showToast("Please enter an update message for the patient.", "warning");
    return;
  }

  const data = await apiRequest(`/api/appointments/${activeRespondingAppointmentId}/respond`, "POST", {
    staff_response: staffResponse,
    eta: eta,
    status: status
  });

  if (data.success) {
    if (typeof updateLocalBooking === "function") {
      updateLocalBooking({
        id: activeRespondingAppointmentId,
        staff_response: staffResponse,
        eta: eta,
        status: status
      });
    }

    showToast("Update and ETA sent directly to patient!", "success");
    closeModal("staffResponseModal");
    await loadProfessionalDashboard();
    if (typeof loadPatientAppointmentsHistory === "function") {
      loadPatientAppointmentsHistory().catch(() => {});
    }
  } else {
    showToast(data.message || "Failed to send update.", "error");
  }
}
