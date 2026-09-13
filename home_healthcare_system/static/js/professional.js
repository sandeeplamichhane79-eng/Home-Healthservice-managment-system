/**
 * Home Healthcare Management System - Healthcare Professional Module (Steps 5 & 6)
 * Manages Home Visits, Check-in, Vitals Recording, and Digital Prescription Builder
 */

let activeVisitingAppointmentId = null;
let prescriptionMedicinesList = [];
let attachedReportFilename = "";

async function loadProfessionalDashboard() {
  const data = await apiRequest("/api/appointments");
  const container = document.getElementById("proAppointmentsContainer");
  if (!container) return;

  if (!data.success || data.appointments.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fa-solid fa-calendar-check" style="font-size:2.5rem; margin-bottom:0.75rem; display:block;"></i>No visits assigned currently.</div>`;
    return;
  }

  container.innerHTML = data.appointments.map(app => {
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
              <i class="fa-solid ${app.service_icon}" style="color:var(--primary)"></i> ${app.service_title}
            </h3>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--secondary); font-size:0.95rem;">${app.appointment_date}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${app.time_slot}</div>
          </div>
        </div>

        <div style="background:#f8fafc; border-radius:var(--radius-md); padding:1rem; margin-bottom:1rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Patient Details</div>
            <div style="font-weight:700; color:var(--dark);">${app.patient_name} (${app.patient_age} yrs, ${app.patient_blood_group || 'N/A'})</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-phone"></i> ${app.patient_phone || 'N/A'}</div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Destination Address</div>
            <div style="font-size:0.85rem; color:var(--dark); font-weight:600;"><i class="fa-solid fa-house-medical" style="color:var(--primary);"></i> ${app.address}</div>
            <div style="font-size:0.75rem; color:var(--secondary); cursor:pointer;" onclick="showToast('Navigating via GPS maps...', 'info')"><i class="fa-solid fa-map-location-dot"></i> Open Route Navigation</div>
          </div>

          <div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Chief Complaints</div>
            <div style="font-size:0.85rem; color:var(--text-main);">${app.symptoms || 'General Checkup'}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; flex-wrap:wrap;">
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
