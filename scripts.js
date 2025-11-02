document.addEventListener('DOMContentLoaded', function(){
  // Smooth scroll for anchors
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', function(e){
      const href = this.getAttribute('href');
      if(href && href.startsWith('#')){
        e.preventDefault();
        const id = href.slice(1);
        const el = document.getElementById(id);
        if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
        // On small screens, close mobile nav after click
        const siteNav = document.getElementById('siteNav');
        if(siteNav && siteNav.classList.contains('open')) siteNav.classList.remove('open');
      }
    });
  });

  // Mobile nav toggle
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  if(navToggle && siteNav){
    navToggle.addEventListener('click', (e)=>{
      e.stopPropagation();
      siteNav.classList.toggle('open');
      // toggle aria-expanded for accessibility
      const expanded = siteNav.classList.contains('open');
      navToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
    // close on outside click
    document.addEventListener('click', (e)=>{
      if(window.innerWidth <= 720){
        if(!siteNav.contains(e.target) && !navToggle.contains(e.target)){
          siteNav.classList.remove('open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
    // close on escape
    document.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape'){
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Export visible page to PDF (approximate resume) - uses html2pdf (external lib)
  const downloadBtn = document.getElementById('downloadResume');
  if(downloadBtn){
    downloadBtn.addEventListener('click', ()=>{
      const opt = {
        margin:       0.4,
        filename:     'Sevak_Grigoryan_Resume.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
      };
      const element = document.querySelector('.wrap');
      if(typeof html2pdf === 'function' || (window.html2pdf)){
        html2pdf().set(opt).from(element).save();
      } else {
        // fallback: just open print dialog
        window.print();
      }
    });
  }
});