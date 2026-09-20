/**
 * Home Healthcare Management System - Feedback & Issue Resolution Module (Step 9)
 * Handles 5-Star Ratings, Feedback Tags, Satisfaction Gateway, and Dispute Resolution Tickets
 */

let activeFeedbackAppointmentId = null;
let activeFeedbackProfessionalId = null;
let currentRatingValue = 0;
let isSatisfiedChoice = true;
let selectedFeedbackTags = new Set(["Punctual", "Compassionate Care"]);

function openFeedbackModal(appId, profId = null) {
  activeFeedbackAppointmentId = appId;
  if (profId) {
    activeFeedbackProfessionalId = profId;
  } else if (typeof AppState !== "undefined" && Array.isArray(AppState.appointments)) {
    const found = AppState.appointments.find(a => a.id === appId);
    activeFeedbackProfessionalId = found ? found.professional_id : null;
  } else {
    activeFeedbackProfessionalId = null;
  }
  currentRatingValue = 0;
  isSatisfiedChoice = true;
  selectedFeedbackTags = new Set(["Punctual", "Compassionate Care"]);

  updateStarsUI(0);
  updateSatisfactionDecisionUI(true);
  renderFeedbackTagsUI();
  updateWorkflowStepper(9);
  openModal("feedbackModal");
}

function setStarRating(rating) {
  currentRatingValue = rating;
  updateStarsUI(rating);

  // If rating is 1 or 2 stars, automatically suggest issue resolution
  if (rating <= 2) {
    setSatisfactionDecision(false);
  } else {
    setSatisfactionDecision(true);
  }
}

function updateStarsUI(rating) {
  document.querySelectorAll("#starRatingContainer .star").forEach(star => {
    const starVal = parseInt(star.dataset.value);
    if (starVal <= rating) {
      star.classList.add("active");
    } else {
      star.classList.remove("active");
    }
  });
}

function toggleFeedbackTag(tag, el) {
  if (selectedFeedbackTags.has(tag)) {
    selectedFeedbackTags.delete(tag);
    el.classList.remove("active");
  } else {
    selectedFeedbackTags.add(tag);
    el.classList.add("active");
  }
}

function renderFeedbackTagsUI() {
  const tags = ["Punctual", "Compassionate Care", "Clean & Sterile", "Gentle Treatment", "Clear Explanations", "Highly Skilled"];
  const container = document.getElementById("feedbackTagsList");
  if (!container) return;

  container.innerHTML = tags.map(t => `
    <button type="button" class="role-chip-btn ${selectedFeedbackTags.has(t) ? 'active' : ''}" onclick="toggleFeedbackTag('${t}', this)">
      <i class="fa-solid fa-tag"></i> ${t}
    </button>
  `).join("");
}

function setSatisfactionDecision(satisfied) {
  isSatisfiedChoice = satisfied;
  updateSatisfactionDecisionUI(satisfied);
}

function updateSatisfactionDecisionUI(satisfied) {
  const cardYes = document.getElementById("satisfactionCardYes");
  const cardNo = document.getElementById("satisfactionCardNo");
  const issueSection = document.getElementById("issueResolutionFormSection");

  if (cardYes && cardNo) {
    if (satisfied) {
      cardYes.classList.add("selected-yes");
      cardNo.classList.remove("selected-no");
      if (issueSection) issueSection.style.display = "none";
    } else {
      cardYes.classList.remove("selected-yes");
      cardNo.classList.add("selected-no");
      if (issueSection) issueSection.style.display = "block";
    }
  }
}

async function submitFeedbackDecision(event) {
  event.preventDefault();

  if (!currentRatingValue || currentRatingValue < 1 || currentRatingValue > 5) {
    showToast("Please select a rating from 1 to 5 stars before submitting your feedback.", "warning");
    return;
  }

  const comments = document.getElementById("feedbackComments").value.trim();
  const tagsStr = Array.from(selectedFeedbackTags).join(", ");

  // 1. Submit Base Feedback
  const payload = {
    rating: currentRatingValue,
    tags: tagsStr,
    comments: comments,
    is_satisfied: isSatisfiedChoice
  };
  if (activeFeedbackProfessionalId) {
    payload.professional_id = activeFeedbackProfessionalId;
  }

  const fbData = await apiRequest(`/api/appointments/${activeFeedbackAppointmentId}/feedback`, "POST", payload);

  if (!fbData.success) {
    showToast(fbData.message || "Failed to submit feedback", "error");
    return;
  }

  // Persist the updated staff rating and review count locally so that it updates everywhere immediately
  if (fbData.professional_id) {
    if (typeof saveStaffRating === "function") {
      saveStaffRating(fbData.professional_id, fbData.professional_rating, fbData.review_count);
    }
    if (typeof allHealthcareStaff !== "undefined" && Array.isArray(allHealthcareStaff)) {
      const staffMember = allHealthcareStaff.find(s => s.id === fbData.professional_id);
      if (staffMember) {
        staffMember.rating = fbData.professional_rating;
        staffMember.review_count = fbData.review_count;
      }
    }
    if (typeof loadPublicDoctors === "function") {
      loadPublicDoctors();
    }
    // Reflect the recalculated rating immediately when the reviewed professional is currently active
    if (AppState.currentUser && AppState.currentUser.id === fbData.professional_id) {
      AppState.currentUser.rating = fbData.professional_rating;
      AppState.currentUser.review_count = fbData.review_count;
      if (typeof updateUserHeaderUI === "function") updateUserHeaderUI();
      if (typeof renderRoleSpecificViews === "function") renderRoleSpecificViews();
      if (typeof renderStaffDashboard === "function") renderStaffDashboard(AppState.currentUser);
    }
  }

  // 2. If Not Satisfied, Submit Issue Resolution Ticket
  if (!isSatisfiedChoice) {
    const category = document.getElementById("issueCategorySelect").value;
    const description = document.getElementById("issueDescription").value.trim();
    const resolution = document.getElementById("issueDesiredResolution").value;

    if (!description) {
      showToast("Please describe the issue you experienced for our Admin to resolve.", "warning");
      return;
    }

    const issueData = await apiRequest(`/api/appointments/${activeFeedbackAppointmentId}/issue`, "POST", {
      category: category,
      description: description,
      desired_resolution: resolution
    });

    if (issueData.success) {
      showToast(`Support Ticket #${issueData.ticket_number} created! Healthcare Admin has been notified for resolution.`, "success", 6000);
      closeModal("feedbackModal");
      if (typeof loadPatientRecords === "function") await loadPatientRecords();
      return;
    }
  }

  const successMessage = fbData.message || `Thank you! Your ${currentRatingValue}-star rating has been recorded.`;
  showToast(successMessage, "success", 6000);
  closeModal("feedbackModal");
  if (typeof loadPatientRecords === "function") await loadPatientRecords();
}
