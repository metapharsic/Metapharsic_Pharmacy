<?php

$cookieJar = sys_get_temp_dir() . '/cookie.txt';

foreach (['/pos', '/purchases'] as $uri) {
    $url = 'http://127.0.0.1:5656' . $uri;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieJar);
    curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieJar);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    echo "URI: $uri -> Status: $httpCode, Error: $err, Response len: " . strlen($response) . "\n";
    if ($httpCode !== 200) {
        echo substr($response, 0, 500) . "\n";
    }
}
