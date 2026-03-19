# Usamos Nginx ligero (alpine) para servir archivos estáticos HTML/JS/CSS
FROM nginx:alpine

# Copiamos todos los archivos estáticos actuales al directorio de Nginx
COPY . /usr/share/nginx/html/

# Exponemos el puerto 80
EXPOSE 80

# Comando por defecto para Nginx
CMD ["nginx", "-g", "daemon off;"]
