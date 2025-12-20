#!/bin/bash

echo "🔍 Verificando contexto de Docker..."
echo "Tamaño del contexto (excluyendo node_modules):"
du -sh . --exclude=node_modules --exclude=.next --exclude=.git 2>/dev/null | cut -f1

echo ""
echo "📋 Archivos principales:"
ls -la package.json package-lock.json 2>/dev/null || echo "❌ No se encuentran package.json o package-lock.json"

echo ""
echo "🏗️ Verificando build local..."
npm run build > /dev/null 2>&1 && echo "✅ Build local exitoso" || echo "❌ Build local falló"

echo ""
echo "📁 Estructura del build:"
ls -la .next/standalone/ 2>/dev/null || echo "❌ No se encuentra .next/standalone"

echo ""
echo "✅ Verificación completada. Ahora puedes ejecutar:"
echo "   docker compose build"
echo ""
echo "El contexto debería ser de ~1-2MB y el build debería funcionar."