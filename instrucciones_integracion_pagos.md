# Especificación de desarrollo: integración de pagos y billeteras externas

> **Objetivo:** implementar una capa de pagos segura y extensible para el mercado interno, desarrollado con Go, Gin y PostgreSQL. La solución debe permitir integrar proveedores externos sin acoplar la lógica del negocio a una única plataforma.
>
> **Instrucción para el agente:** antes de modificar código, inspeccioná el repositorio, su `README`, la arquitectura existente, los modelos de datos, las migraciones, la autenticación y los patrones de testing. Adaptá esta especificación al proyecto real. No reemplaces componentes funcionales ni inventes endpoints, tablas o dependencias sin comprobar primero qué existe.

---

## 1. Alcance funcional

Desarrollar una integración que pueda gestionar:

- Creación de solicitudes de pago.
- Consulta del estado de una operación.
- Confirmación asíncrona mediante webhooks o mecanismos oficiales del proveedor.
- Registro auditable de depósitos, pagos, comisiones y movimientos.
- Prevención de pagos duplicados y procesamiento repetido de notificaciones.
- Preparación para incorporar más de un proveedor.
- Integración con un proveedor de pagos tradicional, como Mercado Pago, y con un proveedor de pagos cripto o infraestructura Web3, **solo cuando el proveedor elegido y sus condiciones estén confirmados**.

No asumir que Mercado Pago permite operar saldos internos, custodia, transferencias entre usuarios o liquidaciones a terceros para este caso de uso. Verificar primero las capacidades, condiciones comerciales y restricciones aplicables al producto contratado.

## 2. Decisiones que el agente debe verificar antes de implementar

Revisar la documentación y el código del proyecto y registrar las decisiones en `docs/payments/DECISIONS.md` (o en la ubicación de documentación equivalente ya existente).

1. **Monedas:** ARS, stablecoins, otras criptomonedas o combinación.
2. **Flujo de fondos:** pago directo al vendedor, saldo interno contable, custodia externa o modelo híbrido.
3. **Uso del mercado:** compraventa, inversiones, transferencias entre usuarios u otro.
4. **Retiros:** si se permiten, a qué destinos y con qué controles.
5. **Proveedor inicial:** Mercado Pago, proveedor cripto específico u otro.
6. **Red blockchain y activo:** solo si se habilitan depósitos o retiros on-chain.
7. **Comisiones, límites, vencimientos y política de reembolsos.**
8. **Requisitos legales y operativos:** verificar con asesoramiento competente los requisitos aplicables en Argentina antes de habilitar custodia, saldos canjeables, transferencias, intermediación, inversiones o rendimientos.

Si falta una decisión que cambie el flujo de fondos o la seguridad, **no inventarla**. Implementar primero interfaces, validaciones y documentación no dependientes de esa decisión, y dejar explícito qué bloquea la puesta en producción.

## 3. Arquitectura requerida

Mantener separadas estas responsabilidades:

- **API HTTP (Gin):** autenticación, autorización, validación de entrada y respuestas.
- **Servicio de pagos:** reglas del negocio y coordinación de operaciones.
- **Adaptadores de proveedores:** integración con APIs externas.
- **Webhook handler:** recepción, autenticación y registro de notificaciones.
- **Ledger/registro contable:** fuente de verdad para los movimientos internos, si el producto usa saldos.
- **Persistencia PostgreSQL:** transacciones, restricciones e índices.
- **Worker o proceso asíncrono:** reintentos y conciliación, si la arquitectura existente lo permite.

Usar interfaces de Go para desacoplar proveedores. Los nombres son orientativos y deben adaptarse a las convenciones existentes:

```go
type PaymentProvider interface {
    CreatePayment(ctx context.Context, req CreatePaymentRequest) (PaymentResult, error)
    GetPayment(ctx context.Context, providerPaymentID string) (ProviderPaymentStatus, error)
    VerifyWebhook(ctx context.Context, headers http.Header, body []byte) error
}
```

No obligar a todos los proveedores a implementar funciones que no soportan. Para capacidades específicas —por ejemplo, reembolsos, payouts o consultas blockchain— usar interfaces separadas. No implementar métodos simulados que aparenten soportar una función inexistente.

### Reglas de arquitectura

- El dominio no debe depender de SDKs de proveedores.
- No llamar APIs externas mientras se mantiene abierta una transacción SQL.
- Usar `context.Context`, timeouts y límites de reintentos.
- Mantener los secretos fuera del código, repositorio, frontend y logs.
- Reutilizar la configuración, logging, manejo de errores y estructura de carpetas existentes.
- No guardar datos de tarjetas. Usar el checkout/tokenización oficial del proveedor cuando corresponda.
- No declarar un pago aprobado a partir de una redirección del navegador.

## 4. Modelo de datos

Primero comprobar si ya existen tablas equivalentes. Crear migraciones incrementales; nunca borrar datos ni recrear tablas existentes para simplificar la implementación.

Como mínimo, contemplar estos conceptos:

### `payment_orders` o equivalente

- ID interno.
- Usuario propietario y, si corresponde, orden comercial asociada.
- Proveedor.
- ID externo de la operación, cuando exista.
- Importe en unidades menores para monedas fiat (por ejemplo, centavos) o en representación decimal exacta para activos digitales.
- Código de moneda/activo y red, cuando corresponda.
- Estado interno.
- Clave de idempotencia.
- URL de checkout solo si la devuelve el proveedor y el frontend la necesita.
- Fechas de creación, actualización, expiración y confirmación.

### `payment_events` o equivalente

- Proveedor y ID del evento externo.
- Tipo de evento.
- Referencia a la operación interna.
- Fecha de recepción y procesamiento.
- Resultado del procesamiento.
- Identificador o hash que permita deduplicar el evento.
- Metadatos mínimos necesarios, sin secretos ni datos personales innecesarios.

Agregar una restricción única adecuada para impedir que el mismo evento se procese dos veces.

### `ledger_accounts` y `ledger_entries`, si hay saldo interno

Implementar un libro contable de **doble partida**. Cada operación contabilizada debe tener débitos y créditos que cuadren por activo. Las entradas contabilizadas son inmutables; las correcciones se realizan con asientos compensatorios, no editando el historial.

- No calcular el saldo como un campo editable independiente sin reconciliarlo con el ledger.
- No mezclar activos o monedas en un mismo asiento.
- Usar tipos numéricos exactos; nunca `float32` o `float64` para importes monetarios.
- Proteger la contabilización con transacciones SQL, restricciones e idempotencia.
- Separar saldos disponibles, retenidos y pendientes si el modelo de negocio los necesita.
- No acreditar saldo gastable hasta tener una confirmación confiable del pago o depósito y cumplir las reglas de riesgo definidas.

Si la aplicación no requiere saldo interno, no crear un ledger solo por anticipación: documentar el flujo de pago directo y mantener un registro auditable de estados.

## 5. Estados y transiciones

Definir estados internos explícitos y transiciones permitidas. Como base:

- `pending`: operación creada, aún sin confirmación.
- `processing`: proveedor o verificación en curso.
- `approved`: pago confirmado y validado.
- `rejected`: rechazado.
- `cancelled`: cancelado.
- `expired`: vencido.
- `refunded`: reembolsado, si el proveedor lo admite.
- `under_review`: requiere revisión manual, si se define ese flujo.

Adaptar los estados a las respuestas reales del proveedor. No aceptar transiciones arbitrarias ni retroceder de `approved` a `pending` por una notificación tardía. Un reembolso debe registrarse como un evento/operación separado y auditable; no borrar el pago original.

## 6. Flujo para un proveedor de pagos tradicional

Implementar el siguiente flujo solo después de confirmar la documentación oficial y credenciales del proveedor elegido:

1. El usuario autenticado solicita iniciar un pago.
2. El backend valida usuario, orden, importe, moneda y permisos. El importe se obtiene de datos confiables del servidor; no confiar en el precio enviado por el frontend.
3. El backend crea una operación local `pending` con clave de idempotencia.
4. El adaptador solicita crear el pago o checkout al proveedor.
5. Guardar la referencia externa y devolver al frontend únicamente los datos necesarios para continuar el checkout.
6. Recibir la notificación del proveedor en un endpoint dedicado.
7. Verificar la autenticidad según el mecanismo oficial: firma, secreto, timestamp u otro requisito documentado.
8. Deduplicar el evento y, cuando corresponda, consultar la API oficial para verificar el estado real del pago.
9. Validar coincidencia de referencia, importe, moneda, cuenta receptora y estado.
10. Dentro de una transacción de base de datos, registrar el evento y cambiar el estado una sola vez. Si corresponde saldo interno, contabilizar el asiento en la misma transacción.
11. Responder al proveedor con el código HTTP esperado por su documentación.
12. Registrar fallos recuperables y permitir reintentos seguros.

La URL de retorno del checkout sirve para la experiencia de usuario, no como prueba de pago. El webhook debe tolerar reintentos, duplicados, eventos desordenados y tiempos de espera.

## 7. Flujo para criptomonedas y Web3

No asumir que una integración cripto es igual a una integración de checkout fiat. Elegir y documentar uno de estos modelos:

### A. Proveedor custodial externo

El proveedor administra direcciones, claves o custodia según su producto. Verificar disponibilidad en Argentina, requisitos de cuenta comercial, API, activos, redes, tarifas, retiros, límites y política de congelamiento. Confirmar depósitos y retiros mediante las APIs y webhooks oficiales del proveedor.

### B. Billetera no custodial del usuario

El usuario controla sus claves y autoriza las transacciones desde su propia billetera. El backend no debe pedir ni almacenar frases semilla o claves privadas del usuario. Una conexión de billetera o firma de mensaje no equivale por sí sola a que un depósito haya sido recibido.

### C. Infraestructura on-chain propia

Requiere un análisis específico de red, custodia, gestión de claves, contratos, monitorización, confirmaciones, reorganizaciones de cadena, tarifas, recuperación y seguridad. No implementar custodia de claves privadas dentro de la aplicación web como solución improvisada.

### Verificación de depósitos on-chain

- Validar red, activo/contrato, dirección receptora, importe y transacción.
- No confiar en una captura de pantalla ni en un hash sin verificar.
- Definir confirmaciones requeridas según red y riesgo.
- Gestionar transacciones pendientes, fallidas, duplicadas o reemplazadas y posibles reorganizaciones.
- Acreditar el saldo únicamente tras alcanzar el criterio de confirmación documentado.
- Deduplicar por identificadores apropiados, como red + hash de transacción + índice de log/salida cuando corresponda.
- Mantener un proceso de conciliación entre el registro interno y la fuente externa.
- Nunca exponer claves privadas, semillas, tokens ni secretos en logs o respuestas.

No elegir automáticamente Binance Pay, una red o un token. Comparar primero los proveedores y confirmar qué producto/API puede contratarse para el uso previsto.

## 8. Endpoints HTTP

Inspeccionar las rutas existentes antes de añadir nuevas. Si no existen equivalentes, proponer rutas coherentes con las convenciones del proyecto, por ejemplo:

- `POST /api/payments`: crear una operación de pago.
- `GET /api/payments/:id`: consultar una operación propia.
- `POST /api/webhooks/payments/:provider`: recibir notificaciones del proveedor.

Añadir endpoints de depósitos, retiros, historial o saldo **solo si el alcance aprobado los requiere**. Los endpoints de webhooks normalmente no usan la sesión del usuario, pero deben aplicar la verificación criptográfica/autenticación oficial del proveedor, límites de tamaño, rate limiting y protección contra abuso.

Requisitos:

- Autenticación y autorización para endpoints de usuario.
- Un usuario solo puede consultar sus propias operaciones, salvo permisos administrativos explícitos.
- Validación estricta de importes, moneda, IDs y estados.
- Respuestas de error consistentes y sin filtrar datos internos.
- No exponer operaciones de otros usuarios mediante IDs predecibles.
- Documentar las rutas con el mecanismo OpenAPI/Swagger ya usado por el proyecto, si existe.

## 9. Seguridad, consistencia y confiabilidad

- Aplicar idempotencia a la creación de pagos y al procesamiento de eventos.
- Usar restricciones únicas en PostgreSQL; no depender solo de verificaciones en memoria.
- Usar transacciones SQL para cambios de estado y contabilización.
- Verificar firmas de webhooks según documentación oficial y comparar de forma segura.
- No registrar secretos, tokens de acceso, datos de tarjeta ni información personal innecesaria.
- Guardar secretos en variables de entorno o en el gestor de secretos existente.
- No confiar en importes, estados ni direcciones enviados sin validar por el cliente.
- Aplicar autorización, límites de peticiones, límites de importe y controles de abuso.
- Definir reintentos con backoff para errores temporales; no reintentar errores permanentes indefinidamente.
- No realizar un segundo cobro por un timeout sin comprobar primero la operación previa.
- Registrar auditoría de operaciones administrativas y cambios de estado.
- Mantener la conciliación entre proveedor, órdenes y ledger.
- No habilitar retiros automáticos ni operaciones irreversibles hasta tener controles de riesgo, autorización y monitoreo.

## 10. Configuración

Agregar configuración explícita para el proveedor seleccionado, siguiendo el patrón del proyecto. Ejemplos de nombres, no credenciales reales:

```env
PAYMENTS_PROVIDER=
PAYMENTS_ENVIRONMENT=sandbox
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=
```

Añadir solo las variables que realmente requiera el adaptador. No incluir valores secretos en `.env.example`; usar placeholders vacíos o descriptivos. Verificar que `.env`, credenciales y archivos locales sensibles estén ignorados por Git.

Para cripto, definir variables separadas por proveedor y entorno. No guardar claves privadas de blockchain en variables de entorno de una aplicación web como sustituto de una solución de custodia segura.

## 11. Pruebas obligatorias

Crear pruebas unitarias y de integración siguiendo el stack existente. Usar un proveedor falso/mock para los tests; no depender de cobros reales.

Casos mínimos:

1. Creación válida de pago.
2. Rechazo de importe cero, negativo, excesivo o mal formado.
3. Rechazo de moneda no permitida.
4. Usuario no autenticado o sin autorización.
5. El cliente intenta modificar el precio de la orden.
6. Error o timeout del proveedor al crear el pago.
7. Webhook válido.
8. Webhook con firma inválida.
9. Webhook duplicado.
10. Eventos recibidos fuera de orden.
11. Pago aprobado que se intenta procesar dos veces.
12. Importe, moneda o referencia externa no coincidentes.
13. Dos solicitudes concurrentes con la misma clave de idempotencia.
14. Fallo SQL durante la contabilización: no debe quedar un estado parcialmente actualizado.
15. Reembolso o reversión, si se implementa.
16. Para cripto: red/activo incorrecto, transacción sin confirmaciones suficientes, hash duplicado y transacción no verificable.
17. Conciliación detecta una discrepancia y la informa sin alterar silenciosamente el historial.

Ejecutar y documentar las pruebas, linter y análisis estático disponibles en el repositorio. No afirmar que se probaron credenciales reales si solo se usaron mocks o sandbox.

## 12. Documentación que debe entregar el agente

Actualizar o crear, adaptándose a la estructura real:

- `docs/payments/README.md`: arquitectura, configuración y flujo completo.
- `docs/payments/DECISIONS.md`: decisiones confirmadas, pendientes y justificación.
- `docs/payments/SECURITY.md`: amenazas, controles, secretos y operación segura.
- `docs/payments/TESTING.md`: cómo ejecutar pruebas unitarias, integración y sandbox.
- `.env.example`: nombres de variables sin secretos.
- Documentación de endpoints y webhooks.
- Diagrama Mermaid de secuencia para creación y confirmación del pago.
- Migraciones SQL necesarias, con estrategia de reversión cuando sea viable.

No duplicar documentación existente: actualizarla y enlazarla.

## 13. Plan de implementación

Trabajar en fases pequeñas y revisables:

### Fase 1 — Inspección
- Revisar arquitectura, modelos, migraciones, rutas, autenticación, tests y documentación.
- Identificar componentes reutilizables y riesgos.
- Escribir un breve diagnóstico y lista de archivos que se modificarán.
- No tocar el flujo financiero hasta confirmar las decisiones necesarias.

### Fase 2 — Diseño
- Documentar el flujo elegido, estados, idempotencia, modelo de datos y límites del proveedor.
- Definir contratos de interfaces y migraciones.
- Marcar claramente cualquier decisión bloqueante.

### Fase 3 — Núcleo de dominio
- Implementar modelos y servicios sin acoplamiento al SDK externo.
- Añadir persistencia, transacciones, validaciones y pruebas.

### Fase 4 — Adaptador del proveedor
- Integrar el SDK/API oficial y fijar una versión compatible.
- Implementar creación, consulta y verificación de eventos según la documentación oficial vigente.
- Trabajar primero en sandbox/testnet cuando el proveedor lo ofrezca.

### Fase 5 — Webhooks y conciliación
- Implementar autenticación, deduplicación, procesamiento transaccional, reintentos y auditoría.
- Agregar conciliación y alertas de discrepancias si el alcance las requiere.

### Fase 6 — Validación y entrega
- Ejecutar tests, migraciones en entorno de prueba, linter y análisis estático.
- Revisar seguridad y cambios de esquema.
- Actualizar documentación y presentar un resumen de cambios, comandos ejecutados, resultados y pendientes.

No implementar todas las fases en un único cambio gigante. Mantener los cambios pequeños y comprobar el estado del proyecto entre fases.

## 14. Criterios de aceptación

La tarea se considera completa solo cuando:

- El flujo aprobado está documentado y coincide con la implementación.
- Las credenciales se configuran fuera del código.
- Los pagos no se marcan como aprobados por una redirección del navegador.
- Los webhooks se verifican y deduplican.
- Reintentar una notificación no duplica pagos ni saldos.
- Los importes usan representación exacta.
- Las operaciones que afectan saldos son atómicas y auditables.
- Los errores del proveedor no dejan estados inconsistentes.
- Las pruebas cubren los casos críticos y pasan.
- Las migraciones son compatibles con los datos existentes.
- La documentación explica configuración, pruebas, limitaciones y despliegue.
- No se habilitan custodia, retiros, inversiones ni redistribución de fondos sin confirmar que el modelo técnico, el proveedor y los requisitos aplicables lo permiten.

## 15. Formato de respuesta final del agente

Al terminar, informar:

1. **Qué se implementó**, con rutas y componentes principales.
2. **Qué proveedor y producto se integraron**, y si se usó sandbox o producción.
3. **Migraciones creadas** y cómo aplicarlas.
4. **Variables de configuración requeridas**, sin mostrar secretos.
5. **Pruebas ejecutadas** y resultado real de cada comando.
6. **Decisiones pendientes**, limitaciones y riesgos.
7. **Pasos manuales necesarios** en el panel del proveedor.
8. **Qué no se implementó**, especialmente si quedaron pendientes depósitos, retiros, custodia, saldo interno o integración blockchain.

No declarar la integración lista para producción si faltan credenciales válidas, configuración de webhooks, pruebas de extremo a extremo, conciliación o decisiones críticas de seguridad y cumplimiento.
