# PokeCards

Genera tarjetas de equipo para PvP de Pokémon GO (LEAD · SAFE SWITCH · CLOSER), siempre en inglés y sin título.
Es una web estática (HTML + JS), sin backend: se puede publicar gratis en GitHub Pages.

## Cómo funciona

| Columna | De dónde sale |
|---|---|
| Pokémon (izq.) | Los 3 que elegís. Megas y Shadows se muestran como tales. |
| GOOD → RESISTS | Tipos de ataque que le hacen < x1 (tabla de tipos de GO: 1.6 / 0.625 / 0.39). |
| GOOD → DAMAGES | Tipos a los que pegan súper efectivo los ataques del moveset elegido. |
| BAD | Tipos que le hacen > x1. |
| USE AGAINST | Top N de la meta de la copa (PvPoke). Shadow/Mega se unifican con la versión normal y se dibujan normales. Cada rival va al Pokémon de tu equipo que mejor lo enfrenta (estimación de carrera de daño 1v1, sin escudos). **PUNISHES** = gana claro y le pega súper efectivo; **SAFE OPTION** = la mejor opción de tu equipo, aunque no sea una paliza. |

## Fuentes de datos (todas se leen en vivo, nada que actualizar a mano)

- **Meta y copas**: [PvPoke](https://github.com/pvpoke/pvpoke) (MIT). `gamemaster.min.json` trae la lista de copas activas
  (`formats`), Pokémon, stats y movimientos. Los rankings por copa están en `src/data/rankings/<cup>/overall/rankings-<cp>.json`.
  Cuando rota la copa o cambia la meta, PvPoke actualiza esos archivos y la app lo toma solo.
- **Imágenes de Pokémon**: [PokeAPI sprites](https://github.com/PokeAPI/sprites) (official artwork). Formas Mega/regionales se resuelven con la API de PokeAPI.
- **Iconos de tipos**: PNG redondos en `assets/type-icons/`, recortados de las tarjetas de referencia del proyecto.

## Correr local

```powershell
npx --yes http-server@14.1.1 -p 8765 -c-1
```

Abrí http://localhost:8765, elegí copa, tus 3 Pokémon (y movimientos), **Build card** → **Download PNG**.

## Publicar en GitHub Pages

```powershell
gh repo create PokeCards --public --source . --push
```

Después: Settings → Pages → Branch `main` / root.

## Limitaciones

- El reparto de USE AGAINST es una heurística (no simula escudos, buffs ni switches). Para matchups finos, usar PvPoke.
- Si una copa rotativa no tiene rankings publicados todavía en PvPoke, no aparece en la lista.
- Imágenes y nombres son © Nintendo / Game Freak / The Pokémon Company; uso personal / fan.
