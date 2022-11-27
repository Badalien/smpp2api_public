<?php

$raw = file_get_contents('php://input');

$parent_dir = dirname(dirname(__FILE__));
include "{$parent_dir}/db.php";

$root_dir = dirname($parent_dir);
$log_path = $root_dir . "/logs/sender_report.log";

$transport = 'ants';
$data = json_decode($raw, true);

if (isset($data['bulkId'])) {
    $response_data = $data['details'][0];
}


if ($response_data && isset($response_data['status'])) {
    $message_id = $response_data['messageId'];  
    $state = ($response_data['status']['name'] == 'DELIVERED') ? 'delivered' : 'failed';
    $query = "UPDATE `messages` SET `state` = '$state' WHERE `message_id` = '$message_id';";
    _log($query);
    $res = $db->query($query);
    if (!$res) _log("MYSQL ERROR: " . $db->error);
    echo 'ok';
    header("HTTP/1.1 200 OK");
} else {
    _log("Wrong Data received: $raw");
    echo 'wrong_data';
    header("HTTP/1.1 404 Not Found");
}


function _log($msg) {
    global $transport;
    global $log_path;

    $date = date("Y-m-d H:i:s");
    $str = "[STATUS:{$transport}] [$date] $msg\n";
    file_put_contents("$log_path", $str, FILE_APPEND);
}