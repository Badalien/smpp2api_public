module.exports = {
    apps : [
        {
            name: 'SMPP Server example',
            script: 'server.js',
            instances: 1,
            autorestart: true,
            watch: false,
            exec_mode: "fork",
            env: {
                SMPP_PORT: 2775,
                TUBE: 'smsto_incoming_messages',
                TRANSPORT: 'smsto'
            }
        }
    ],

    deploy : {
        main : {
            'user': 'deployergit',
            'host': '198.199.126.185',
            'ref': 'origin/main',
            'key': 'deploy.key',
            'repo': 'https://github.com/Badalien/smpp2api_project.git',
            'path': '/home/deployergit/smpp2api',
            'post-setup': "supervisorctl restart all",
            'post-deploy': 'cd smpp-server/ && npm install && pm2 reload ecosystem.config.js',
        },
        test : {
            'user': 'deployergit',
            'host': '198.199.126.185',
            'ref': 'origin/test',
            'key': 'deploy.key',
            'repo': 'https://github.com/Badalien/smpp2api_project.git',
            'path': '/home/deployergit/smpp2api',
            'post-setup': "supervisorctl restart all",
            'post-deploy': 'cd smpp-server/ && npm install && pm2 reload ecosystem.config.js',
        }
    }

};
