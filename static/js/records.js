/**
 * Home Healthcare Management System - Records, Payment & History Module (Steps 7 & 8)
 * Manages Payment Checkout, Vitals Trend Charts, Printable Prescriptions, and Invoices
 */

let activePaymentAppointmentId = null;
let activeSelectedPaymentMethod = "online_card";

// ==========================================================================
// Load Patient Records & Appointment History (Step 8)
// ==========================================================================
async function loadPatientRecords() {
  await Promise.all([
    loadPatientAppointmentsHistory(),
    loadVitalsCharts()
  ]);
}

async function loadPatientAppointmentsHistory() {
  const data = await apiRequest("/api/appointments");
  const container = document.getElementById("patientAppointmentsHistoryList");
  if (!container) return;

  if (!data.success || data.appointments.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fa-solid fa-folder-open" style="font-size:2.5rem; margin-bottom:0.75rem; display:block;"></i>No past health records or appointments found.</div>`;
    return;
  }

  container.innerHTML = data.appointments.map(app => {
    let badgeClass = "badge-pending";
    if (app.status === "Assigned") badgeClass = "badge-assigned";
    if (app.status === "In-Progress") badgeClass = "badge-in-progress";
    if (app.status === "Completed") badgeClass = "badge-completed";
    if (app.status === "Issue Raised") badgeClass = "badge-issue";

    const isStep7Ready = app.current_step === 7;
    const isCompleted = app.status === "Completed" || app.current_step >= 8;

    return `
      <div class="card-panel card-hover-glow" style="margin-bottom:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <span class="badge ${badgeClass}">${app.status}</span>
            <span style="font-size:0.85rem; color:var(--text-muted); margin-left:0.5rem;">#${app.appointment_number}</span>
            <h3 style="font-size:1.15rem; font-weight:800; color:var(--dark); margin-top:0.25rem;">
              <i class="fa-solid ${app.service_icon}" style="color:var(--primary)"></i> ${app.service_title}
            </h3>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:700; color:var(--secondary); font-size:0.95rem;">${app.appointment_date}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${app.time_slot}</div>
          </div>
        </div>

        <div style="background:#f8fafc; border-radius:var(--radius-md); padding:1rem; margin-bottom:1rem; font-size:0.85rem;">
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem;">
            <div>
              <strong>Healthcare Provider:</strong> ${app.professional_name ? `${app.professional_name} (${app.professional_specialization || ''})` : '<span style="color:#ef4444;">Pending Assignment</span>'}
            </div>
            <div>
              <strong>Visit Location:</strong> ${app.address}
            </div>
            <div>
              <strong>Symptoms/Notes:</strong> ${app.symptoms || 'None'}
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
          ${isStep7Ready ? `
            <button class="btn btn-primary btn-sm" onclick="openPaymentModal(${app.id})">
              <i class="fa-solid fa-credit-card"></i> Pay Now (Step 7)
            </button>
          ` : ''}

          ${isCompleted ? `
            <button class="btn btn-outline btn-sm" onclick="viewPrescriptionModal(${app.id})">
              <i class="fa-solid fa-prescription"></i> Digital Rx
            </button>
            <button class="btn btn-outline btn-sm" onclick="viewInvoiceModal(${app.id})">
              <i class="fa-solid fa-receipt"></i> Invoice
            </button>
            <button class="btn btn-outline btn-sm" onclick="viewMedicalReportModal(${app.id})">
              <i class="fa-solid fa-file-medical"></i> Lab / Visit Report
            </button>
            <button class="btn btn-secondary btn-sm" onclick="openFeedbackModal(${app.id})">
              <i class="fa-solid fa-star"></i> Feedback & Rating (Step 9)
            </button>
          ` : `
            <button class="btn btn-outline btn-sm" onclick="viewAppointmentFullModal(${app.id})">
              <i class="fa-solid fa-circle-info"></i> View Details
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

// ==========================================================================
// Step 7: Payment Modal (Online Card, UPI QR, Cash)
// ==========================================================================
async function openPaymentModal(appId) {
  activePaymentAppointmentId = appId;
  const data = await apiRequest(`/api/appointments/${appId}`);
  if (!data.success) return;

  const app = data.appointment;
  const basePrice = app.service_price || 65.00;
  const consumables = 15.00;
  const tax = (basePrice + consumables) * 0.05;
  const total = basePrice + consumables + tax;

  document.getElementById("payServiceTitle").textContent = app.service_title;
  document.getElementById("payBasePrice").textContent = formatNpr(basePrice);
  document.getElementById("payConsumables").textContent = formatNpr(consumables);
  document.getElementById("payTax").textContent = formatNpr(tax);
  document.getElementById("payTotalAmount").textContent = formatNpr(total);

  selectPaymentMethod("online_card");
  updateWorkflowStepper(7);
  openModal("paymentModal");
}

function selectPaymentMethod(method) {
  activeSelectedPaymentMethod = method;
  document.querySelectorAll(".pay-tab-btn").forEach(b => b.classList.remove("active"));
  
  const cardSection = document.getElementById("payCardSection");
  const upiSection = document.getElementById("payUpiSection");
  const cashSection = document.getElementById("payCashSection");

  cardSection.style.display = "none";
  upiSection.style.display = "none";
  cashSection.style.display = "none";

  if (method === "online_card") {
    document.getElementById("payTabCard").classList.add("active");
    cardSection.style.display = "block";
  } else if (method === "online_upi") {
    document.getElementById("payTabUpi").classList.add("active");
    upiSection.style.display = "block";
  } else if (method === "cash") {
    document.getElementById("payTabCash").classList.add("active");
    cashSection.style.display = "block";
  }
}

async function submitPayment(event) {
  event.preventDefault();
  showToast(`Processing payment via ${activeSelectedPaymentMethod.replace('_', ' ').toUpperCase()}...`, "info");

  const data = await apiRequest(`/api/appointments/${activePaymentAppointmentId}/pay`, "POST", {
    payment_method: activeSelectedPaymentMethod
  });

  if (data.success) {
    showToast(data.message, "success", 5000);
    closeModal("paymentModal");
    updateWorkflowStepper(8);
    await loadPatientRecords();
    
    // Prompt next step
    setTimeout(() => {
      openFeedbackModal(activePaymentAppointmentId);
    }, 1500);
  } else {
    showToast(data.message || "Payment failed.", "error");
  }
}

// ==========================================================================
// Step 8: Interactive Vitals Charts (Canvas Visualization)
// ==========================================================================
async function loadVitalsCharts() {
  const data = await apiRequest("/api/patient/vitals-history");
  if (!data.success || !data.vitals_history || data.vitals_history.length === 0) return;

  const vitals = data.vitals_history;
  const canvas = document.getElementById("vitalsChartCanvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.parentElement.clientWidth || 600;
  const height = canvas.height = 200;

  ctx.clearRect(0, 0, width, height);

  // Background Grid Lines
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  for (let y = 30; y < height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }

  // Draw Pulse Line (Emerald)
  const pulsePoints = vitals.map(v => v.pulse_rate || 72);
  drawMetricLine(ctx, pulsePoints, width, height, "#10b981", "Pulse (bpm)", 50, 110);

  // Draw Sugar Line (Blue)
  const sugarPoints = vitals.map(v => v.blood_sugar || 100);
  drawMetricLine(ctx, sugarPoints, width, height, "#2563eb", "Blood Sugar (mg/dL)", 70, 160);
}

function drawMetricLine(ctx, dataPoints, width, height, color, label, minVal, maxVal) {
  if (dataPoints.length === 0) return;
  const stepX = (width - 80) / Math.max(1, dataPoints.length - 1);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();

  dataPoints.forEach((val, i) => {
    const x = 50 + i * stepX;
    const norm = (val - minVal) / (maxVal - minVal);
    const y = height - 30 - norm * (height - 60);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw Nodes
  dataPoints.forEach((val, i) => {
    const x = 50 + i * stepX;
    const norm = (val - minVal) / (maxVal - minVal);
    const y = height - 30 - norm * (height - 60);

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "10px sans-serif";
    ctx.fillText(`${val}`, x - 8, y - 8);
  });
}

// ==========================================================================
// Step 8: Printable Digital Prescription & Invoice Modals
// ==========================================================================
async function viewAppointmentFullModal(appId) {
  const data = await apiRequest(`/api/appointments/${appId}`);
  if (!data.success) {
    showToast(data.message || "Unable to load appointment summary.", "error");
    return;
  }

  const app = data.appointment;
  const container = document.getElementById("prescriptionModalContent");
  const modalTitle = document.querySelector("#prescriptionModal .modal-title");
  if (!container) return;

  if (modalTitle) {
    modalTitle.innerHTML = '<i class="fa-solid fa-file-medical" style="color:var(--primary);"></i> Appointment Summary';
  }

  container.innerHTML = `
    <div style="display:grid; gap:1rem;">
      <div style="display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; align-items:flex-start;">
        <div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700; text-transform:uppercase;">Appointment</div>
          <h2 style="font-size:1.25rem; color:var(--dark); margin-top:0.2rem;">${app.service_title || "Home Healthcare Visit"}</h2>
          <div style="color:var(--text-muted);">#${app.appointment_number || app.id}</div>
        </div>
        <span class="badge badge-completed">${app.status || "Completed"}</span>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:0.75rem; background:#f8fafc; border-radius:var(--radius-md); padding:1rem;">
        <div><strong>Patient</strong><br>${app.patient_name || "N/A"}</div>
        <div><strong>Date & Time</strong><br>${app.appointment_date || "N/A"} | ${app.time_slot || "N/A"}</div>
        <div><strong>Healthcare Provider</strong><br>${app.professional_name || "Pending Assignment"}</div>
        <div><strong>Visit Address</strong><br>${app.address || "N/A"}</div>
      </div>

      <div class="card-panel" style="padding:1rem;">
        <h3 style="font-size:1rem; margin-bottom:0.45rem; color:var(--primary);"><i class="fa-solid fa-notes-medical"></i> Visit Notes</h3>
        <p style="color:var(--text-main);">${app.symptoms || "No symptoms or notes recorded."}</p>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; flex-wrap:wrap;">
        ${app.prescription ? `<button type="button" class="btn btn-primary btn-sm" onclick="viewPrescriptionModal(${app.id})"><i class="fa-solid fa-prescription"></i> View Prescription</button>` : ""}
        <button type="button" class="btn btn-outline btn-sm" onclick="closeModal('prescriptionModal')">Close</button>
      </div>
    </div>
  `;

  openModal("prescriptionModal");
}

async function viewPrescriptionModal(appId) {
  const data = await apiRequest(`/api/appointments/${appId}`);
  if (!data.success) return;

  const app = data.appointment;
  const rx = app.prescription || {
    doctor_name: app.professional_name || "Certified Healthcare Clinician",
    diagnosis: "Bedside Clinical Assessment & Health Monitoring",
    medicines: [
      { name: "Amoxicillin-Clavulanate 625mg", dosage: "1 Tab", frequency: "Twice daily (1-0-1)", duration: "5 Days", instructions: "After meals" }
    ],
    special_instructions: "Maintain adequate bed rest, stay hydrated, and take all medicines on schedule.",
    created_at: app.appointment_date
  };

  const container = document.getElementById("prescriptionModalContent");
  if (!container) return;
  const modalTitle = document.querySelector("#prescriptionModal .modal-title");
  if (modalTitle) {
    modalTitle.innerHTML = '<i class="fa-solid fa-prescription" style="color:var(--primary);"></i> Digital Medical Prescription';
  }

  container.innerHTML = `
    <div class="printable-area" style="border: 2px solid #cbd5e1; border-radius:var(--radius-lg); padding:2rem; background:white; font-family:sans-serif;">
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #059669; padding-bottom:1rem; margin-bottom:1.5rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="/static/images/nepal_emblem_logo.png" alt="Emblem" style="height:58px; object-fit:contain;">
          <div>
            <div style="font-size:0.75rem; color:#dc2626; font-weight:800;">नेपाल सरकार | स्वास्थ्य तथा जनसङ्ख्या मन्त्रालय</div>
            <h2 style="color:#059669; font-size:1.35rem; font-weight:800; margin:0;">NATIONAL HOME HEALTHCARE CLINIC</h2>
            <div style="font-size:0.75rem; color:#64748b;">Licensed In-Home Clinical & Nursing Services | Helpline: +977 1-4200000</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:1.15rem; font-weight:800; color:#0f172a;">${rx.doctor_name}</div>
          <div style="font-size:0.75rem; color:#059669; font-weight:700;">Attending Clinician / Doctor</div>
        </div>
      </div>

      <!-- Patient & Appt Info -->
      <div style="background:#f8fafc; padding:1rem; border-radius:var(--radius-md); margin-bottom:1.5rem; display:grid; grid-template-columns:repeat(3, 1fr); gap:0.75rem; font-size:0.85rem;">
        <div><strong>Patient Name:</strong> ${app.patient_name}</div>
        <div><strong>Age / Gender:</strong> ${app.patient_age} yrs / ${app.patient_gender || 'N/A'}</div>
        <div><strong>Blood Group:</strong> ${app.patient_blood_group || 'O+'}</div>
        <div><strong>Date:</strong> ${app.appointment_date}</div>
        <div><strong>Rx ID:</strong> RX-${app.appointment_number}</div>
        <div><strong>Diagnosis:</strong> <span style="color:#2563eb; font-weight:700;">${rx.diagnosis}</span></div>
      </div>

      <!-- Rx Symbol & Medicines Table -->
      <div style="font-size:1.8rem; font-weight:900; color:#059669; font-family:serif; margin-bottom:0.5rem;">℞</div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem; font-size:0.875rem;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
            <th style="padding:0.6rem;">Medicine Name</th>
            <th style="padding:0.6rem;">Dosage</th>
            <th style="padding:0.6rem;">Frequency</th>
            <th style="padding:0.6rem;">Duration</th>
            <th style="padding:0.6rem;">Special Instructions</th>
          </tr>
        </thead>
        <tbody>
          ${rx.medicines.map(m => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:0.6rem; font-weight:700; color:#0f172a;">${m.name}</td>
              <td style="padding:0.6rem;">${m.dosage}</td>
              <td style="padding:0.6rem;"><span class="badge badge-assigned">${m.frequency}</span></td>
              <td style="padding:0.6rem;">${m.duration}</td>
              <td style="padding:0.6rem; color:#64748b;">${m.instructions}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- Special Advice & Sign -->
      <div style="margin-bottom:2rem; font-size:0.85rem; background:#fffbeb; border-left:4px solid #f59e0b; padding:0.75rem; border-radius:var(--radius-sm);">
        <strong>General Advice & Follow-Up:</strong> ${rx.special_instructions}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed #cbd5e1; padding-top:1.5rem;">
        <div style="font-size:0.75rem; color:#64748b;">
          <div style="font-weight:700; color:#0f172a; margin-bottom:0.2rem;"><i class="fa-solid fa-pills" style="color:var(--primary);"></i> Dispensed & Verified By:</div>
          <div><strong>Pharmacist Shyam</strong> (B.Pharm, Reg #NP-88421)</div>
          <div>Care Nurse: <strong>Rama</strong> (RN)</div>
        </div>
        <div style="text-align:center;">
          <div style="font-family:'Brush Script MT', cursive; font-size:1.5rem; color:#1e293b;">${rx.doctor_name || 'Dr. Binod Thapa'}</div>
          <div style="border-top:1px solid #94a3b8; font-size:0.75rem; font-weight:700; padding-top:0.25rem;">Dr. Binod Thapa, MD (Authorized Signature & Seal)</div>
        </div>
      </div>
    </div>
  `;

  openModal("prescriptionModal");
}

async function viewInvoiceModal(appId) {
  const data = await apiRequest(`/api/appointments/${appId}`);
  if (!data.success) return;

  const app = data.appointment;
  const pay = app.payment || {
    invoice_number: `INV-${app.appointment_number}`,
    transaction_id: `TXN-CARD-9921`,
    payment_method: 'online_card',
    amount: (app.service_price || 65) + 15 + 4,
    payment_date: app.appointment_date,
    breakdown: { base_service: app.service_price || 65, consumables: 15, tax: 4, total: 84 }
  };

  const container = document.getElementById("invoiceModalContent");
  if (!container) return;

  container.innerHTML = `
    <div class="printable-area" style="border: 2px solid #cbd5e1; border-radius:var(--radius-lg); padding:2rem; background:white; font-family:sans-serif;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2563eb; padding-bottom:1rem; margin-bottom:1.5rem;">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <img src="/static/images/nepal_emblem_logo.png" alt="Emblem" style="height:55px; object-fit:contain;">
          <div>
            <div style="font-size:0.75rem; color:#dc2626; font-weight:800;">नेपाल सरकार | स्वास्थ्य तथा जनसङ्ख्या मन्त्रालय</div>
            <h2 style="color:#2563eb; font-size:1.35rem; font-weight:800; margin:0;">TAX INVOICE & OFFICIAL RECEIPT</h2>
            <div style="font-size:0.75rem; color:#64748b;">National Home Healthcare Services Ltd. | PAN/VAT: 601239842</div>
          </div>
        </div>
        <div style="text-align:right;">
          <span class="badge badge-completed" style="font-size:0.9rem; padding:0.4rem 0.8rem;"><i class="fa-solid fa-check"></i> PAID IN FULL</span>
          <div style="font-size:0.8rem; color:#64748b; margin-top:0.25rem;">Invoice: <strong>${pay.invoice_number}</strong></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin-bottom:1.5rem; font-size:0.85rem;">
        <div>
          <div style="font-weight:700; color:#0f172a; margin-bottom:0.25rem;">Billed To:</div>
          <div>${app.patient_name}</div>
          <div>${app.address}</div>
          <div>Phone: ${app.patient_phone || 'N/A'}</div>
        </div>
        <div style="text-align:right;">
          <div><strong>Payment Date:</strong> ${pay.payment_date || app.appointment_date}</div>
          <div><strong>Payment Mode:</strong> ${pay.payment_method.toUpperCase()}</div>
          <div><strong>Transaction Ref:</strong> ${pay.transaction_id}</div>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:1.5rem; font-size:0.875rem;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
            <th style="padding:0.6rem;">Item Description</th>
            <th style="padding:0.6rem; text-align:center;">Qty</th>
            <th style="padding:0.6rem; text-align:right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:0.6rem;"><strong>${app.service_title}</strong> (Home Healthcare Visit)</td>
            <td style="padding:0.6rem; text-align:center;">1</td>
            <td style="padding:0.6rem; text-align:right;">${formatNpr(pay.breakdown.base_service)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:0.6rem;">Clinical Consumables & PPE Kit</td>
            <td style="padding:0.6rem; text-align:center;">1</td>
            <td style="padding:0.6rem; text-align:right;">${formatNpr(pay.breakdown.consumables)}</td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:0.6rem;">Healthcare Service Tax (5%)</td>
            <td style="padding:0.6rem; text-align:center;">-</td>
            <td style="padding:0.6rem; text-align:right;">${formatNpr(pay.breakdown.tax)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:0.8rem; font-size:1.1rem; font-weight:800; text-align:right;">Total Paid:</td>
            <td style="padding:0.8rem; font-size:1.1rem; font-weight:800; text-align:right; color:#059669;">${formatNpr(pay.amount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

  openModal("invoiceModal");
}

function viewMedicalReportModal(appId) {
  window.open("/uploads/sample_visit_summary.pdf", "_blank");
}

function printCurrentModalArea() {
  window.print();
}
