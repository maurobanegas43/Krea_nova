#!/usr/bin/env bash
# Script para cargar diagramas en Diagram Studio (http://localhost:3000)
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-er}"

case "$TARGET" in
  er|entidad-relacion)
    FILE="$DIR/entidad_relacion.json"
    ;;
  usecase|casos-de-uso)
    FILE="$DIR/caso_de_uso.json"
    ;;
  sequence|secuencia|pagos)
    FILE="$DIR/secuencia_pagos.json"
    ;;
  *)
    echo "Uso: $0 [er | usecase | sequence]"
    exit 1
    ;;
esac

echo "Enviando $FILE a Diagram Studio..."
curl -s -X POST http://localhost:3000/api/command \
  -H "Content-Type: application/json" \
  -d @"$FILE" > /dev/null

echo "Listo. Diagrama '$TARGET' cargado en http://localhost:3000"
