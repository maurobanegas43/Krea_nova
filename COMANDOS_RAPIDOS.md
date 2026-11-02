# Guía de Comandos Rápidos y Criterios de Uso en Orca

Este documento detalla los comandos rápidos configurados en el entorno de **Orca** (a través de `~/.orca/quick-commands.zsh`) y en el [`Makefile`](file:///Users/maurobanegas43/Documents/proyecto_final/Makefile) del proyecto, junto con los **criterios arquitectónicos y operativos** que rigen su utilización.

---

## 1. Tabla de Atajos Disponibles en Terminal

| Categoría | Comando Rápido | Equivalente Make / Git | Descripción |
| :--- | :--- | :--- | :--- |
| **Servidores** | `serv-up` | `make dev` | Inicia Backend (`:8080`) y Frontend (`:5173`) en segundo plano |
| **Servidores** | `serv-down` | `make stop` | Detiene y libera los puertos `8080` y `5173` inmediatamente |
| **Servidores** | `serv-status` | `make status` | Consulta estado de Backend, Frontend y PostgreSQL |
| **Servidores** | `serv-logs` | `make logs` | Muestra el log unificado de desarrollo en tiempo real |
| **Git / GitHub** | `g-st` | `make git-status` | Estado limpio y compacto (`git status -sb`) |
| **Git / GitHub** | `g-diff` | `git diff` | Muestra diferencias exactas del código modificado |
| **Git / GitHub** | `g-add` | `git add .` / `git add <f>` | Agrega cambios al área de preparación (staging) |
| **Git / GitHub** | `g-commit "<msg>"` | `git commit -m` | Crea un commit con formato *Conventional Commits* |
| **Git / GitHub** | `g-push` | `git push origin <rama>` | Sube commits de la rama actual a GitHub |
| **Git / GitHub** | `g-pull` | `make git-sync` | Actualiza la rama con `git pull --rebase origin <rama>` |
| **Git / GitHub** | `g-save "<msg>" -p`| — | Ejecuta `add` + `commit` (+ `push` con `-p` o `--push`) |
| **Búsqueda** | `f-name <archivo>` | `find` optimizado | Busca archivos por nombre (omite `node_modules`, `.git`, `dist`) |
| **Búsqueda** | `f-text <texto>` | `grep` optimizado | Busca texto en código fuente ignorando logs y dependencias |
| **Puertos** | `f-ports` | `lsof` filtrado | Reporta si los puertos `8080`, `5173` y `5432` están ocupados |
| **Ayuda** | `orca-help` | `make help` | Imprime el resumen rápido en terminal |

---

## 2. Criterios de Uso de Comandos Rápidos

Los comandos rápidos aceleran la operatoria diaria, pero su uso exige **disciplina técnica** para no introducir bugs, secretos expuestos o historiales de Git corruptos.

### A. Criterios para Servidores (`serv-up`, `serv-down`, `serv-status`)
1. **Regla de Puerto Libre:** Nunca lances `serv-up` si no verificaste previamente el estado con `serv-status` o `f-ports`. Si un proceso quedó colgado de una sesión previa, ejecutá `serv-down` primero.
2. **Logs para Diagnóstico:** Los servidores corren en segundo plano redirigiendo salida a `.logs/backend.log` y `.logs/frontend.log`. Ante cualquier respuesta inesperada (HTTP 500, fallos de CORS o variables de entorno no cargadas), abrí los logs con `serv-logs`.
3. **Cierre Limpio al Terminar:** Al finalizar la jornada o cambiar de rama, ejecutá `serv-down` para evitar procesos huérfanos consumiendo memoria o bloqueando sockets locales.

---

### B. Criterios para Git y GitHub (`g-st`, `g-add`, `g-commit`, `g-push`, `g-pull`)

#### 1. Criterio de Staging (`g-add` y `git add .`)
- **Prohibido el `git add .` a ciegas:** Antes de agregar cambios con `g-add`, siempre ejecutá `g-st` o `g-diff` para verificar exactamente qué archivos fueron modificados o creados.
- **Protección de Secretos y Entornos:** Archivos como `.env`, `.env.local`, llaves privadas (`*.key`, `*.pem`) o carpetas de logs (`.logs/`) **jamás** deben agregarse al repositorio. Verificá que estén contenidos en `.gitignore`.
- **Atomicidad de Cambios:** Si modificaste 5 archivos pero corresponden a dos tareas distintas (por ejemplo, corrección de base de datos y retoque visual de CSS), hacé staging selectivo (`g-add path/al/archivo`) para generar commits atómicos y descriptivos.

#### 2. Criterio de Commits (`g-commit` y `Conventional Commits`)
- **Estructura Estándar:**
  ```text
  <tipo>(<alcance>): <descripción imperativa corta>
  ```
  - `feat`: Nueva funcionalidad (ej: `feat(auth): add duplicate dni validation on registration`).
  - `fix`: Corrección de bug (ej: `fix(db): backfill missing dni_hash in investor profiles`).
  - `refactor`: Cambio de código sin alterar comportamiento externo ni corregir bug.
  - `test`: Incorporación o ajuste de pruebas unitarias o de integración.
  - `docs`: Modificación exclusiva de documentación.
- **Prohibición de Atribuciones Artificiales:** No incluir líneas como `Co-Authored-By: AI` o menciones de autoría automatizada en el cuerpo del commit.

#### 3. Criterio de Sincronización (`g-pull` y `g-push`)
- **Rebase vs. Merge (`g-pull`):** Se utiliza `git pull --rebase` para traer los cambios remotos y re-aplicar tus commits locales sobre la punta de la rama. Esto evita la proliferación de commits vacíos del tipo *"Merge branch 'main' of github.com..."*, manteniendo un historial lineal y auditable.
- **Pruebas antes de Push:** Nunca ejecutes `g-push` sin haber corrido previamente las pruebas (`make test` o `go test ./...` y `npm run build`). Código roto en rama remota perjudica a todo el equipo.

---

### C. Criterios para Búsqueda de Código (`f-name` y `f-text`)
1. **Minimización de I/O en Disco:** Búsquedas estándar de `find` o `grep` sin filtros exploran carpetas pesadas como `node_modules` (miles de archivos) o `.git`, saturando la CPU.
2. **Uso de Filtros Excluyentes:** `f-name` y `f-text` excluyen por defecto dependencias, artefactos compilados (`dist/`, `bin/`) y logs. Usalos siempre que necesites localizar declaraciones de métodos, puertos o controladores dentro del código de dominio.

---

## 3. Activación y Verificación

Los comandos quedan activos automáticamente en cada nueva pestaña o terminal de **Orca**. 

Para cargarlos en la terminal actual de inmediato:
```zsh
source ~/.zshrc
```

Para comprobar su funcionamiento:
```bash
orca-help
```
o desde el proyecto:
```bash
make help
```
