const fs = require('fs');
const files = [
  'd:/Proyectos/BecaMax-Frontend/index.html',
  'd:/Proyectos/BecaMax-Frontend/pages/admin-dashboard.html',
  'd:/Proyectos/BecaMax-Frontend/pages/admin-incidencias.html',
  'd:/Proyectos/BecaMax-Frontend/pages/admin-monitorizacion.html',
  'd:/Proyectos/BecaMax-Frontend/pages/admin-usuarios.html',
  'd:/Proyectos/BecaMax-Frontend/pages/auth.html',
  'd:/Proyectos/BecaMax-Frontend/pages/beca-detalle.html',
  'd:/Proyectos/BecaMax-Frontend/pages/configuracion.html',
  'd:/Proyectos/BecaMax-Frontend/pages/dashboard.html',
  'd:/Proyectos/BecaMax-Frontend/pages/incidencias.html',
  'd:/Proyectos/BecaMax-Frontend/pages/perfil.html',
  'd:/Proyectos/BecaMax-Frontend/pages/legal/aviso-legal.html',
  'd:/Proyectos/BecaMax-Frontend/pages/legal/cookies.html',
  'd:/Proyectos/BecaMax-Frontend/pages/legal/privacidad.html'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('class="logo-text"')) {
    console.log(f + ' (fixed font-heading)');
    c = c.replace(/class="logo-text"/g, 'class="logo-text font-heading"');
    fs.writeFileSync(f, c);
  }
});
