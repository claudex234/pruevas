# Visor de Museos · Perú → Provincias → Distritos

Visor de mapa por niveles (con zoom) del Perú: **departamentos → provincias de
Lima → distritos → museos**. Cada salto de nivel es una animación de *zoom*
sobre el mismo mapa SVG.

## Cómo funciona (arquitectura)

A diferencia de una página estática, los **datos** no viajan dentro del HTML:

- `index.php` — solo la interfaz (HTML/CSS) y el motor de dibujo SVG.
- `api.php` — entrega los datos en JSON a través de `?r=dep|prov|dist|museos`.
- `data/` — archivos fuente (GeoJSON de límites y `museos.json`).
  Está **bloqueado al acceso directo** por `data/.htaccess`, así que solo se
  leen a través de `api.php`. La lista de museos y los límites **no aparecen**
  en el código fuente que ve el navegador.

> Nota: cualquier sitio web entrega su HTML/CSS/JS al navegador, por lo que el
> *motor de dibujo* siempre es visible (es inevitable en la web). Lo que queda
> del lado del servidor es el **contenido/datos**.

## Sin dependencias externas

Los GeoJSON están guardados localmente en `data/` (solo Perú + departamento de
Lima, recortados). No depende de ningún sitio externo.

## Despliegue

1. Sube **todos** los archivos (`index.php`, `api.php`, `.htaccess`, la carpeta
   `data/` con su `.htaccess`) a tu hosting con **PHP** (cualquier versión 7+).
2. Abre la URL: se sirve `index.php` automáticamente.

Requisitos: PHP y, para bloquear `data/`, un servidor **Apache** (lee
`.htaccess`). En **nginx** hay que añadir una regla equivalente, por ejemplo:

```nginx
location ^~ /data/ { deny all; return 403; }
```

## Datos

- Límites: derivados de [peru-geojson](https://github.com/juaneladio/peru-geojson)
  (recortados a Perú y al departamento de Lima).
- Museos: editables en `data/museos.json`.
