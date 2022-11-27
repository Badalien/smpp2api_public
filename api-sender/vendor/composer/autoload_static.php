<?php

// autoload_static.php @generated by Composer

namespace Composer\Autoload;

class ComposerStaticInit3e341934b9757cb6d2af6d66f61c2d13
{
    public static $prefixLengthsPsr4 = array (
        'P' => 
        array (
            'Pheanstalk\\' => 11,
        ),
    );

    public static $prefixDirsPsr4 = array (
        'Pheanstalk\\' => 
        array (
            0 => __DIR__ . '/..' . '/pda/pheanstalk/src',
        ),
    );

    public static function getInitializer(ClassLoader $loader)
    {
        return \Closure::bind(function () use ($loader) {
            $loader->prefixLengthsPsr4 = ComposerStaticInit3e341934b9757cb6d2af6d66f61c2d13::$prefixLengthsPsr4;
            $loader->prefixDirsPsr4 = ComposerStaticInit3e341934b9757cb6d2af6d66f61c2d13::$prefixDirsPsr4;

        }, null, ClassLoader::class);
    }
}
