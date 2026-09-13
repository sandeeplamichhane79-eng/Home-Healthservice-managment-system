/**
 * Home Healthcare Management System - Feedback & Issue Resolution Module (Step 9)
 * Handles 5-Star Ratings, Feedback Tags, Satisfaction Gateway, and Dispute Resolution Tickets
 */

let activeFeedbackAppointmentId = null;
let currentRatingValue = 5;
let isSatisfiedChoice = true;
let selectedFeedbackTags = new Set(["Punctual", "Compassionate Care"]);

function openFeedbackModal(appId) {
  activeFeedbackAppointmentId = appId;
  currentRatingValue = 5;
  isSatisfiedChoice = true;
  selectedFeedbackTags = new Set(["Punctual", "Compassionate Care"]);

  updateStarsUI(5);
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

  const comments = document.getElementById("feedbackComments").value.trim();
  const tagsStr = Array.from(selectedFeedbackTags).join(", ");

  // 1. Submit Base Feedback
  const fbData = await apiRequest(`/api/appointments/${activeFeedbackAppointmentId}/feedback`, "POST", {
    rating: currentRatingValue,
    tags: tagsStr,
    comments: comments,
    is_satisfied: isSatisfiedChoice
  });

  if (!fbData.success) {
    showToast(fbData.message || "Failed to submit feedback", "error");
    return;
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

  showToast("Thank you for your feedback! The complete 9-step home healthcare workflow is complete.", "success", 5000);
  closeModal("feedbackModal");
  if (typeof loadPatientRecords === "function") await loadPatientRecords();
}
