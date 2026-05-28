<?php
/**
 * API del visor de museos.
 *
 * Entrega los datos (GeoJSON de límites y la lista de museos) desde el
 * servidor. Los archivos viven en /data, que está bloqueado al acceso
 * directo (ver data/.htaccess), de modo que SOLO se sirven a través de
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

$ruta = __DIR__ . '/data/' . $RECURSOS[$r];

if (!is_file($ruta)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'recurso no encontrado']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=86400'); // 1 día
header('X-Content-Type-Options: nosniff');

readfile($ruta);
