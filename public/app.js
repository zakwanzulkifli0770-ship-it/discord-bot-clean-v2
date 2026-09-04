const form = document.querySelector('#campaign-form')
const emptyState = document.querySelector('#empty-state')
const loadingState = document.querySelector('#loading-state')
const errorState = document.querySelector('#error-state')
const results = document.querySelector('#results')
const outputLabel = document.querySelector('#output-label')
const errorMessage = document.querySelector('#error-message')
const retryButton = document.querySelector('#retry-button')
const newBriefButton = document.querySelector('#new-brief-button')
let lastFormData = null

function setView(view) {
  emptyState.classList.toggle('hidden', view !== 'empty')
  loadingState.classList.toggle('hidden', view !== 'loading')
  errorState.classList.toggle('hidden', view !== 'error')
  results.classList.toggle('hidden', view !== 'results')
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
}

function renderCampaign(data) {
  const concept = data.concept || {}
  document.querySelector('#concept-name').textContent = concept.name || 'Untitled direction'
  document.querySelector('#concept-thesis').textContent = concept.thesis || ''
  document.querySelector('#concept-why').textContent = concept.whyItWorks || ''
  document.querySelector('#concept-visual').textContent = concept.visualWorld || ''
  outputLabel.textContent = 'Direction generated'

  document.querySelector('#variants').innerHTML = (data.variants || []).map((variant, index) => `
    <article class="variant">
      <span class="variant-index">0${index + 1} / ${escapeHtml(variant.label || 'Variant')}</span>
      <h4>${escapeHtml(variant.headline || '')}</h4>
      <p>${escapeHtml(variant.body || '')}</p>
    </article>`).join('')

  document.querySelector('#checklist').innerHTML = (data.checklist || []).map((item, index) => `
    <div class="check-item"><span class="check-number">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(item.label || '')}</span><span class="check-owner">${escapeHtml(item.owner || '')}</span><span class="check-timing">${escapeHtml(item.timing || '')}</span></div>`).join('')

  document.querySelector('#image-prompts').innerHTML = (data.imagePrompts || []).map(prompt => `
    <div class="image-prompt"><strong>${escapeHtml(prompt.label || 'Direction')}</strong><p>${escapeHtml(prompt.prompt || '')}</p></div>`).join('')

  const imageWrap = document.querySelector('#image-wrap')
  imageWrap.innerHTML = data.image ? `<img src="${data.image}" alt="Generated campaign direction for ${escapeHtml(concept.name)}">` : '<div class="image-placeholder">No visual returned for this pass.</div>'
  setView('results')
  document.querySelector('.output-panel').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function generateCampaign(data) {
  lastFormData = data
  setView('loading')
  outputLabel.textContent = 'Working...'
  try {
    const response = await fetch('/api/campaigns/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || 'Generation failed')
    renderCampaign(payload)
  } catch (error) {
    errorMessage.textContent = error.message
    outputLabel.textContent = 'Needs another pass'
    setView('error')
  }
}

form.addEventListener('submit', event => {
  event.preventDefault()
  const data = Object.fromEntries(new FormData(form).entries())
  generateCampaign(data)
})
retryButton.addEventListener('click', () => lastFormData && generateCampaign(lastFormData))
newBriefButton.addEventListener('click', () => {
  form.reset(); lastFormData = null; outputLabel.textContent = 'Awaiting brief'; setView('empty'); window.scrollTo({ top: 0, behavior: 'smooth' })
})
