#!/bin/bash
# Este script inicia un servidor local para que Firebase funcione correctamente.
# Navega a la carpeta del proyecto
cd "$(dirname "$0")"
echo "Iniciando servidor local en el puerto 8080..."

# Abre el navegador automáticamente
sleep 1
open "http://localhost:8080"

# Inicia el servidor de Python
python3 -m http.server 8080
