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
  let content = fs.readFileSync(f, 'utf8');
  let prefix = '';
  if (f.includes('pages/legal')) {
    prefix = '../../';
  } else if (f.includes('pages/')) {
    prefix = '../';
  }
  const scriptStr = `<script src="${prefix}js/config.js"></script>\n`;
  
  if (!content.includes('config.js')) {
    content = content.replace(/<script[^>]*supabase-js@[^>]*><\/script>/, match => {
      let m = match;
      if(!m.includes('defer')) m = m.replace('<script ', '<script defer ');
      return scriptStr + m;
    });
  } else {
    content = content.replace(/<script[^>]*supabase-js@[^>]*><\/script>/, match => {
      let m = match;
      if(!m.includes('defer')) m = m.replace('<script ', '<script defer ');
      return m;
    });
  }
  fs.writeFileSync(f, content);
  console.log('Updated ' + f);
});
