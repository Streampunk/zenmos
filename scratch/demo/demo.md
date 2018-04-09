# ZeNMOS demo script

## Show that this is a registration api

For example:

    curl https://localhost:3101/
    curl https://localhost:3101/x-nmos/registration/

## Create resources

A node:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-node-1.json'

A device:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-device.json'

A source:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-source.json'

A flow:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-flow.json'

A sender:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-sender.json'

A receiver:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-receiver.json'


## Update resources

Send the same resource, get an error:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-node-1.json'

Send an updated resource:

    curl -X POST http://localhost:3101/x-nmos/registration/v1.2/resource/ -H 'Content-Type: application/json' -d '@post-node-2.json'

## Delete resources

Delete a node:

    curl -X DELETE http://localhost:3101/x-nmos/registration/v1.2/resource/nodes/3b8be755-08ff-452b-b217-c9151eb21193

With no integrity check, this will succeed.

Try it again.

## Try validation with a bad resource
