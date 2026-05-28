<?php
/**
 * API del visor de museos.
 *
 * Entrega los datos (GeoJSON de límites y la lista de museos) desde el
 * servidor. Los archivos pueden estar en la subcarpeta /data o junto a
 * este script (raíz). En ambos casos el acceso directo a esos archivos
 * está bloqueado por .htaccess, de modo que SOLO se sirven a través de
 * este script. Así los datos no quedan expuestos en el código fuente que
 * ve el navegador.
 */

declare(strict_types=1);

$RECURSOS = [
    'dep'    => 'peru_departamental.geojson',
    'prov'   => 'lima_provincial.geojson',
    'dist'   => 'lima_distrital.geojson',
    'museos' => 'museos.json',
];

$r = isset($_GET['r']) ? (string) $_GET['r'] : '';

if (!isset($RECURSOS[$r])) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'recurso no válido']);
    exit;
}

// Busca el archivo en /data y, si no está, junto a este script (raíz).
$archivo = $RECURSOS[$r];
$ruta = null;
foreach ([__DIR__ . '/data/' . $archivo, __DIR__ . '/' . $archivo] as $candidata) {
    if (is_file($candidata)) { $ruta = $candidata; break; }
}

if ($ruta === null) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'recurso no encontrado']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
// Sin caché durante el testeo (para producción puedes volver a:
// 'public, max-age=86400').
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

readfile($ruta);
