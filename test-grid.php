<?php


function test($dbname) {
    $m = new Mongo("mongodb://localhost/", array("persist" => "onlyone"));
    $db = $m->selectDB($dbname);
    $grid = $db->getGridFS();
    //$dataIn="hello world";
    $dataIn="ABCDEFGHIJK";
    echo "data in: ".$dataIn."\n";
    $id = $grid->storeBytes($dataIn);

    $file = $grid->findOne(array('_id'=>$id));
    $dataOut=$file->getBytes();
    echo "data out: ".$dataOut."\n";
    
}

test('test');
?>