/**
 * Home Healthcare Management System - Admin Module (Step 4 & Issue Management)
 * Manages Dispatch, Staff Assignment, Status Tracking, and Issue Resolution
 */

let currentAppointmentForAssignment = null;
let allHealthcareStaff = [];

// ==========================================================================
// Admin Dashboard & KPIs
// ==========================================================================
async function loadAdminDashboard() {
  await Promise.all([
    loadAdminStats(),
    loadAdminAppointments(),
    loadHealthcareStaff(),
    loadAdminIssues()
  ]);
}

async function loadAdminStats() {
  const data = await apiRequest("/api/stats");
  if (data.success) {
    const s = data.stats;
    const totalEl = document.getElementById("adminStatTotal");
    const pendingEl = document.getElementById("adminStatPending");
    const completedEl = document.getElementById("adminStatCompleted");
    const revEl = document.getElementById("adminStatRevenue");
    const issuesEl = document.getElementById("adminStatIssues");

    if (totalEl) totalEl.textContent = s.total_appointments;
    if (pendingEl) pendingEl.textContent = s.pending_appointments;
    if (completedEl) completedEl.textContent = s.completed_appointments;
    if (revEl) revEl.textContent = formatNpr(s.total_revenue);
    if (issuesEl) issuesEl.textContent = s.open_issues;
  }
}

async function loadHealthcareStaff() {
  const data = await apiRequest("/api/professionals");
  if (data.success) {
    allHealthcareStaff = data.professionals;
  }
}

// ==========================================================================
// Step 4: Admin Assignment of Healthcare Professional
// ==========================================================================
async function loadAdminAppointments() {
  const data = await apiRequest("/api/appointments");
  const tbody = document.getElementById("adminAppointmentsTableBody");
  if (!tbody) return;

  let appointments = (data && data.success && Array.isArray(data.appointments)) ? [...data.appointments] : [];

  // Merge locally stored bookings for cross-serverless and immediate admin visibility
  if (typeof getLocalBookings === "function") {
    try {
      const localBookings = getLocalBookings();
      const appMap = new Map();
      appointments.forEach(a => appMap.set(a.appointment_number, a));
      const unSynced = [];
      for (const lb of localBookings) {
        if (appMap.has(lb.appointment_number)) {
          const existing = appMap.get(lb.appointment_number);
          if (lb.professional_id && !existing.professional_id) {
            existing.professional_id = lb.professional_id;
            existing.professional_name = lb.professional_name || existing.professional_name;
            existing.professional_specialization = lb.professional_specialization || existing.professional_specialization;
            existing.status = lb.status || "Assigned";
            existing.current_step = lb.current_step || 5;
            existing.staff_response = lb.staff_response || existing.staff_response;
            existing.eta = lb.eta || existing.eta;
          }
        } else {
          appointments.unshift(lb);
          unSynced.push(lb);
        }
      }
      if (unSynced.length > 0) {
        apiRequest("/api/appointments/sync", "POST", { appointments: unSynced }).catch(() => {});
      }
    } catch (e) {
      console.warn("Local bookings sync failed:", e);
    }
  }

  // Update admin stat indicators with current appointment counts
  const totalEl = document.getElementById("adminStatTotal");
  const pendingEl = document.getElementById("adminStatPending");
  if (totalEl && appointments.length > 0) totalEl.textContent = appointments.length;
  if (pendingEl && appointments.length > 0) {
    pendingEl.textContent = appointments.filter(a => a.status === "Pending").length;
  }

  if (appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:#94a3b8;">No appointments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = appointments.map(app => {
    let badgeClass = "badge-pending";
    if (app.status === "Assigned") badgeClass = "badge-assigned";
    if (app.status === "In-Progress") badgeClass = "badge-in-progress";
    if (app.status === "Completed") badgeClass = "badge-completed";
    if (app.status === "Issue Raised") badgeClass = "badge-issue";

    const assignedStaff = app.professional_name 
      ? `<div style="font-weight:600; color:var(--dark);">${app.professional_name}</div><div style="font-size:0.75rem; color:var(--text-muted);">${app.professional_specialization || ''}</div>`
      : `<span style="color:#ef4444; font-weight:600;"><i class="fa-solid fa-triangle-exclamation"></i> Unassigned</span>`;

    return `
      <tr>
        <td><strong>#${app.appointment_number}</strong></td>
        <td>
          <div style="font-weight:700;">${app.patient_name}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${app.patient_phone || ''}</div>
        </td>
        <td>
          <div style="font-weight:600; color:var(--secondary);"><i class="fa-solid ${app.service_icon}"></i> ${app.service_title}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${app.appointment_date} | ${app.time_slot}</div>
        </td>
        <td>
          <span style="font-size:0.8rem; max-width:180px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${app.address}">
            <i class="fa-solid fa-location-dot" style="color:var(--danger)"></i> ${app.address}
          </span>
        </td>
        <td>${assignedStaff}</td>
        <td><span class="badge ${badgeClass}">${app.status}</span></td>
        <td>
          ${app.status === 'Pending' ? `
            <button class="btn btn-primary btn-sm" onclick="openAssignModal(${app.id})">
              <i class="fa-solid fa-user-plus"></i> Assign Staff
            </button>
          ` : `
            <button class="btn btn-outline btn-sm" onclick="viewAppointmentFullModal(${app.id})">
              <i class="fa-solid fa-eye"></i> Details
            </button>
          `}
        </td>
      </tr>
    `;
  }).join("");
}

function openAssignModal(appId) {
  currentAppointmentForAssignment = appId;
  const selectEl = document.getElementById("assignStaffSelect");
  if (!selectEl) return;

  selectEl.innerHTML = `
    <option value="">-- Choose Certified Healthcare Provider --</option>
    ${allHealthcareStaff.map(s => `
      <option value="${s.id}">
        ${s.name || 'Healthcare Professional'}${s.specialization ? ` - ${s.specialization}` : ''}
      </option>
    `).join("")}
  `;

  updateWorkflowStepper(4);
  openModal("adminAssignModal");
}

async function submitStaffAssignment(event) {
  event.preventDefault();
  const staffId = document.getElementById("assignStaffSelect").value;
  if (!staffId) {
    showToast("Please choose a healthcare professional from the list.", "warning");
    return;
  }

  const assignedStaffObj = allHealthcareStaff.find(s => String(s.id) === String(staffId));
  const staffName = assignedStaffObj ? assignedStaffObj.name : "Healthcare Professional";
  const staffSpec = assignedStaffObj ? assignedStaffObj.specialization : "Healthcare Provider";
  const staffPhone = assignedStaffObj ? assignedStaffObj.phone : "";
  const staffAvatar = assignedStaffObj ? assignedStaffObj.avatar : "";

  const data = await apiRequest(`/api/appointments/${currentAppointmentForAssignment}/assign`, "POST", {
    professional_id: parseInt(staffId, 10)
  });

  if (data.success) {
    const staffNotice = `${staffName} (${staffSpec}) has been assigned to your appointment. Preparation in progress.`;

    if (typeof updateLocalBooking === "function") {
      updateLocalBooking({
        id: currentAppointmentForAssignment,
        professional_id: parseInt(staffId, 10),
        professional_name: staffName,
        professional_specialization: staffSpec,
        professional_phone: staffPhone,
        professional_avatar: staffAvatar,
        status: "Assigned",
        current_step: 5,
        staff_response: staffNotice
      });
    }

    showToast(data.message || `Assigned to ${staffName}!`, "success");
    closeModal("adminAssignModal");
    updateWorkflowStepper(5);
    await loadAdminDashboard();
    showToast(`Assigned to ${staffName}! Their dashboard has now been updated.`, "info", 6000);
  } else {
    showToast(data.message || "Assignment failed.", "error");
  }
}

// ==========================================================================
// Admin Issue Resolution Center (Step 9 Satisfaction Gateway)
// ==========================================================================
async function loadAdminIssues() {
  const data = await apiRequest("/api/issues");
  const container = document.getElementById("adminIssuesListContainer");
  if (!container) return;

  if (!data.success || data.issues.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:#94a3b8;"><i class="fa-solid fa-shield-check" style="font-size:2rem; color:var(--success); margin-bottom:0.5rem; display:block;"></i>No unresolved issues. All patients satisfied!</div>`;
    return;
  }

  container.innerHTML = data.issues.map(iss => `
    <div class="card-panel" style="border-left: 4px solid ${iss.status === 'Open' ? 'var(--danger)' : 'var(--success)'}; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
        <div>
          <span class="badge ${iss.status === 'Open' ? 'badge-open' : 'badge-resolved'}">${iss.status}</span>
          <strong style="margin-left:0.5rem;">Ticket #${iss.ticket_number}</strong>
          <span style="font-size:0.8rem; color:var(--text-muted);"> | Appt #${iss.appointment_number} (${iss.service_title})</span>
        </div>
        <span style="font-size:0.75rem; color:var(--text-muted);">${iss.created_at}</span>
      </div>

      <div style="margin-bottom:0.75rem;">
        <div style="font-weight:700; color:var(--dark);">Patient: ${iss.patient_name} (${iss.patient_phone})</div>
        <div style="font-size:0.85rem; color:var(--danger); font-weight:600; margin-top:0.25rem;">Issue Category: ${iss.category} | Desired Remedy: ${iss.desired_resolution}</div>
        <p style="font-size:0.875rem; background:#fef2f2; padding:0.75rem; border-radius:var(--radius-sm); margin-top:0.4rem; color:#7f1d1d;">
          "${iss.description}"
        </p>
      </div>

      ${iss.admin_notes ? `
        <div style="font-size:0.8rem; background:#f0fdf4; border-left:3px solid var(--success); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); margin-bottom:0.75rem; color:#14532d;">
          <strong>Admin Resolution Note:</strong> ${iss.admin_notes}
        </div>
      ` : ''}

      ${iss.status === 'Open' ? `
        <div style="display:flex; gap:0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="openResolveTicketModal(${iss.id}, '${iss.ticket_number}')">
            <i class="fa-solid fa-gavel"></i> Resolve & Close Ticket
          </button>
        </div>
      ` : ''}
    </div>
  `).join("");
}

let activeTicketIdForResolution = null;
function openResolveTicketModal(ticketId, ticketNum) {
  activeTicketIdForResolution = ticketId;
  document.getElementById("resolveTicketNumberSpan").textContent = ticketNum;
  openModal("resolveTicketModal");
}

async function submitTicketResolution(event) {
  event.preventDefault();
  const status = document.getElementById("resolveTicketStatus").value;
  const notes = document.getElementById("resolveTicketNotes").value.trim();

  if (!notes) {
    showToast("Please provide admin resolution notes.", "warning");
    return;
  }

  const data = await apiRequest(`/api/issues/${activeTicketIdForResolution}/resolve`, "POST", {
    status,
    admin_notes: notes
  });

  if (data.success) {
    showToast(data.message, "success");
    closeModal("resolveTicketModal");
    await loadAdminDashboard();
  }
}
