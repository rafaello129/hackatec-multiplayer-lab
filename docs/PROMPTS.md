# Prompts de clase

Estas plantillas sirven para dirigir agentes sin convertirlos en “hazme todo el juego”.

## 1. Analizar un Issue

```text
Analiza el Issue asignado antes de escribir código.

1. Lee AGENTS.md.
2. Analiza la arquitectura actual.
3. Identifica los archivos involucrados.
4. Identifica contratos compartidos que deban cambiar.
5. Explica riesgos de integración.
6. Propón un plan corto.

No implementes todavía.
No hagas trabajo fuera del Issue.
```

## 2. Implementar

```text
Implementa únicamente el Issue asignado.

Antes:
- revisa AGENTS.md;
- revisa el estado actual;
- conserva la arquitectura existente.

Restricciones:
- no implementes otras features;
- no dupliques tipos de red;
- no instales librerías innecesarias;
- el servidor debe mantener el estado compartido.

Después:
- ejecuta tests;
- ejecuta build;
- revisa errores;
- resume archivos modificados;
- explica cómo probar manualmente.
```

## 3. Reparar

```text
La implementación no está funcionando correctamente.

No reescribas el proyecto.

1. reproduce el problema;
2. identifica la causa;
3. determina el cambio mínimo;
4. corrige únicamente el problema;
5. ejecuta tests;
6. ejecuta build;
7. explica la causa raíz.
```

## 4. Code review

```text
Actúa como revisor técnico.

No agregues funcionalidades.

Revisa:
- alcance del Issue;
- arquitectura;
- contratos Socket.IO;
- tipos;
- estados límite;
- código duplicado;
- posibles regresiones;
- tests faltantes.

Clasifica:
CRÍTICO
IMPORTANTE
OPCIONAL
```

## 5. QA de integración

```text
No agregues features.

Revisa el estado integrado del videojuego.

Ejecuta:
- tests;
- build;
- smoke test.

Comprueba:
- conexión;
- rooms;
- desconexión;
- sincronización;
- errores de consola;
- regresiones entre features.

Devuelve una lista priorizada.
```

## Estructura recomendada de un prompt propio

```text
CONTEXTO
+
OBJETIVO
+
RESTRICCIONES
+
ESTADO ACTUAL
+
TAREA
+
CRITERIOS DE ACEPTACIÓN
+
VALIDACIÓN
```

La calidad del resultado depende más del contexto, alcance y validación que de un “prompt mágico”.
