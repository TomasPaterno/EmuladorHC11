# ADR 0001: Separar el core de Tauri

- Estado: aceptada
- Fecha: 2026-09-11

## Contexto

La emulación debe ser reproducible, comprobable sin webview y reutilizable.

## Decisión

El core Rust no dependerá de Tauri, UI, filesystem, red ni reloj del host.
Tauri será un adaptador que posee el core y expone comandos estrechos. Las
entradas externas se convierten a datos explícitos antes de llegar al core.

## Consecuencias

Las pruebas del core no necesitan una aplicación de escritorio. Se requiere una
capa adicional de traducción y los tipos IPC no pueden reutilizarse como estado
interno por conveniencia.
