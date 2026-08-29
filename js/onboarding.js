// ============================================================
//  ONBOARDING.JS – Tutorial Inicial de 3 Pasos
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  const ONBOARDING_KEY = 'becamax_onboarding_done';
  if (localStorage.getItem(ONBOARDING_KEY)) return;

  const steps = [
    {
      title: ' ¡Bienvenido a BecaMax!',
      text: 'Tu nuevo buscador inteligente de becas. Aquí podrás encontrar exactamente las ayudas que encajan con tu perfil.',
      icon: ''
    },
    {
      title: ' Usa los filtros',
      text: 'Filtra por Comunidad Autónoma, área de estudio y plazo. Te ayudaremos a separar el ruido de lo importante.',
      icon: ''
    },
    {
      title: ' Crea Alertas Automáticas',
      text: 'Guarda tu búsqueda y te avisaremos por correo antes de que cierre el plazo de tu beca ideal.',
      icon: ''
    }
  ];

  let currentStep = 0;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'onboardingModal';
  modal.innerHTML = `
    <div class="modal modal-wide" style="text-align:center; padding: 40px 30px;">
      <div id="onb-icon" style="font-size:3.5rem; margin-bottom:16px;">${steps[0].icon}</div>
      <h2 id="onb-title" class="modal-title font-heading" style="font-size:1.4rem;">${steps[0].title}</h2>
      <p id="onb-text" class="modal-subtitle" style="font-size:1rem; margin-bottom:30px;">${steps[0].text}</p>
      
      <div style="display:flex; justify-content:center; gap:8px; margin-bottom:30px;" id="onb-dots">
        <span class="onb-dot active"></span>
        <span class="onb-dot"></span>
        <span class="onb-dot"></span>
      </div>

      <div class="modal-actions" style="justify-content:center;">
        <button id="btnOnbSkip" class="btn btn-ghost">Saltar</button>
        <button id="btnOnbNext" class="btn btn-primary" style="min-width:140px;">Siguiente </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Animación de entrada
  requestAnimationFrame(() => modal.classList.add('active'));

  const dotEls = modal.querySelectorAll('.onb-dot');
  const iconEl = modal.querySelector('#onb-icon');
  const titleEl = modal.querySelector('#onb-title');
  const textEl = modal.querySelector('#onb-text');
  const nextBtn = modal.querySelector('#btnOnbNext');

  function renderStep() {
    iconEl.textContent = steps[currentStep].icon;
    titleEl.textContent = steps[currentStep].title;
    textEl.textContent = steps[currentStep].text;
    
    dotEls.forEach((dot, i) => dot.classList.toggle('active', i === currentStep));
    nextBtn.textContent = currentStep === steps.length - 1 ? '¡Empezar! ' : 'Siguiente ';
  }

  function closeOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    modal.classList.remove('active');
    setTimeout(() => modal.remove(), 400);
  }

  modal.querySelector('#btnOnbNext').addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      currentStep++;
      renderStep();
    } else {
      closeOnboarding();
    }
  });

  modal.querySelector('#btnOnbSkip').addEventListener('click', closeOnboarding);
});
