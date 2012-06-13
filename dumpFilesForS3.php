<?php
    // This file was developped in mongo2git but moved to mccloud-ekomobi
    //TODO parameters: db, collection, b64 flag, output dir
    $dbName = $argv[1];
    $outputDir = $argv[2];
    
    if (!$dbName || !$outputDir){
        // could set defaults but prefer to make params required
        echo "Usage php ${argv[0]} <dbName> <outputDir>\n";
        exit(1);
        // $dbName = "ekomobi_prod";
        // $outputDir="images";
    }

    $b64decode = true;
    $collectionName = "fs";
    $verbose=false;

    if (!is_dir($outputDir)){
        mkdir($outputDir);
    }

    $m = new Mongo();
    $db = $m->selectDB($dbName);

    $files = $db->getGridFS($collectionName);    

    $start = time();
    $i = 0;    
    $cursor = $files->find();
    $count = $cursor->count();
    foreach($cursor as $doc) {
        $data = $doc->getBytes();
        if ($b64decode){
            $data = base64_decode($data);
        }
        
        $hash = md5($data);

        // Becaus getimagesize does not support $data, 
        // -we write to a tempp file (.bin)
        // -use getimagesize on that file
        // -and rename the file after if required
        $extension = 'bin';
        $tmpFileName = "$outputDir/img-$hash.$extension";
        
        // write to .bin file
        $fp = fopen($tmpFileName, 'w');
        fwrite($fp, $data);
        fclose($fp);

        // get the type, to infer proper extension
        $size = getimagesize($tmpFileName);
        // $width = $size[0];
        // $height = $size[1];
        // $mime = $size['mime'];
        $imageType = $size[2];
        $extensions = array ( IMAGETYPE_GIF => 'gif', IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG=>'png', IMAGETYPE_BMP=>'bmp');
        $extension = 'bin';
        
        $finalFilename = $tmpFileName;
        if ( isset($extensions[$imageType]) ) {
            $extension = $extensions[$imageType];
            $finalFilename = "$outputDir/img-$hash.$extension";
            rename($tmpFileName,$finalFilename);
        } // else unkonw extension... error ?
        else {
            echo "unknown type $finalFilename: $imageType\n";
        }
        if ($verbose) echo 'wrote image ' . ++$i . "/$count : $finalFilename\n";
    }
    
   $end = time();
   $elapsed = $end - $start;
   if ($verbose) echo "Saved $i/$count images in $elapsed secs.\n";
?>